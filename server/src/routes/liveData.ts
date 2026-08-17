import { Router } from "express";
import { XMLParser } from "fast-xml-parser";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { aiChatComplete, AiMessage, isAiConfigured } from "../lib/ai";
import { GUARDRAIL } from "./ai";

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Live external data: per-site weather (Open-Meteo — free, no API key) and
// major-metal spot prices (an unofficial public quote source — no API key
// either, but unlike Open-Meteo it's not an official public API, so it can
// occasionally rate-limit or change shape; every call is wrapped so a
// failure there degrades to "no data" rather than breaking the dashboard).
// Both are cached in-memory per server process — this is read-only reference
// data shared by every user on the mine, so there's no reason to re-fetch it
// per request.
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const WEATHER_TTL_MS = 20 * 60 * 1000;
const PRICE_TTL_MS = 15 * 60 * 1000;
const FX_TTL_MS = 60 * 60 * 1000;
const NEWS_TTL_MS = 30 * 60 * 1000;

const weatherCache = new Map<string, CacheEntry<SiteWeather>>();
let priceCache: CacheEntry<MineralPricesPayload> | null = null;
let fxCache: CacheEntry<number | null> | null = null;
let newsCache: CacheEntry<IndustryNewsPayload> | null = null;

// Free, no-key exchange-rate source — daily-refreshed reference rates, which is more than
// enough freshness for converting a commodity price snapshot into ZAR alongside USD.
async function fetchUsdToZarRate(): Promise<number | null> {
  if (fxCache && fxCache.expiresAt > Date.now()) return fxCache.data;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) return null;
    const data: any = await res.json();
    const rate = data?.rates?.ZAR;
    const result = typeof rate === "number" ? rate : null;
    fxCache = { data: result, expiresAt: Date.now() + FX_TTL_MS };
    return result;
  } catch {
    return null;
  }
}

async function geocodeLocation(location: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: any = await res.json();
    const first = data?.results?.[0];
    return first ? { lat: first.latitude, lon: first.longitude } : null;
  } catch {
    return null;
  }
}

// Resolves once and persists to the Site record — every subsequent call for this site
// reads the stored coordinate directly rather than re-geocoding, which is both more
// efficient and more stable/"accurate": weather (and the site map) always plot the same
// point rather than whatever the geocoder happens to return that particular call.
async function resolveSiteCoordinates(site: {
  id: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
}): Promise<{ lat: number; lon: number } | null> {
  if (site.latitude != null && site.longitude != null) {
    return { lat: site.latitude, lon: site.longitude };
  }
  const coords = await geocodeLocation(site.location);
  if (!coords) return null;
  await prisma.site
    .update({
      where: { id: site.id },
      data: { latitude: coords.lat, longitude: coords.lon, geocodedAt: new Date() },
    })
    .catch(() => {});
  return coords;
}

const WEATHER_CODE_MAP: Record<number, { condition: string; icon: string }> = {
  0: { condition: "Clear sky", icon: "sun" },
  1: { condition: "Mainly clear", icon: "sun" },
  2: { condition: "Partly cloudy", icon: "cloud-sun" },
  3: { condition: "Overcast", icon: "cloud" },
  45: { condition: "Fog", icon: "fog" },
  48: { condition: "Fog", icon: "fog" },
  51: { condition: "Light drizzle", icon: "rain" },
  53: { condition: "Drizzle", icon: "rain" },
  55: { condition: "Dense drizzle", icon: "rain" },
  61: { condition: "Light rain", icon: "rain" },
  63: { condition: "Rain", icon: "rain" },
  65: { condition: "Heavy rain", icon: "rain" },
  71: { condition: "Light snow", icon: "snow" },
  73: { condition: "Snow", icon: "snow" },
  75: { condition: "Heavy snow", icon: "snow" },
  80: { condition: "Rain showers", icon: "rain" },
  81: { condition: "Rain showers", icon: "rain" },
  82: { condition: "Violent showers", icon: "rain" },
  95: { condition: "Thunderstorm", icon: "storm" },
  96: { condition: "Thunderstorm with hail", icon: "storm" },
  99: { condition: "Thunderstorm with hail", icon: "storm" },
};

