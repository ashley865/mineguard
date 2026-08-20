import { Router } from "express";
import { XMLParser } from "fast-xml-parser";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { aiChatComplete, AiMessage, isAiConfigured } from "../lib/ai";
import { GUARDRAIL } from "./ai";
import { resolveSetting } from "../lib/systemSettings";

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
//
// Prefers the site's postal code (via the same curated/reliable lookup used for the mine's
// HQ weather below) over a free-text place-name search: `location` is a human-written
// description ("Head Office", "North Pit") that Open-Meteo's name search can match against
// a same-named place anywhere on Earth, which is what used to make the site map zoom out
// to fit a wildly wrong point instead of staying tight on the mine's actual sites.
async function resolveSiteCoordinates(site: {
  id: string;
  location: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
}): Promise<{ lat: number; lon: number } | null> {
  if (site.latitude != null && site.longitude != null) {
    return { lat: site.latitude, lon: site.longitude };
  }
  const coords = site.postalCode ? await geocodePostalCode(site.postalCode) : await geocodeLocation(site.location);
  if (!coords) return null;
  await prisma.site
    .update({
      where: { id: site.id },
      data: { latitude: coords.lat, longitude: coords.lon, geocodedAt: new Date() },
    })
    .catch(() => {});
  return coords;
}

// A South African postal code isn't a reliable query for a name-based geocoder (Open-Meteo's
// geocoding search matches place names, not postal codes), so well-known codes — covering the
// major metros and mining hubs — are resolved from this curated table first. Anything not
// listed here falls back to a best-effort name search before giving up.
const SA_POSTAL_CODE_COORDS: Record<string, { lat: number; lon: number }> = {
  "2000": { lat: -26.2041, lon: 28.0473 }, // Johannesburg CBD
  "2001": { lat: -26.2044, lon: 28.0456 }, // Marshalltown
  "2094": { lat: -26.1855, lon: 28.0074 }, // Melville / Auckland Park, Johannesburg
  "2107": { lat: -26.0939, lon: 27.9994 }, // Randburg
  "1401": { lat: -26.2125, lon: 28.254 }, // Boksburg
  "1501": { lat: -26.2506, lon: 28.4406 }, // Springs
  "1709": { lat: -26.1625, lon: 27.8727 }, // Roodepoort
  "1685": { lat: -25.9992, lon: 28.1264 }, // Midrand
  "0001": { lat: -25.7479, lon: 28.2293 }, // Pretoria Central
  "0084": { lat: -25.7826, lon: 28.2773 }, // Pretoria (Menlyn)
  "4001": { lat: -29.8587, lon: 31.0218 }, // Durban Central
  "4301": { lat: -29.8149, lon: 30.8676 }, // Pinetown
  "3201": { lat: -29.6006, lon: 30.3794 }, // Pietermaritzburg
  "8000": { lat: -33.9249, lon: 18.4241 }, // Cape Town Central
  "7530": { lat: -33.9, lon: 18.6292 }, // Bellville
  "7100": { lat: -34.0836, lon: 18.8501 }, // Somerset West
  "9301": { lat: -29.0852, lon: 26.1596 }, // Bloemfontein
  "2570": { lat: -26.8523, lon: 26.6668 }, // Klerksdorp
  "2571": { lat: -26.9808, lon: 26.6817 }, // Orkney
  "2745": { lat: -25.6672, lon: 27.2424 }, // Rustenburg
  "8301": { lat: -28.7282, lon: 24.7499 }, // Kimberley
  "1035": { lat: -25.8712, lon: 29.2341 }, // Emalahleni (Witbank)
  "2400": { lat: -27.9769, lon: 26.7311 }, // Welkom
  "6000": { lat: -33.9608, lon: 25.6022 }, // Gqeberha (Port Elizabeth)
  "2740": { lat: -23.9425, lon: 31.1367 }, // Phalaborwa
  "8460": { lat: -28.325, lon: 23.0631 }, // Postmasburg
  "8801": { lat: -27.6975, lon: 23.0419 }, // Kathu
  "1200": { lat: -25.4753, lon: 30.9694 }, // Mbombela (Nelspruit)
  "0699": { lat: -23.9045, lon: 29.4689 }, // Polokwane
  "1350": { lat: -25.7748, lon: 29.4644 }, // Middelburg
  "2499": { lat: -28.1258, lon: 26.855 }, // Virginia (Free State goldfields)
  "8467": { lat: -27.4534, lon: 23.4322 }, // Kuruman
};

