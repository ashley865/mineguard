import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, CartesianGrid } from "recharts";
import { api } from "../api/client";
import { DidYouKnowResponse, ExecutiveTitle, MineralPricesResponse, MetalPrice, SiteWeatherReading } from "../api/types";
import SiteLocationMap from "./SiteLocationMap";

// A deliberately distinct "live terminal" look — dark navy rather than the app's
// otherwise light theme — so this panel reads as live/real-time data at a glance,
// the same way stock tickers and weather panels conventionally do.
const NAVY_TOOLTIP_STYLE = { background: "#0f1f38", border: "1px solid rgba(255,255,255,0.12)", fontSize: 11, borderRadius: 8, color: "#fff" };
const NAVY_TICK_STYLE = { fontSize: 10, fill: "rgba(255,255,255,0.55)", fontWeight: 600 };

type Tier = "up" | "down" | "flat";
function tierOf(changePercent: number): Tier {
  if (changePercent > 0.15) return "up";
  if (changePercent < -0.15) return "down";
  return "flat";
}
const TIER_HEX: Record<Tier, string> = { up: "#16a34a", down: "#e13b2e", flat: "#d9a441" };
const TIER_TEXT: Record<Tier, string> = { up: "text-success-400", down: "text-danger-400", flat: "text-hazard-400" };
const TIER_BORDER: Record<Tier, string> = { up: "border-success-500/40", down: "border-danger-500/40", flat: "border-hazard-500/40" };

function WeatherIcon({ icon, className }: { icon: string; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (icon) {
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8" />
        </svg>
      );
    case "cloud-sun":
      return (
        <svg {...common}>
          <circle cx="7.5" cy="8" r="3" />
          <path d="M7.5 2.5v1.5M3.4 4.4l1 1M2 8h1.5M12 8h1.5" />
          <path d="M8 14.5h8a3.5 3.5 0 0 0 0-7 4.8 4.8 0 0 0-8.9-1.8A4 4 0 0 0 6.5 13" />
        </svg>
      );
    case "rain":
      return (
        <svg {...common}>
          <path d="M6.5 11.5h11a3.5 3.5 0 0 0 0-7 4.8 4.8 0 0 0-9-1.5A4 4 0 0 0 5 10.7" />
          <path d="M8 15.5l-1 3M12 15.5l-1 3M16 15.5l-1 3" />
        </svg>
      );
    case "storm":
      return (
        <svg {...common}>
          <path d="M6.5 10.5h11a3.5 3.5 0 0 0 0-7 4.8 4.8 0 0 0-9-1.5A4 4 0 0 0 5 9.7" />
          <path d="M12.5 13l-3 5h3l-1.5 4.5 4.5-6h-3l1.5-3.5z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "fog":
      return (
        <svg {...common}>
          <path d="M7 8.5h9a3 3 0 0 0 0-6 4.2 4.2 0 0 0-7.9-1.2" />
          <path d="M4 13h16M4 17h16M4 21h16" />
        </svg>
      );
    case "snow":
      return (
        <svg {...common}>
          <path d="M6.5 11.5h11a3.5 3.5 0 0 0 0-7 4.8 4.8 0 0 0-9-1.5A4 4 0 0 0 5 10.7" />
          <path d="M9 16v6M6 18.5l6 3M12 18.5l-6 3M15 16v6M12 18.5l6 3M18 18.5l-6 3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M6.5 11.5h11a3.5 3.5 0 0 0 0-7 4.8 4.8 0 0 0-9-1.5A4 4 0 0 0 5 10.7" />
        </svg>
      );
  }
}

function isWeatherSevere(reading: SiteWeatherReading): boolean {
  return reading.weather.icon === "storm" || reading.weather.windSpeedKmh >= 40;
}

function WeatherCard({ reading }: { reading: SiteWeatherReading }) {
  const { t } = useTranslation();
  const { weather } = reading;
  const severe = isWeatherSevere(reading);
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 flex items-center gap-3 min-w-[168px] backdrop-blur-sm ${
        severe ? "border-danger-500/50 bg-danger-500/10" : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <WeatherIcon icon={weather.icon} className={`w-8 h-8 shrink-0 ${severe ? "text-danger-400" : "text-hazard-400"}`} />
      <div className="min-w-0">
        <div className="text-[10px] text-white/50 uppercase tracking-wide truncate">{reading.siteName}</div>
        <div className="text-lg font-bold leading-tight text-white">{Math.round(weather.temperatureC)}°C</div>
        <div className="text-[10px] text-white/60 truncate">{weather.condition}</div>
        <div className={`text-[10px] mt-0.5 ${severe ? "text-danger-300 font-semibold" : "text-white/50"}`}>
          {t("liveData.wind")} {Math.round(weather.windSpeedKmh)} km/h · {t("liveData.humidity")} {Math.round(weather.humidityPct)}%
        </div>
      </div>
    </div>
  );
}

// ZAR is the primary figure (this is a South African mining app), USD secondary —
// falls back to USD-only when no FX rate was available for this cache window.
function priceLines(p: MetalPrice): { primary: string; secondary: string | null } {
  const usd = `${p.currency ?? "USD"} ${p.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${p.unit}`;
  if (p.priceZar == null) return { primary: usd, secondary: null };
  const zar = `ZAR ${p.priceZar.toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${p.unit}`;
  return { primary: zar, secondary: usd };
}

function PriceChangeTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p: MetalPrice = payload[0].payload;
  const tier = tierOf(p.changePercent);
  const lines = priceLines(p);
  return (
    <div style={NAVY_TOOLTIP_STYLE} className="px-2.5 py-1.5">
      <div className="font-bold">{p.label}</div>
      <div className="text-white/60">{lines.primary}</div>
      {lines.secondary && <div className="text-white/40 text-[10px]">{lines.secondary}</div>}
      <div className={`font-semibold ${TIER_TEXT[tier]}`}>
        {p.changePercent >= 0 ? "+" : ""}
        {p.changePercent}%
      </div>
    </div>
  );
}