interface SiteWeather {
  temperatureC: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  humidityPct: number;
  precipitationMm: number;
  condition: string;
  icon: string;
  observedAt: string;
}

async function fetchSiteWeather(siteId: string, coords: { lat: number; lon: number }): Promise<SiteWeather | null> {
  const hit = weatherCache.get(siteId);
  if (hit && hit.expiresAt > Date.now()) return hit.data;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
      `&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,relative_humidity_2m,precipitation&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: any = await res.json();
    const current = data?.current;
    if (!current) return null;
    const info = WEATHER_CODE_MAP[current.weather_code] ?? { condition: "Unknown", icon: "cloud" };
    const result: SiteWeather = {
      temperatureC: current.temperature_2m,
      windSpeedKmh: current.wind_speed_10m,
      windDirectionDeg: current.wind_direction_10m,
      humidityPct: current.relative_humidity_2m,
      precipitationMm: current.precipitation,
      condition: info.condition,
      icon: info.icon,
      observedAt: current.time,
    };
    weatherCache.set(siteId, { data: result, expiresAt: Date.now() + WEATHER_TTL_MS });
    return result;
  } catch {
    return null;
  }
}

router.get("/weather", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const sites = await prisma.site.findMany({
    where: { mineId },
    select: { id: true, name: true, location: true, latitude: true, longitude: true },
    take: 8,
    orderBy: { name: "asc" },
  });
  const results = await Promise.all(
    sites.map(async (site) => {
      const coords = await resolveSiteCoordinates(site);
      return {
        siteId: site.id,
        siteName: site.name,
        latitude: coords?.lat ?? null,
        longitude: coords?.lon ?? null,
        weather: coords ? await fetchSiteWeather(site.id, coords) : null,
      };
    })
  );
  res.json(results.filter((r) => r.weather !== null));
});

// ---------------------------------------------------------------------------
// Mineral / commodity spot prices — major metals relevant to South African
// mining (platinum and gold especially). Not scoped to a mine, so no
// requireMineId here — same data for every caller, hence the single shared
// module-level cache rather than a per-mine one.
// ---------------------------------------------------------------------------

const METAL_SYMBOLS: { symbol: string; key: string; label: string; unit: string }[] = [
  { symbol: "GC=F", key: "GOLD", label: "Gold", unit: "oz" },
  { symbol: "PL=F", key: "PLATINUM", label: "Platinum", unit: "oz" },
  { symbol: "SI=F", key: "SILVER", label: "Silver", unit: "oz" },
  { symbol: "PA=F", key: "PALLADIUM", label: "Palladium", unit: "oz" },
  { symbol: "HG=F", key: "COPPER", label: "Copper", unit: "lb" },
];

interface MetalPrice {
  key: string;
  label: string;
  unit: string;
  price: number;
  priceZar: number | null;
  previousClose: number | null;
  changePercent: number;
  currency: string | null;
}

interface MineralPricesPayload {
  asOf: string;
  prices: MetalPrice[];
  fxRateUsdZar: number | null;
  insight: string | null;
  disclaimer: string | null;
}

const PRICE_INSIGHT_DISCLAIMER =
  "This is general commentary generated from the prices shown, not financial or investment advice. Prices are sourced " +
  "from an unofficial public feed and may be delayed or inaccurate — please do your own research before making any " +
  "decisions based on it.";

// Generated once per price-cache window (not per request) so this costs at most one AI
// call every PRICE_TTL_MS across the whole app, regardless of how many users load the
// dashboard. Purely descriptive by design — the prompt explicitly forbids anything that
// could read as investment advice, and the disclaimer above is a fixed string the model
// never authors, so it can't be dropped or softened by the response.
async function generatePriceInsight(prices: MetalPrice[]): Promise<string | null> {
  if (!isAiConfigured() || prices.length === 0) return null;
  try {
    const messages: AiMessage[] = [
      {
        role: "system",
        content:
          `You are the Mine Guard AI Assistant. Given a snapshot of major metal spot prices, write exactly ONE ` +
          `short sentence (max 30 words) of plain-language, purely descriptive commentary on what's notable in the ` +
          `snapshot — which metals moved most and in which direction. Never recommend buying, selling, holding, or ` +
          `trading anything. Never predict future prices. Never use words like "should", "opportunity", "buy", or ` +
          `"sell". Reply with ONLY the sentence, no markdown, no quotes.` +
          GUARDRAIL,
      },
      { role: "user", content: `Price snapshot (JSON): ${JSON.stringify(prices)}` },
    ];
    const raw = await aiChatComplete(messages);
    return raw.trim().replace(/^"|"$/g, "").slice(0, 300) || null;
  } catch {
    return null;
  }
}