async function geocodePostalCode(postalCode: string): Promise<{ lat: number; lon: number } | null> {
  const trimmed = postalCode.trim();
  const known = SA_POSTAL_CODE_COORDS[trimmed];
  if (known) return known;
  return geocodeLocation(`${trimmed}, South Africa`);
}

// Same cache-once-and-persist pattern as resolveSiteCoordinates above, but for the mine's
// single HQ postal code rather than a per-site address.
async function resolveMineWeatherCoordinates(mine: {
  id: string;
  weatherPostalCode: string;
  weatherLatitude: number | null;
  weatherLongitude: number | null;
}): Promise<{ lat: number; lon: number } | null> {
  if (mine.weatherLatitude != null && mine.weatherLongitude != null) {
    return { lat: mine.weatherLatitude, lon: mine.weatherLongitude };
  }
  const coords = await geocodePostalCode(mine.weatherPostalCode);
  if (!coords) return null;
  await prisma.mine
    .update({
      where: { id: mine.id },
      data: { weatherLatitude: coords.lat, weatherLongitude: coords.lon, weatherGeocodedAt: new Date() },
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
  const [mine, sites] = await Promise.all([
    prisma.mine.findUnique({
      where: { id: mineId },
      select: { id: true, name: true, weatherPostalCode: true, weatherLatitude: true, weatherLongitude: true },
    }),
    prisma.site.findMany({
      where: { mineId },
      select: { id: true, name: true, location: true, postalCode: true, latitude: true, longitude: true },
      take: 8,
      orderBy: { name: "asc" },
    }),
  ]);

  const mineHqResult = mine
    ? await (async () => {
        const coords = await resolveMineWeatherCoordinates(mine);
        const cacheKey = `mine-hq-${mine.id}`;
        return {
          siteId: cacheKey,
          siteName: mine.name,
          latitude: coords?.lat ?? null,
          longitude: coords?.lon ?? null,
          weather: coords ? await fetchSiteWeather(cacheKey, coords) : null,
          isHeadquarters: true,
        };
      })()
    : null;

  const siteResults = await Promise.all(
    sites.map(async (site) => {
      const coords = await resolveSiteCoordinates(site);
      return {
        siteId: site.id,
        siteName: site.name,
        latitude: coords?.lat ?? null,
        longitude: coords?.lon ?? null,
        weather: coords ? await fetchSiteWeather(site.id, coords) : null,
        isHeadquarters: false,
      };
    })
  );

  const results = [...(mineHqResult ? [mineHqResult] : []), ...siteResults];
  res.json(results.filter((r) => r.weather !== null));
});

// ---------------------------------------------------------------------------
// Mineral / commodity spot prices — the 11 commodities South Africa is most known
// for mining (mirrors the MineralType enum used elsewhere in the app, minus the
// non-metallic/lower-profile entries). Not scoped to a mine, so no requireMineId
// here — same data for every caller, hence the single shared module-level cache
// rather than a per-mine one.
//
// Several of these (chrome, manganese, diamond, zinc, nickel) have no free,
// retail-accessible spot-price feed — diamonds in particular aren't a fungible,
// exchange-traded commodity at all, and the others require a paid Fastmarkets/
// Argus/Platts subscription. Those entries carry no `symbol` and are returned
// with `available: false` rather than a guessed/fabricated number, so the client
// can show all 11 while being honest about which have a live price.
// ---------------------------------------------------------------------------

const COMMODITY_SYMBOLS: { symbol?: string; key: string; unit: string }[] = [
  { symbol: "GC=F", key: "GOLD", unit: "oz" },
  { symbol: "PL=F", key: "PLATINUM_GROUP_METALS", unit: "oz" },
  { key: "DIAMOND", unit: "carat" },
  { symbol: "MTF=F", key: "COAL", unit: "tonne" },
  { symbol: "TIO=F", key: "IRON_ORE", unit: "tonne" },
  { key: "CHROME", unit: "tonne" },
  { key: "MANGANESE", unit: "tonne" },
  { symbol: "HG=F", key: "COPPER", unit: "lb" },
  { key: "ZINC", unit: "tonne" },
  { key: "NICKEL", unit: "tonne" },
  { symbol: "UX=F", key: "URANIUM", unit: "lb" },
];

interface MetalPrice {
  key: string;
  unit: string;
  available: boolean;
  price: number | null;
  priceZar: number | null;
  previousClose: number | null;
  changePercent: number | null;
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
  if (!(await isAiConfigured()) || prices.length === 0) return null;
  try {
    const messages: AiMessage[] = [
      {
        role: "system",
        content:
          `You are the Mine Guard AI Assistant. Given a snapshot of South African mining commodity spot prices, ` +
          `write exactly ONE short sentence (max 30 words) of plain-language, purely descriptive commentary on ` +
          `what's notable in the snapshot — which commodities moved most and in which direction. Never recommend ` +
          `buying, selling, holding, or trading anything. Never predict future prices. Never use words like ` +
          `"should", "opportunity", "buy", or "sell". Reply with ONLY the sentence, no markdown, no quotes.` +
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

// Optional, more authoritative current-price source layered on top of the free Yahoo feed
// above rather than replacing it — metals-api.com's /latest endpoint only gives a current
// snapshot (no previousClose without a second, quota-costing call), so Yahoo's
// previousClose is still used for the % change calculation even when this is configured.
// Dormant (silently skipped) whenever METALS_API_KEY isn't set, same pattern as AI_API_KEY.
const METALS_API_SYMBOLS: Record<string, string> = {
  GOLD: "XAU",
  PLATINUM_GROUP_METALS: "XPT",
  COPPER: "XCU",
};

async function fetchMetalsApiPrices(): Promise<Record<string, number> | null> {
  const apiKey = await resolveSetting("METALS_API_KEY");
  if (!apiKey) return null;
  try {
    const symbols = Object.values(METALS_API_SYMBOLS).join(",");
    const url = `https://metals-api.com/api/latest?access_key=${apiKey}&base=USD&symbols=${symbols}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: any = await res.json();
    if (!data?.success || !data?.rates) return null;
    // metals-api quotes metals like forex currencies against the base — rates.XAU is "how
    // many ounces of gold equal 1 USD", so the USD price per ounce is the inverse.
    const prices: Record<string, number> = {};
    for (const [key, symbol] of Object.entries(METALS_API_SYMBOLS)) {
      const rate = data.rates[symbol];
      if (typeof rate === "number" && rate > 0) {
        prices[key] = 1 / rate;
      }
    }
    return Object.keys(prices).length > 0 ? prices : null;
  } catch {
    return null;
  }
}

const UNAVAILABLE_PRICE: Omit<MetalPrice, "key" | "unit"> = {
  available: false,
  price: null,
  priceZar: null,
  previousClose: null,
  changePercent: null,
  currency: null,
};

async function fetchCommodityQuote(c: { symbol?: string; key: string; unit: string }): Promise<MetalPrice> {
  if (!c.symbol) return { key: c.key, unit: c.unit, ...UNAVAILABLE_PRICE };
  const quote = await fetchYahooQuote(c.symbol);
  if (!quote) return { key: c.key, unit: c.unit, ...UNAVAILABLE_PRICE };
  return {
    key: c.key,
    unit: c.unit,
    available: true,
    price: quote.price,
    priceZar: null, // filled in below once the FX rate is known
    previousClose: quote.previousClose,
    changePercent: 0, // recomputed below once the final (possibly metals-api-overridden) price is known
    currency: quote.currency,
  };
}

router.get("/mineral-prices", async (_req, res) => {
  if (priceCache && priceCache.expiresAt > Date.now()) {
    return res.json(priceCache.data);
  }
  const [quotes, fxRateUsdZar, metalsApiPrices] = await Promise.all([
    Promise.all(COMMODITY_SYMBOLS.map(fetchCommodityQuote)),
    fetchUsdToZarRate(),
    fetchMetalsApiPrices(),
  ]);
  // The Yahoo futures quotes are consistently USD in practice — only convert when the
  // source actually says so, rather than assuming, so a currency change upstream can't
  // silently produce a wrong ZAR figure. When metals-api.com is configured, its current
  // price replaces Yahoo's for that commodity (more authoritative), but Yahoo's
  // previousClose is still what % change is measured against either way.
  const prices: MetalPrice[] = quotes.map((p) => {
    if (!p.available || p.price == null) return p;
    const price = metalsApiPrices?.[p.key] ?? p.price;
    const changePercent = p.previousClose ? ((price - p.previousClose) / p.previousClose) * 100 : 0;
    return {
      ...p,
      price: Math.round(price * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      priceZar: fxRateUsdZar && p.currency === "USD" ? Math.round(price * fxRateUsdZar * 100) / 100 : null,
    };
  });
  const insight = await generatePriceInsight(prices.filter((p) => p.available));
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
  if (!(await isAiConfigured()) || items.length === 0) return items;
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
