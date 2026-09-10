import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { api } from "../api/client";
import { EngineeringDashboardSummary } from "../api/types";
import LoadError from "../components/LoadError";
import AiAssistantWidget from "../components/AiAssistantWidget";
import { AlertTriangleIcon, GaugeIcon, ShieldCheckIcon, WalletIcon } from "../components/icons/DashboardIcons";

// Same F-pattern / dashboard-designer approach as the other department dashboards.
// Deliberately scoped away from Operations' view of the same plant: this is asset
// integrity and maintenance discipline, not production output.

type Tone = "positive" | "negative" | "caution";
type QueueTab = "maintenance" | "ropes" | "winders" | "shafts" | "parts";

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

const TYPE_COLORS: Record<string, string> = {
  PLANNED: "#22c55e",
  PREVENTIVE: "#3b82f6",
  INSPECTION: "#0ea5e9",
  CORRECTIVE: "#f0803c",
  EMERGENCY: "#e13b2e",
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const gradientId = `eng-spark-${useId().replace(/:/g, "")}`;
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

export default function EngineeringDashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<EngineeringDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [queueTab, setQueueTab] = useState<QueueTab>("maintenance");

  async function load() {
    setLoadError(false);
    try {
      const res = await api.get<EngineeringDashboardSummary>("/engineering-dashboard/summary");
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

  const { headline, trends, breakdowns, assetIntegrity, consumables, maintenanceStats, actionQueue } = summary;

  const proactiveTrend = trends.maintenance.map((d) => d.proactive);
  const maintenanceChartData = trends.maintenance.map((d) => ({
    date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    proactive: d.proactive,
    reactive: d.reactive,
  }));

  const typeOrder = ["PLANNED", "PREVENTIVE", "INSPECTION", "CORRECTIVE", "EMERGENCY"];
  const typeData = typeOrder
    .map((type) => ({ name: t(`engineeringDashboard.maintenanceTypes.${type}`, type), type, value: breakdowns.maintenanceByType[type] ?? 0 }))
    .filter((d) => d.value > 0);

  const queueCounts: Record<QueueTab, number> = {
    maintenance: actionQueue.overdueMaintenance.length,
    ropes: actionQueue.ropesDue.length,
    winders: actionQueue.windersDue.length,
    shafts: actionQueue.shaftsDue.length,
    parts: actionQueue.partsPastWearLimit.length,
  };
  const totalActions = Object.values(queueCounts).reduce((a, b) => a + b, 0);

  const queueTabs: { key: QueueTab; label: string; to: string }[] = [
    { key: "maintenance", label: t("engineeringDashboard.queue.maintenance"), to: "/maintenance" },
    { key: "ropes", label: t("engineeringDashboard.queue.ropes"), to: "/winders" },
    { key: "winders", label: t("engineeringDashboard.queue.winders"), to: "/winders" },
    { key: "shafts", label: t("engineeringDashboard.queue.shafts"), to: "/winders" },
    { key: "parts", label: t("engineeringDashboard.queue.parts"), to: "/equipment" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("engineeringDashboard.title")}</h1>
        <p className="text-mine-300 text-sm">{t("engineeringDashboard.subtitle")}</p>
      </div>

      {/* Level 1 — headline KPIs. Leads on maintenance discipline rather than uptime:
          uptime is the symptom Operations already reports, the planned/reactive split is
          what says whether it's being held up by design or by emergency callouts. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <HeadlineKpi
          icon={<GaugeIcon />}
          label={t("engineeringDashboard.plannedShare")}
          value={headline.plannedSharePct !== null ? `${headline.plannedSharePct}%` : "—"}
          target={
            headline.completedLast30 > 0
              ? t("engineeringDashboard.plannedShareTarget", { count: headline.completedLast30 })
              : t("engineeringDashboard.noMaintenanceCompleted")
          }
          tone={headline.plannedSharePct === null ? undefined : headline.plannedSharePct >= 80 ? "positive" : headline.plannedSharePct >= 60 ? "caution" : "negative"}
          trend={proactiveTrend}
          trendColor="#22c55e"
        />
        <HeadlineKpi
          icon={<AlertTriangleIcon />}
          label={t("engineeringDashboard.overdueMaintenance")}
          value={headline.overdueMaintenance}
          target={t("engineeringDashboard.openMaintenanceTarget", { count: headline.openMaintenance })}
          tone={headline.overdueMaintenance > 0 ? "negative" : "positive"}
        />
        <HeadlineKpi
          icon={<ShieldCheckIcon />}
          label={t("engineeringDashboard.statutoryDue")}
          value={headline.statutoryInspectionsDue}
          target={t("engineeringDashboard.ropesOverdueTarget", { count: headline.ropesOverdue })}
          tone={headline.ropesOverdue > 0 ? "negative" : headline.statutoryInspectionsDue > 0 ? "caution" : "positive"}
        />
        <HeadlineKpi
          icon={<WalletIcon />}
          label={t("engineeringDashboard.maintenanceCost")}
          value={headline.maintenanceCostLast30.toLocaleString()}
          target={t("engineeringDashboard.maintenanceCostTarget", { hours: maintenanceStats.downtimeHoursLast30 })}
        />
      </div>

      {/* Level 2 — primary trend + secondary breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardOuter} lg:col-span-2`}>
          <h2 className="text-sm font-semibold">{t("engineeringDashboard.trendTitle")}</h2>
          <p className="text-[11px] text-mine-400 mt-0.5 mb-4">{t("engineeringDashboard.trendHint")}</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={maintenanceChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="eng-proactive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="eng-reactive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e13b2e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#e13b2e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#52525b" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="proactive"
                  name={t("engineeringDashboard.proactiveSeries") ?? "Planned"}
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#eng-proactive)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="reactive"
                  name={t("engineeringDashboard.reactiveSeries") ?? "Reactive"}
                  stroke="#e13b2e"
                  strokeWidth={1.5}
                  fill="url(#eng-reactive)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardOuter}>
          <h2 className="text-sm font-semibold mb-4">{t("engineeringDashboard.maintenanceByType")}</h2>
          {typeData.length === 0 ? (
            <div className="text-xs text-mine-400 py-8 text-center">{t("engineeringDashboard.noMaintenanceCompleted")}</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 12 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#52525b" }} width={80} />
                  <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {typeData.map((d) => (
                      <Cell key={d.type} fill={TYPE_COLORS[d.type] ?? "#8a9ab5"} />
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
          border and padding and mute the styling that marks it out. Full width, same as
          CooDashboard/CfoDashboard. */}
      <AiAssistantWidget />

      {/* Level 3 — supporting detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("engineeringDashboard.assetIntegrityTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("engineeringDashboard.assetIntegrityHint")}</p>
          </div>
          <StatRow label={t("engineeringDashboard.winders")} value={assetIntegrity.winders} />
          <StatRow label={t("engineeringDashboard.windersDue")} value={assetIntegrity.windersInspectionDue} tone={assetIntegrity.windersInspectionDue > 0 ? "caution" : "positive"} />
          <StatRow label={t("engineeringDashboard.ropesInService")} value={assetIntegrity.ropesInService} />
          <StatRow label={t("engineeringDashboard.ropesDue")} value={assetIntegrity.ropesDue} tone={assetIntegrity.ropesDue > 0 ? "negative" : "positive"} />
          <StatRow label={t("engineeringDashboard.shaftsTracked")} value={assetIntegrity.shaftsTracked} />
          <StatRow label={t("engineeringDashboard.shaftsDue")} value={assetIntegrity.shaftsDue} tone={assetIntegrity.shaftsDue > 0 ? "caution" : "positive"} />
          <div className="pt-2">
            <Link to="/winders" className="text-xs text-hazard-500 hover:underline">{t("engineeringDashboard.openWinders")}</Link>
          </div>
        </div>

        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("engineeringDashboard.consumablesTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("engineeringDashboard.consumablesHint")}</p>
          </div>
          <StatRow label={t("engineeringDashboard.partsInService")} value={consumables.partsInService} />
          <StatRow label={t("engineeringDashboard.partsMeasured")} value={consumables.partsMeasured} />
          <StatRow label={t("engineeringDashboard.partsPastWear")} value={consumables.partsPastWearLimit} tone={consumables.partsPastWearLimit > 0 ? "negative" : "positive"} />
          <div className="border-t border-mine-800 pt-3 space-y-3">
            <StatRow label={t("engineeringDashboard.equipmentDownNow")} value={maintenanceStats.equipmentDownNow} tone={maintenanceStats.equipmentDownNow > 0 ? "negative" : "positive"} />
            <StatRow label={t("engineeringDashboard.downtimeHours")} value={maintenanceStats.downtimeHoursLast30} />
          </div>
          <div className="pt-2">
            <Link to="/equipment" className="text-xs text-hazard-500 hover:underline">{t("engineeringDashboard.openEquipment")}</Link>
          </div>
        </div>
      </div>

      {/* Action queue — tabbed rather than five stacked tables */}
      <div className={cardOuter}>
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold">{t("engineeringDashboard.actionQueueTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">
              {totalActions === 0 ? t("engineeringDashboard.actionQueueClear") : t("engineeringDashboard.actionQueueCount", { count: totalActions })}
            </p>
          </div>
          <Link to={queueTabs.find((q) => q.key === queueTab)?.to ?? "/maintenance"} className="text-xs text-hazard-500 hover:underline">
            {t("engineeringDashboard.openModule")}
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
          {queueTab === "maintenance" &&
            (actionQueue.overdueMaintenance.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("engineeringDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.overdueMaintenance.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{m.equipmentName}</div>
                    <div className="text-mine-500 text-[11px]">{t(`engineeringDashboard.maintenanceTypes.${m.maintenanceType}`, m.maintenanceType)}</div>
                  </div>
                  <span className="text-danger-500 tabular-nums shrink-0">{new Date(m.scheduledDate).toLocaleDateString()}</span>
                </div>
              ))
            ))}

          {queueTab === "ropes" &&
            (actionQueue.ropesDue.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("engineeringDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.ropesDue.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{r.ropeIdentifier}</div>
                    <div className="text-mine-500 text-[11px]">{r.winderName}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {r.discardDate && (
                      <div className="text-danger-500 tabular-nums">{t("engineeringDashboard.discard", { date: new Date(r.discardDate).toLocaleDateString() })}</div>
                    )}
                    {r.nextTestDue && (
                      <div className="text-hazard-500 tabular-nums text-[11px]">{t("engineeringDashboard.test", { date: new Date(r.nextTestDue).toLocaleDateString() })}</div>
                    )}
                  </div>
                </div>
              ))
            ))}

          {queueTab === "winders" &&
            (actionQueue.windersDue.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("engineeringDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.windersDue.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{w.name}</div>
                    {w.shaftName && <div className="text-mine-500 text-[11px]">{w.shaftName}</div>}
                  </div>
                  <span className="text-hazard-500 tabular-nums shrink-0">
                    {w.nextInspectionDue ? new Date(w.nextInspectionDue).toLocaleDateString() : t("engineeringDashboard.neverInspected")}
                  </span>
                </div>
              ))
            ))}

          {queueTab === "shafts" &&
            (actionQueue.shaftsDue.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("engineeringDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.shaftsDue.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <span className="truncate">{s.shaftName}</span>
                  <span className="text-hazard-500 tabular-nums shrink-0">
                    {s.nextInspectionDue ? new Date(s.nextInspectionDue).toLocaleDateString() : t("engineeringDashboard.neverInspected")}
                  </span>
                </div>
              ))
            ))}

          {queueTab === "parts" &&
            (actionQueue.partsPastWearLimit.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("engineeringDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.partsPastWearLimit.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{p.equipmentName}</div>
                    <div className="text-mine-500 text-[11px]">
                      {t(`engineeringDashboard.partTypes.${p.partType}`, p.partType)}
                      {p.position ? ` · ${p.position}` : ""}
                    </div>
                  </div>
                  <span className="text-danger-500 tabular-nums shrink-0">{t("engineeringDashboard.remaining", { pct: p.remainingPct })}</span>
                </div>
              ))
            ))}
        </div>
      </div>
    </div>
  );
}