async function fetchYahooQuote(symbol: string): Promise<{ price: number; previousClose: number | null; currency: string | null } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; MineGuardBot/1.0)" } });
    if (!res.ok) return null;
    const data: any = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;
    return {
      price: meta.regularMarketPrice,
      previousClose: typeof meta.chartPreviousClose === "number" ? meta.chartPreviousClose : meta.previousClose ?? null,
      currency: meta.currency ?? null,
    };
  } catch {
    return null;
  }
}

router.get("/mineral-prices", async (_req, res) => {
  if (priceCache && priceCache.expiresAt > Date.now()) {
    return res.json(priceCache.data);
  }
  const [results, fxRateUsdZar] = await Promise.all([
    Promise.all(
      METAL_SYMBOLS.map(async (m): Promise<Omit<MetalPrice, "priceZar"> | null> => {
        const quote = await fetchYahooQuote(m.symbol);
        if (!quote) return null;
        const changePercent = quote.previousClose ? ((quote.price - quote.previousClose) / quote.previousClose) * 100 : 0;
        return {
          key: m.key,
          label: m.label,
          unit: m.unit,
          price: quote.price,
          previousClose: quote.previousClose,
          changePercent: Math.round(changePercent * 100) / 100,
          currency: quote.currency,
        };
      })
    ),
    fetchUsdToZarRate(),
  ]);
  // The Yahoo futures quotes are consistently USD in practice — only convert when the
  // source actually says so, rather than assuming, so a currency change upstream can't
  // silently produce a wrong ZAR figure.
  const prices: MetalPrice[] = results
    .filter((r): r is Omit<MetalPrice, "priceZar"> => r !== null)
    .map((p) => ({
      ...p,
      priceZar: fxRateUsdZar && p.currency === "USD" ? Math.round(p.price * fxRateUsdZar * 100) / 100 : null,
    }));
  const insight = await generatePriceInsight(prices);
  const payload: MineralPricesPayload = {
    asOf: new Date().toISOString(),
    prices,
    fxRateUsdZar,
    insight,
    disclaimer: insight ? PRICE_INSIGHT_DISCLAIMER : null,
  };
  // Cache even a partial/empty result briefly, so a source outage doesn't cause every
  // concurrent dashboard load to hammer it in lockstep — the client already treats an
  // empty list as "no data available" rather than an error.
  priceCache = { data: payload, expiresAt: Date.now() + PRICE_TTL_MS };
  res.json(payload);
});

// ---------------------------------------------------------------------------
// Industry news — latest South African mining/government-regulatory headlines via
// Google News' public RSS search (free, no API key; explicitly a public syndication
// feature rather than scraping). Not scoped to a mine. Each headline gets an optional
// AI-generated summary, expanded once per NEWS_TTL_MS window (not per click) from the
// title + RSS snippet only — never the full article, which isn't fetched at all.
// ---------------------------------------------------------------------------

interface IndustryNewsItem {
  title: string;
  link: string;
  source: string | null;
  publishedAt: string | null;
  snippet: string | null;
  summary: string | null;
}

interface IndustryNewsPayload {
  items: IndustryNewsItem[];
  disclaimer: string | null;
}