// Mineral/commodity prices are financially/operationally relevant to only some
// executive titles — everyone else sees weather, the fact of the day, and industry
// news, but not price data that isn't meaningful to their role.
export const MINERAL_PRICE_RELEVANT_TITLES: ExecutiveTitle[] = ["GENERAL_MANAGER", "CFO", "COO", "OPERATIONS_MANAGER"];

export default function LiveDataWidget({ showMineralPrices = false }: { showMineralPrices?: boolean }) {
  const { t } = useTranslation();
  const [weather, setWeather] = useState<SiteWeatherReading[]>([]);
  const [prices, setPrices] = useState<MineralPricesResponse | null>(null);
  const [fact, setFact] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [w, p, f] = await Promise.all([
        api.get<SiteWeatherReading[]>("/live-data/weather").then((r) => r.data).catch(() => []),
        showMineralPrices
          ? api.get<MineralPricesResponse>("/live-data/mineral-prices").then((r) => r.data).catch(() => null)
          : Promise.resolve(null),
        api.get<DidYouKnowResponse>("/live-data/did-you-know").then((r) => r.data).catch(() => null),
      ]);
      if (cancelled) return;
      setWeather(w);
      setPrices(p);
      setFact(f?.fact ?? null);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMineralPrices]);

  if (loading) return null;

  const hasWeather = weather.length > 0;
  const hasPrices = showMineralPrices && !!prices && prices.prices.length > 0;
  if (!hasWeather && !hasPrices && !fact) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a1628] via-[#0f2140] to-[#0a1628] shadow-xl shadow-black/30">
      <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 rounded-full bg-hazard-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 w-56 h-56 rounded-full bg-success-500/10 blur-3xl" />

      <div className="relative p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500" />
          </span>
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-white">{t("liveData.title")}</h2>
        </div>

        {fact && (
          <div className="rounded-lg border border-hazard-500/30 bg-hazard-500/[0.08] p-3">
            <div className="flex items-start gap-2.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-md bg-hazard-500 text-white text-[10px] font-extrabold shrink-0 mt-0.5">
                ?
              </span>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wide text-hazard-400 mb-0.5">
                  {t("liveData.didYouKnow")}
                </div>
                <p className="text-xs text-white/90 font-medium leading-relaxed">{fact}</p>
              </div>
            </div>
          </div>
        )}

        {hasWeather && (
          <div>
            <div className="text-[10px] text-white/40 uppercase tracking-wide mb-1.5">{t("liveData.weather")}</div>
            <div className="flex gap-2 overflow-x-auto pb-1 mb-2">
              {weather.map((w) => (
                <WeatherCard key={w.siteId} reading={w} />
              ))}
            </div>
            <SiteLocationMap sites={weather} />
          </div>
        )}

        {hasPrices && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10px] text-white/40 uppercase tracking-wide">{t("liveData.mineralPrices")}</div>
              <div className="text-[10px] text-white/40">
                {t("liveData.asOf", { date: new Date(prices!.asOf).toLocaleTimeString() })}
              </div>
            </div>

            <div className="h-44 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prices!.prices} margin={{ top: 14, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="label" tick={NAVY_TICK_STYLE} axisLine={{ stroke: "rgba(255,255,255,0.15)" }} tickLine={false} />
                  <YAxis tick={NAVY_TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={36} />
                  <Tooltip content={<PriceChangeTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                  <Bar dataKey="changePercent" radius={[6, 6, 6, 6]} maxBarSize={34}>
                    {prices!.prices.map((p) => (
                      <Cell key={p.key} fill={TIER_HEX[tierOf(p.changePercent)]} />
                    ))}
                    <LabelList
                      dataKey="changePercent"
                      position="top"
                      formatter={(v: number) => `${v >= 0 ? "+" : ""}${v}%`}
                      style={{ fontSize: 9, fontWeight: 700, fill: "rgba(255,255,255,0.75)" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2">
              {prices!.prices.map((p) => {
                const tier = tierOf(p.changePercent);
                const lines = priceLines(p);
                return (
                  <div key={p.key} className={`rounded-md border-l-2 bg-white/[0.04] px-2 py-1.5 ${TIER_BORDER[tier]}`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-white/50 uppercase tracking-wide truncate">{p.label}</span>
                      <span className={`text-[10px] font-bold ${TIER_TEXT[tier]}`}>
                        {p.changePercent >= 0 ? "+" : ""}
                        {p.changePercent}%
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white truncate">{lines.primary}</div>
                    {lines.secondary && <div className="text-[10px] text-white/40 truncate">{lines.secondary}</div>}
                  </div>
                );
              })}
            </div>

            {prices!.insight && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-hazard-500 text-white text-[9px] font-extrabold shrink-0 mt-0.5">
                  AI
                </span>
                <p className="text-[11px] text-white/85 font-medium leading-relaxed italic">{prices!.insight}</p>
              </div>
            )}
            {prices!.disclaimer && (
              <p className="text-[10px] text-white/35 leading-relaxed mt-2">{prices!.disclaimer}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
