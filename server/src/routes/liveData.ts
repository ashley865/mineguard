import { Router } from "express";
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

const geocodeCache = new Map<string, { lat: number; lon: number } | null>();
const weatherCache = new Map<string, CacheEntry<SiteWeather>>();
let priceCache: CacheEntry<MineralPricesPayload> | null = null;

async function geocodeLocation(location: string): Promise<{ lat: number; lon: number } | null> {
  if (geocodeCache.has(location)) return geocodeCache.get(location)!;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) {
      geocodeCache.set(location, null);
      return null;
    }
    const data: any = await res.json();
    const first = data?.results?.[0];
    const result = first ? { lat: first.latitude, lon: first.longitude } : null;
    geocodeCache.set(location, result);
    return result;
  } catch {
    geocodeCache.set(location, null);
    return null;
  }
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

async function fetchSiteWeather(siteId: string, location: string): Promise<SiteWeather | null> {
  const hit = weatherCache.get(siteId);
  if (hit && hit.expiresAt > Date.now()) return hit.data;

  const coords = await geocodeLocation(location);
  if (!coords) return null;

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
    select: { id: true, name: true, location: true },
    take: 8,
    orderBy: { name: "asc" },
  });
  const results = await Promise.all(
    sites.map(async (site) => ({
      siteId: site.id,
      siteName: site.name,
      weather: await fetchSiteWeather(site.id, site.location),
    }))
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
  previousClose: number | null;
  changePercent: number;
  currency: string | null;
}

interface MineralPricesPayload {
  asOf: string;
  prices: MetalPrice[];
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
  const results = await Promise.all(
    METAL_SYMBOLS.map(async (m): Promise<MetalPrice | null> => {
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
  );
  const prices = results.filter((r): r is MetalPrice => r !== null);
  const insight = await generatePriceInsight(prices);
  const payload: MineralPricesPayload = {
    asOf: new Date().toISOString(),
    prices,
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