const NEWS_RSS_URL =
  "https://news.google.com/rss/search?q=south%20africa%20mining%20OR%20%22department%20of%20mineral%20resources%22%20OR%20MHSA%20mining&hl=en-ZA&gl=ZA&ceid=ZA:en";
const NEWS_ITEM_LIMIT = 3;

const NEWS_SUMMARY_DISCLAIMER =
  "Summaries are AI-generated from the headline and snippet provided by the news source only — not the full " +
  "article — and may be incomplete or miss context. Please read the original article before relying on this.";

async function fetchIndustryNewsRaw(): Promise<IndustryNewsItem[]> {
  try {
    const res = await fetch(NEWS_RSS_URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; MineGuardBot/1.0)" } });
    if (!res.ok) return [];
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const data = parser.parse(xml);
    const rawItems = data?.rss?.channel?.item;
    const rawList: any[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

    return rawList
      .slice(0, NEWS_ITEM_LIMIT)
      .map((item): IndustryNewsItem => {
        const rawTitle = typeof item.title === "string" ? item.title : String(item.title ?? "");
        // Google News formats titles as "Headline - Source" — split that out for a clean
        // source label rather than showing the source name twice.
        const dashIndex = rawTitle.lastIndexOf(" - ");
        const sourceTag = typeof item.source === "object" ? item.source?.["#text"] : item.source;
        return {
          title: dashIndex > 0 ? rawTitle.slice(0, dashIndex) : rawTitle,
          link: typeof item.link === "string" ? item.link : "",
          source: (typeof sourceTag === "string" && sourceTag) || (dashIndex > 0 ? rawTitle.slice(dashIndex + 3) : null),
          publishedAt: typeof item.pubDate === "string" ? item.pubDate : null,
          snippet: typeof item.description === "string" ? item.description.replace(/<[^>]+>/g, "").trim() || null : null,
          summary: null,
        };
      })
      .filter((i) => i.title && i.link);
  } catch {
    return [];
  }
}

// One AI call per cache window covering every headline at once (not one call per item, and
// never a click-triggered call) — cheap regardless of how many users open the news panel.
async function generateNewsSummaries(items: IndustryNewsItem[]): Promise<IndustryNewsItem[]> {
  if (!isAiConfigured() || items.length === 0) return items;
  try {
    const messages: AiMessage[] = [
      {
        role: "system",
        content:
          `You are the Mine Guard AI Assistant. For each news item below (identified by its 0-based index), write a ` +
          `2-3 sentence plain-language summary of what the headline and snippet suggest the article covers. Base it ` +
          `ONLY on the title and snippet given — never invent names, figures, or details not present in them. If the ` +
          `snippet is too thin to add anything beyond the headline, say that plainly rather than guessing. Reply with ` +
          `ONLY a JSON object mapping each index (as a string key) to its summary string, no markdown, no extra keys.` +
          GUARDRAIL,
      },
      {
        role: "user",
        content: `News items (JSON): ${JSON.stringify(items.map((i, idx) => ({ index: idx, title: i.title, snippet: i.snippet })))}`,
      },
    ];
    const raw = await aiChatComplete(messages);
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned);
    return items.map((item, idx) => ({
      ...item,
      summary: typeof parsed[String(idx)] === "string" ? parsed[String(idx)].slice(0, 500) : null,
    }));
  } catch {
    return items;
  }
}

router.get("/industry-news", async (_req, res) => {
  if (newsCache && newsCache.expiresAt > Date.now()) {
    return res.json(newsCache.data);
  }
  const rawItems = await fetchIndustryNewsRaw();
  const items = await generateNewsSummaries(rawItems);
  const payload: IndustryNewsPayload = {
    items,
    disclaimer: items.some((i) => i.summary) ? NEWS_SUMMARY_DISCLAIMER : null,
  };
  newsCache = { data: payload, expiresAt: Date.now() + NEWS_TTL_MS };
  res.json(payload);
});

