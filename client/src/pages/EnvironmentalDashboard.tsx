import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { api } from "../api/client";
import { EnvironmentalDashboardSummary } from "../api/types";
import LoadError from "../components/LoadError";
import AiAssistantWidget from "../components/AiAssistantWidget";
import { AlertTriangleIcon, GaugeIcon, LayersIcon, ZapIcon } from "../components/icons/DashboardIcons";

// Same F-pattern / dashboard-designer approach as the other department dashboards.

type Tone = "positive" | "negative" | "caution";
type QueueTab = "exceedances" | "tailings" | "closure" | "dams";

const cardOuter = "bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6";
const TONE_BADGE: Record<Tone | "neutral", string> = {
  positive: "bg-success-500/10 text-success-500",
  negative: "bg-danger-500/10 text-danger-500",
  caution: "bg-hazard-500/10 text-hazard-500",
  neutral: "bg-mine-400/10 text-mine-400",
};

function toneText(tone?: Tone) {
  return tone === "positive" ? "text-success-500" : tone === "negative" ? "text-danger-500" : tone === "caution" ? "text-hazard-500" : "text-mine-50";
}

const PARAMETER_COLORS: Record<string, string> = {
  WATER_QUALITY: "#3b82f6",
  AIR_QUALITY: "#0ea5e9",
  DUST: "#c48a1f",
  NOISE: "#a855f7",
  TAILINGS_DAM_LEVEL: "#e13b2e",
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const gradientId = `env-spark-${useId().replace(/:/g, "")}`;
  if (data.length < 2) return null;
  return (
    <div className="h-7 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function HeadlineKpi({ icon, label, value, target, tone, trend, trendColor }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  target: string;
  tone?: Tone;
  trend?: number[];
  trendColor?: string;
}) {
  return (
    <div className={cardOuter}>
      <div className={`w-9 h-9 rounded-[11px] flex items-center justify-center mb-4 ${TONE_BADGE[tone ?? "neutral"]}`}>{icon}</div>
      <div className={`text-2xl font-bold leading-none tabular-nums truncate ${toneText(tone)}`}>{value}</div>
      <div className="text-xs text-mine-300 mt-2.5 truncate">{label}</div>
      <div className="text-[10px] text-mine-500 mt-1 truncate">{target}</div>
      {trend && trend.length >= 2 && (
        <div className="mt-2 -mx-1">
          <Sparkline data={trend} color={trendColor ?? "#8a9ab5"} />
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, tone }: { label: string; value: string | number; tone?: Tone }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-mine-300">{label}</span>
      <span className={`font-semibold tabular-nums ${toneText(tone)}`}>{value}</span>
    </div>
  );
}

export default function EnvironmentalDashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<EnvironmentalDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [queueTab, setQueueTab] = useState<QueueTab>("tailings");

  async function load() {
    setLoadError(false);
    try {
      const res = await api.get<EnvironmentalDashboardSummary>("/environmental-dashboard/summary");
      setSummary(res.data);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loadError) return <LoadError onRetry={load} />;
  if (!summary) return <div className="text-mine-300">{t("common.loading")}</div>;

  const { headline, trends, breakdowns, waterEnergy, actionQueue } = summary;

  const exceedanceTrend = trends.monitoring.map((d) => d.exceedances);
  const monitoringChartData = trends.monitoring.map((d) => ({
    date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    readings: d.readings,
    exceedances: d.exceedances,
  }));

  const parameterData = Object.entries(breakdowns.exceedancesByParameter)
    .map(([parameter, count]) => ({ name: t(`environmentalDashboard.parameters.${parameter}`, parameter), parameter, value: count }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const queueCounts: Record<QueueTab, number> = {
    exceedances: actionQueue.exceedances.length,
    tailings: actionQueue.tailingsAtRisk.length,
    closure: actionQueue.closureDue.length,
    dams: actionQueue.damsNeedingInspection.length,
  };
  const totalActions = Object.values(queueCounts).reduce((a, b) => a + b, 0);

  const queueTabs: { key: QueueTab; label: string; to: string }[] = [
    { key: "tailings", label: t("environmentalDashboard.queue.tailings"), to: "/compliance" },
    { key: "exceedances", label: t("environmentalDashboard.queue.exceedances"), to: "/environmental" },
    { key: "closure", label: t("environmentalDashboard.queue.closure"), to: "/compliance" },
    { key: "dams", label: t("environmentalDashboard.queue.dams"), to: "/resources" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("environmentalDashboard.title")}</h1>
        <p className="text-mine-300 text-sm">{t("environmentalDashboard.subtitle")}</p>
      </div>

      {/* Level 1 — headline KPIs. Tailings leads rather than the metric with the bigger
          number: an exceedance is a compliance problem, a dam wall is a catastrophe. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <HeadlineKpi
          icon={<LayersIcon />}
          label={t("environmentalDashboard.tailingsAtRisk")}
          value={headline.tailingsAtRisk}
          target={t("environmentalDashboard.tailingsTarget", { count: headline.tailingsFacilities })}
          tone={headline.tailingsAtRisk > 0 ? "negative" : "positive"}
        />
        <HeadlineKpi
          icon={<AlertTriangleIcon />}
          label={t("environmentalDashboard.exceedances")}
          value={headline.exceedances}
          target={t("environmentalDashboard.exceedancesTarget", { count: headline.readingsLast30 })}
          tone={headline.exceedances > 0 ? "negative" : "positive"}
          trend={exceedanceTrend}
          trendColor="#e13b2e"
        />
        <HeadlineKpi
          icon={<GaugeIcon />}
          label={t("environmentalDashboard.waterLicence")}
          value={headline.waterLicenceUsedPct !== null ? `${headline.waterLicenceUsedPct}%` : "—"}
          target={
            headline.waterLicenceUsedPct !== null
              ? t("environmentalDashboard.waterBreachesTarget", { count: headline.waterBreaches })
              : t("environmentalDashboard.noLicenceLimit")
          }
          tone={
            headline.waterBreaches > 0
              ? "negative"
              : headline.waterLicenceUsedPct === null
              ? undefined
              : headline.waterLicenceUsedPct >= 90
              ? "caution"
              : "positive"
          }
        />
        <HeadlineKpi
          icon={<ZapIcon />}
          label={t("environmentalDashboard.closureDue")}
          value={headline.closureDue}
          target={t("environmentalDashboard.closureProvisionTarget", { amount: headline.closureProvisionTotal.toLocaleString() })}
          tone={headline.closureDue > 0 ? "caution" : "positive"}
        />
      </div>

      {/* Level 2 — primary trend + secondary breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardOuter} lg:col-span-2`}>
          <h2 className="text-sm font-semibold">{t("environmentalDashboard.trendTitle")}</h2>
          <p className="text-[11px] text-mine-400 mt-0.5 mb-4">{t("environmentalDashboard.trendHint")}</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monitoringChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="env-readings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="env-exceed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e13b2e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#e13b2e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#52525b" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="readings"
                  name={t("environmentalDashboard.readingsSeries") ?? "Readings"}
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  fill="url(#env-readings)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="exceedances"
                  name={t("environmentalDashboard.exceedancesSeries") ?? "Exceedances"}
                  stroke="#e13b2e"
                  strokeWidth={2}
                  fill="url(#env-exceed)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardOuter}>
          <h2 className="text-sm font-semibold mb-4">{t("environmentalDashboard.exceedancesByParameter")}</h2>
          {parameterData.length === 0 ? (
            <div className="text-xs text-mine-400 py-8 text-center">{t("environmentalDashboard.noExceedances")}</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={parameterData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 12 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#52525b" }} width={95} />
                  <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {parameterData.map((d) => (
                      <Cell key={d.parameter} fill={PARAMETER_COLORS[d.parameter] ?? "#8a9ab5"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* The AI assistant is a standalone feature, not a panel: it renders its own
          hazard-bordered card, so boxing it inside a cardOuter column would double the
          border and padding and mute the styling that marks it out. */}
      <AiAssistantWidget />

      {/* Level 3 — supporting detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("environmentalDashboard.waterTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("environmentalDashboard.waterHint")}</p>
          </div>
          <StatRow label={t("environmentalDashboard.abstracted")} value={`${waterEnergy.abstracted.toLocaleString()} ${waterEnergy.unit}`} />
          <StatRow label={t("environmentalDashboard.discharged")} value={`${waterEnergy.discharged.toLocaleString()} ${waterEnergy.unit}`} />
          <StatRow label={t("environmentalDashboard.recycled")} value={`${waterEnergy.recycled.toLocaleString()} ${waterEnergy.unit}`} tone={waterEnergy.recycled > 0 ? "positive" : undefined} />
          <div className="border-t border-mine-800 pt-3 space-y-3">
            <StatRow
              label={t("environmentalDashboard.renewableShare")}
              value={waterEnergy.energyRenewablePct !== null ? `${waterEnergy.energyRenewablePct}%` : "—"}
              tone={waterEnergy.energyRenewablePct !== null && waterEnergy.energyRenewablePct > 0 ? "positive" : undefined}
            />
            <StatRow label={t("environmentalDashboard.gridKwh")} value={waterEnergy.gridKwh !== null ? waterEnergy.gridKwh.toLocaleString() : "—"} />
            <StatRow label={t("environmentalDashboard.diesel")} value={waterEnergy.dieselLiters !== null ? waterEnergy.dieselLiters.toLocaleString() : "—"} />
          </div>
          <div className="pt-2">
            <Link to="/resources" className="text-xs text-hazard-500 hover:underline">{t("environmentalDashboard.openResources")}</Link>
          </div>
        </div>

        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("environmentalDashboard.emissionsTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">
              {waterEnergy.ghgYear !== null
                ? t("environmentalDashboard.emissionsHint", { year: waterEnergy.ghgYear })
                : t("environmentalDashboard.emissionsNone")}
            </p>
          </div>
          <StatRow label={t("environmentalDashboard.scope1")} value={waterEnergy.ghgScope1 !== null ? waterEnergy.ghgScope1.toLocaleString() : "—"} />
          <StatRow label={t("environmentalDashboard.scope2")} value={waterEnergy.ghgScope2 !== null ? waterEnergy.ghgScope2.toLocaleString() : "—"} />
          <StatRow
            label={t("environmentalDashboard.carbonTax")}
            value={waterEnergy.carbonTaxLiability !== null ? waterEnergy.carbonTaxLiability.toLocaleString() : "—"}
            tone={waterEnergy.carbonTaxLiability !== null && waterEnergy.carbonTaxLiability > 0 ? "caution" : undefined}
          />
          <div className="border-t border-mine-800 pt-3">
            <StatRow label={t("environmentalDashboard.closureProvision")} value={headline.closureProvisionTotal.toLocaleString()} />
          </div>
          <div className="pt-2">
            <Link to="/environmental" className="text-xs text-hazard-500 hover:underline">{t("environmentalDashboard.openEnvironmental")}</Link>
          </div>
        </div>
      </div>

      {/* Action queue — tabbed rather than four stacked tables */}
      <div className={cardOuter}>
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold">{t("environmentalDashboard.actionQueueTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">
              {totalActions === 0 ? t("environmentalDashboard.actionQueueClear") : t("environmentalDashboard.actionQueueCount", { count: totalActions })}
            </p>
          </div>
          <Link to={queueTabs.find((q) => q.key === queueTab)?.to ?? "/environmental"} className="text-xs text-hazard-500 hover:underline">
            {t("environmentalDashboard.openModule")}
          </Link>
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          {queueTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setQueueTab(tab.key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                queueTab === tab.key ? "bg-hazard-500 text-white" : "bg-mine-800/60 text-mine-300 hover:text-mine-50"
              }`}
            >
              {tab.label} ({queueCounts[tab.key]})
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {queueTab === "tailings" &&
            (actionQueue.tailingsAtRisk.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("environmentalDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.tailingsAtRisk.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">
                      {f.name}
                      {f.seepageObserved && <span className="text-danger-500 font-semibold"> · {t("environmentalDashboard.seepage")}</span>}
                    </div>
                    <div className="text-mine-500 text-[11px]">
                      {f.structuralRating
                        ? t(`environmentalDashboard.damRatings.${f.structuralRating}`, f.structuralRating)
                        : t("environmentalDashboard.neverInspected")}
                      {f.gistmClassification ? ` · ${f.gistmClassification}` : ""}
                    </div>
                  </div>
                  <span className="text-mine-400 tabular-nums shrink-0">
                    {f.lastInspectionDate ? new Date(f.lastInspectionDate).toLocaleDateString() : "—"}
                  </span>
                </div>
              ))
            ))}

          {queueTab === "exceedances" &&
            (actionQueue.exceedances.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("environmentalDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.exceedances.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{r.monitoringPoint}</div>
                    <div className="text-mine-500 text-[11px]">{t(`environmentalDashboard.parameters.${r.parameterType}`, r.parameterType)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-danger-500 font-semibold tabular-nums">
                      {r.value} {r.unit}
                      {r.thresholdMax !== null && <span className="text-mine-500 font-normal"> / {r.thresholdMax}</span>}
                    </div>
                    <div className="text-mine-500 text-[11px] tabular-nums">{new Date(r.recordedAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            ))}

          {queueTab === "closure" &&
            (actionQueue.closureDue.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("environmentalDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.closureDue.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{p.planReferenceNumber ?? p.siteName}</div>
                    <div className="text-mine-500 text-[11px]">{p.siteName}</div>
                  </div>
                  <span className="text-hazard-500 tabular-nums shrink-0">
                    {p.nextAssessmentDue ? new Date(p.nextAssessmentDue).toLocaleDateString() : "—"}
                  </span>
                </div>
              ))
            ))}

          {queueTab === "dams" &&
            (actionQueue.damsNeedingInspection.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("environmentalDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.damsNeedingInspection.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{d.name}</div>
                    {d.currentLevel !== null && d.capacity !== null && (
                      <div className="text-mine-500 text-[11px]">{d.currentLevel} / {d.capacity}</div>
                    )}
                  </div>
                  <span className="text-hazard-500 tabular-nums shrink-0">
                    {d.lastInspectionDate ? new Date(d.lastInspectionDate).toLocaleDateString() : t("environmentalDashboard.neverInspected")}
                  </span>
                </div>
              ))
            ))}
        </div>
      </div>
    </div>
  );
}
