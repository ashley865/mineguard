import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { api } from "../api/client";
import { DidYouKnowResponse, MineralPricesResponse, MetalPrice, SiteWeatherReading } from "../api/types";
import { cardClass } from "./ui";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11, borderRadius: 8 };
const CHART_TICK_STYLE = { fontSize: 10, fill: "#52525b", fontWeight: 600 };

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

function WeatherCard({ reading }: { reading: SiteWeatherReading }) {
  const { t } = useTranslation();
  const { weather } = reading;
  return (
    <div className={`${cardClass} px-3 py-2.5 flex items-center gap-3 min-w-[160px]`}>
      <WeatherIcon icon={weather.icon} className="w-8 h-8 text-hazard-500 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] text-mine-300 uppercase tracking-wide truncate">{reading.siteName}</div>
        <div className="text-lg font-bold leading-tight">{Math.round(weather.temperatureC)}°C</div>
        <div className="text-[10px] text-mine-400 truncate">{weather.condition}</div>
        <div className="text-[10px] text-mine-400 mt-0.5">
          {t("liveData.wind")} {Math.round(weather.windSpeedKmh)} km/h · {t("liveData.humidity")} {Math.round(weather.humidityPct)}%
        </div>
      </div>
    </div>
  );
}

function priceCurrencyLabel(p: MetalPrice) {
  const amount = p.price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${p.currency ?? "USD"} ${amount} / ${p.unit}`;
}

function PriceChangeTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p: MetalPrice = payload[0].payload;
  return (
    <div style={CHART_TOOLTIP_STYLE} className="px-2.5 py-1.5">
      <div className="font-bold text-mine-50">{p.label}</div>
      <div className="text-mine-600">{priceCurrencyLabel(p)}</div>
      <div className={p.changePercent >= 0 ? "text-success-600 font-semibold" : "text-danger-600 font-semibold"}>
        {p.changePercent >= 0 ? "+" : ""}
        {p.changePercent}%
      </div>
    </div>
  );
}

export default function LiveDataWidget() {
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
        api.get<MineralPricesResponse>("/live-data/mineral-prices").then((r) => r.data).catch(() => null),
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
  }, []);

  if (loading) return null;

  const hasWeather = weather.length > 0;
  const hasPrices = !!prices && prices.prices.length > 0;
  if (!hasWeather && !hasPrices && !fact) return null;

  return (
    <div className="space-y-3">
      {fact && (
        <div className="relative overflow-hidden rounded-xl border-2 border-hazard-500/30 bg-gradient-to-br from-hazard-500/10 via-transparent to-transparent p-3.5">
          <div className="flex items-start gap-2.5">
            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-hazard-500 text-white text-[10px] font-extrabold shrink-0 mt-0.5">
              ?
            </span>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wide text-hazard-600 mb-0.5">
                {t("liveData.didYouKnow")}
              </div>
              <p className="text-xs text-mine-100 font-semibold leading-relaxed">{fact}</p>
            </div>
          </div>
        </div>
      )}

      {(hasWeather || hasPrices) && (
        <div className={`${cardClass} p-3.5`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-mine-200">{t("liveData.title")}</h2>
          </div>

          {hasWeather && (
            <div className="mb-4">
              <div className="text-[10px] text-mine-400 uppercase tracking-wide mb-1.5">{t("liveData.weather")}</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {weather.map((w) => (
                  <WeatherCard key={w.siteId} reading={w} />
                ))}
              </div>
            </div>
          )}

          {hasPrices && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] text-mine-400 uppercase tracking-wide">{t("liveData.mineralPrices")}</div>
                <div className="text-[10px] text-mine-400">
                  {t("liveData.asOf", { date: new Date(prices!.asOf).toLocaleTimeString() })}
                </div>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={prices!.prices} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="priceUp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#16a34a" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#16a34a" stopOpacity={0.55} />
                      </linearGradient>
                      <linearGradient id="priceDown" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e13b2e" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#e13b2e" stopOpacity={0.55} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={CHART_TICK_STYLE} axisLine={{ stroke: "#e5e5e5" }} tickLine={false} />
                    <YAxis tick={CHART_TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={38} />
                    <Tooltip content={<PriceChangeTooltip />} cursor={{ fill: "rgba(196,138,31,0.06)" }} />
                    <Bar dataKey="changePercent" radius={[6, 6, 6, 6]} maxBarSize={36}>
                      {prices!.prices.map((p) => (
                        <Cell key={p.key} fill={p.changePercent >= 0 ? "url(#priceUp)" : "url(#priceDown)"} />
                      ))}
                      <LabelList
                        dataKey="changePercent"
                        position="top"
                        formatter={(v: number) => `${v >= 0 ? "+" : ""}${v}%`}
                        style={{ fontSize: 9, fontWeight: 700, fill: "#52525b" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2">
                {prices!.prices.map((p) => (
                  <div key={p.key} className="border border-mine-800 rounded-md px-2 py-1.5">
                    <div className="text-[10px] text-mine-400 uppercase tracking-wide truncate">{p.label}</div>
                    <div className="text-xs font-bold text-mine-50 truncate">{priceCurrencyLabel(p)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