// ---------------------------------------------------------------------------
// "Did you know" — a curated fact rotates on a fixed 12-hour clock (roughly
// twice a day), picked deterministically from the current time so every
// caller sees the same fact in the same window with no stored state at all.
// ---------------------------------------------------------------------------

const DID_YOU_KNOW_FACTS: string[] = [
  "South Africa produces about 70% of the world's platinum, mostly from the Bushveld Igneous Complex — the largest layered igneous intrusion on Earth.",
  "The Mine Health and Safety Act (MHSA) of 1996 gives every worker the right to refuse to work in conditions they reasonably believe are dangerous, without being penalised.",
  "TauTona mine near Carletonville was once the deepest mine in the world, reaching roughly 3.9 km below surface — deep enough that rock temperatures exceed 60°C before cooling systems.",
  "The Witwatersrand Basin has produced over 40% of all the gold ever mined on Earth since large-scale mining began there in 1886.",
  "A canary was historically used to detect carbon monoxide and other toxic gases in mines — birds are far more sensitive to low oxygen than humans, giving miners early warning.",
  "South Africa's Kimberley Big Hole was dug almost entirely by hand and pick by up to 50,000 miners, and is one of the largest hand-dug excavations in the world.",
  "Chromite mining in South Africa's Bushveld Complex supplies roughly 40% of the world's chromium, essential for stainless steel production.",
  "The 'canary in a coal mine' idiom lives on in modern gas detectors — today's electronic sensors do the same job in seconds instead of minutes.",
  "South Africa holds the world's largest known reserves of manganese, platinum-group metals, chromium, and gold combined.",
  "Silicosis, caused by inhaling fine silica dust, remains one of the most significant occupational lung diseases in hard-rock mining — proper ventilation and wet drilling techniques dramatically reduce the risk.",
  "The Merensky Reef, discovered in 1924, remains one of the richest platinum-bearing ore bodies ever found and is still mined today.",
  "Rock bursts — sudden violent failures of stressed rock — are a leading cause of underground seismic incidents in deep South African gold and platinum mines, which is why seismic monitoring networks are now standard practice.",
  "South Africa's coalfields, concentrated mainly in Mpumalanga, supply over 80% of the country's electricity generation feedstock.",
  "Diamond-bearing kimberlite pipes are named after Kimberley, South Africa — the site of the original 1871 diamond rush.",
  "Refuge bays in underground mines are stocked with enough compressed air, water, and food to keep trapped workers alive for 24 hours or more while rescue teams respond.",
  "The Merensky and UG2 reefs of the Bushveld Complex together host over 90% of the world's economically viable platinum-group metal reserves.",
  "Proto teams (mine rescue brigades) are named after the Proto breathing apparatus, self-contained oxygen systems that let rescuers work in irrespirable underground atmospheres.",
  "South Africa was the first country in the world to make HIV/AIDS workplace policies compulsory for the mining sector, given the industry's historically high prevalence among migrant labour.",
  "A single ounce of gold can be beaten into a sheet covering nearly 9 square metres — thinner than a human hair — because of gold's exceptional malleability.",
  "Ventilation shafts in deep mines can move millions of cubic metres of air per day to keep underground temperatures within safe working limits.",
  "The Council for Geoscience maintains South Africa's national seismic network, which also monitors mining-induced tremors across the Witwatersrand basin.",
  "Copper is such an efficient conductor that it's used in nearly every electrical system on a mine site, from underground cabling to control-room wiring.",
  "South Africa's iron ore exports, mostly from the Northern Cape's Sishen mine, make it one of the top five iron ore exporters in the world.",
  "Emergency evacuation drills are legally required at South African mines specifically so that, in a real event, workers move to assembly points by muscle memory rather than working it out under stress.",
];

router.get("/did-you-know", (_req, res) => {
  const bucket = Math.floor(Date.now() / (12 * 60 * 60 * 1000));
  const fact = DID_YOU_KNOW_FACTS[bucket % DID_YOU_KNOW_FACTS.length];
  res.json({ fact });
});

export default router;
