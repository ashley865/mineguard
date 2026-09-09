import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, Line, ComposedChart } from "recharts";
import { api } from "../api/client";
import { OperationsDashboardSummary } from "../api/types";
import LoadError from "../components/LoadError";
import AiAssistantWidget from "../components/AiAssistantWidget";
import { GaugeIcon, ZapIcon, ClockIcon, AlertTriangleIcon } from "../components/icons/DashboardIcons";

// Same F-pattern / dashboard-designer approach as SafetyDashboard.tsx and CooDashboard.tsx:
// headline KPIs with explicit targets, one primary trend + one breakdown, supporting
// detail, then a tabbed action queue. The Operations Manager previously had only a single
// "production analytics" widget bolted onto the shared ExecutiveDashboard.

type Tone = "positive" | "negative" | "caution";
type QueueTab = "maintenance" | "downtime" | "equipment" | "handovers";

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

const DOWNTIME_COLORS: Record<string, string> = {
  EQUIPMENT_BREAKDOWN: "#e13b2e",
  POWER_OUTAGE: "#f0803c",
  WEATHER: "#3b82f6",
  SAFETY_STOPPAGE: "#c026d3",
  MATERIAL_SHORTAGE: "#c48a1f",
  LABOUR_SHORTAGE: "#8a9ab5",
  PLANNED_MAINTENANCE: "#22c55e",
  OTHER: "#6b7280",
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const gradientId = `ops-spark-${useId().replace(/:/g, "")}`;
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

export default function OperationsDashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<OperationsDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [queueTab, setQueueTab] = useState<QueueTab>("maintenance");

  async function load() {
    setLoadError(false);
    try {
      const res = await api.get<OperationsDashboardSummary>("/operations-dashboard/summary");
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

  const { headline, trends, breakdowns, fleet, shifts, actionQueue } = summary;

  const productionTrendTonnes = trends.production.map((d) => d.tonnes);
  const productionChartData = trends.production.map((d) => ({
    date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    tonnes: d.tonnes,
    target: d.target,
  }));

  const downtimeData = Object.entries(breakdowns.downtimeByCategory)
    .map(([category, count]) => ({ name: t(`operationsDashboard.downtimeCategories.${category}`, category), category, value: count }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const equipmentStatusOrder = ["OPERATIONAL", "MAINTENANCE", "DOWN"];
  const equipmentTotal = Object.values(breakdowns.equipmentByStatus).reduce((a, b) => a + b, 0);

  const queueCounts: Record<QueueTab, number> = {
    maintenance: actionQueue.overdueMaintenance.length,
    downtime: actionQueue.activeDowntime.length,
    equipment: actionQueue.equipmentDown.length,
    handovers: actionQueue.handoverIssues.length,
  };
  const totalActions = Object.values(queueCounts).reduce((a, b) => a + b, 0);

  const queueTabs: { key: QueueTab; label: string; to: string }[] = [
    { key: "maintenance", label: t("operationsDashboard.queue.maintenance"), to: "/maintenance" },
    { key: "downtime", label: t("operationsDashboard.queue.downtime"), to: "/downtime" },
    { key: "equipment", label: t("operationsDashboard.queue.equipment"), to: "/equipment" },
    { key: "handovers", label: t("operationsDashboard.queue.handovers"), to: "/shift-handovers" },
  ];

  function formatHoursAgo(iso: string) {
    const hours = Math.max(0, (Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000));
    return hours < 1 ? t("operationsDashboard.minutesAgo", { count: Math.round(hours * 60) }) : t("operationsDashboard.hoursAgo", { count: Math.round(hours) });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("operationsDashboard.title")}</h1>
        <p className="text-mine-300 text-sm">{t("operationsDashboard.subtitle")}</p>
      </div>

      {/* Level 1 — headline KPIs, each with an explicit target */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <HeadlineKpi
          icon={<GaugeIcon />}
          label={t("operationsDashboard.productionToday")}
          value={`${headline.productionToday.toLocaleString()} t`}
          target={
            headline.productionTargetToday > 0
              ? t("operationsDashboard.targetTonnes", { target: headline.productionTargetToday.toLocaleString() })
              : t("operationsDashboard.noTargetSet")
          }
          tone={headline.productionTargetToday > 0 ? (headline.productionToday >= headline.productionTargetToday ? "positive" : "caution") : undefined}
          trend={productionTrendTonnes}
          trendColor="#3b82f6"
        />
        <HeadlineKpi
          icon={<ZapIcon />}
          label={t("operationsDashboard.uptime")}
          value={`${headline.equipmentUptimePct}%`}
          target={t("operationsDashboard.equipmentDownTarget", { count: headline.equipmentDownCount })}
          tone={headline.equipmentDownCount === 0 ? "positive" : headline.equipmentUptimePct >= 80 ? "caution" : "negative"}
        />
        <HeadlineKpi
          icon={<ClockIcon />}
          label={t("operationsDashboard.downtimeHours")}
          value={headline.downtimeHoursLast30}
          target={t("operationsDashboard.last30Days")}
          tone={headline.downtimeHoursLast30 === 0 ? "positive" : "caution"}
        />
        <HeadlineKpi
          icon={<AlertTriangleIcon />}
          label={t("operationsDashboard.overdueMaintenance")}
          value={headline.overdueMaintenanceCount}
          target={t("operationsDashboard.overdueMaintenanceTarget")}
          tone={headline.overdueMaintenanceCount > 0 ? "negative" : "positive"}
        />
      </div>

      {/* Level 2 — primary trend + secondary breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardOuter} lg:col-span-2`}>
          <h2 className="text-sm font-semibold">{t("operationsDashboard.trendTitle")}</h2>
          <p className="text-[11px] text-mine-400 mt-0.5 mb-4">
            {headline.productionAttainmentPct30 !== null
              ? t("operationsDashboard.trendHint", { pct: headline.productionAttainmentPct30 })
              : t("operationsDashboard.trendHintNoTarget")}
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={productionChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="ops-prod" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#52525b" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#52525b" }} />
                <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="tonnes"
                  name={t("operationsDashboard.tonnesSeries") ?? "Tonnes"}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#ops-prod)"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  name={t("operationsDashboard.targetSeries") ?? "Target"}
                  stroke="#8a9ab5"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardOuter}>
          <h2 className="text-sm font-semibold mb-4">{t("operationsDashboard.downtimeByCategory")}</h2>
          {downtimeData.length === 0 ? (
            <div className="text-xs text-mine-400 py-8 text-center">{t("operationsDashboard.noDowntime")}</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={downtimeData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 12 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#52525b" }} width={100} />
                  <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {downtimeData.map((d) => (
                      <Cell key={d.category} fill={DOWNTIME_COLORS[d.category] ?? "#8a9ab5"} />
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
            <h2 className="text-sm font-semibold">{t("operationsDashboard.fleetTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("operationsDashboard.fleetHint")}</p>
          </div>
          <StatRow label={t("operationsDashboard.deliveriesToday")} value={fleet.deliveriesToday} />
          <StatRow label={t("operationsDashboard.inbound")} value={fleet.inboundToday} />
          <StatRow label={t("operationsDashboard.outbound")} value={fleet.outboundToday} />
          <StatRow label={t("operationsDashboard.onSiteNow")} value={fleet.onSiteNow} />
          <div className="border-t border-mine-800 pt-3 space-y-3">
            <StatRow label={t("operationsDashboard.rostersToday")} value={shifts.rostersToday} />
            <StatRow label={t("operationsDashboard.workersRostered")} value={shifts.workersRosteredToday} />
            <StatRow label={t("operationsDashboard.handoverIssues")} value={shifts.handoverIssuesLast7} tone={shifts.handoverIssuesLast7 > 0 ? "caution" : "positive"} />
          </div>
        </div>

        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("operationsDashboard.equipmentTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("operationsDashboard.equipmentHint")}</p>
          </div>
          {equipmentTotal === 0 ? (
            <p className="text-xs text-mine-400 py-4 text-center">{t("operationsDashboard.noEquipment")}</p>
          ) : (
            equipmentStatusOrder
              .filter((s) => breakdowns.equipmentByStatus[s])
              .map((status) => (
                <StatRow
                  key={status}
                  label={t(`operationsDashboard.equipmentStatuses.${status}`)}
                  value={breakdowns.equipmentByStatus[status] ?? 0}
                  tone={status === "OPERATIONAL" ? "positive" : status === "DOWN" ? "negative" : "caution"}
                />
              ))
          )}
          <div className="pt-2">
            <Link to="/equipment" className="text-xs text-hazard-500 hover:underline">{t("operationsDashboard.openEquipment")}</Link>
          </div>
        </div>
      </div>

      {/* Action queue — tabbed rather than four stacked tables */}
      <div className={cardOuter}>
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold">{t("operationsDashboard.actionQueueTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">
              {totalActions === 0 ? t("operationsDashboard.actionQueueClear") : t("operationsDashboard.actionQueueCount", { count: totalActions })}
            </p>
          </div>
          <Link to={queueTabs.find((q) => q.key === queueTab)?.to ?? "/maintenance"} className="text-xs text-hazard-500 hover:underline">
            {t("operationsDashboard.openModule")}
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
              <p className="text-xs text-mine-400 py-4 text-center">{t("operationsDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.overdueMaintenance.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{m.equipmentName}</div>
                    <div className="text-mine-500 text-[11px]">{t(`operationsDashboard.maintenanceTypes.${m.maintenanceType}`, m.maintenanceType)}</div>
                  </div>
                  <span className="text-danger-500 tabular-nums shrink-0">{new Date(m.scheduledDate).toLocaleDateString()}</span>
                </div>
              ))
            ))}

          {queueTab === "downtime" &&
            (actionQueue.activeDowntime.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("operationsDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.activeDowntime.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{d.description}</div>
                    <div className="text-mine-500 text-[11px]">{d.affectedArea ?? t(`operationsDashboard.downtimeCategories.${d.category}`, d.category)}</div>
                  </div>
                  <span className="text-danger-500 tabular-nums shrink-0">{formatHoursAgo(d.startedAt)}</span>
                </div>
              ))
            ))}

          {queueTab === "equipment" &&
            (actionQueue.equipmentDown.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("operationsDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.equipmentDown.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <span className="truncate">{e.name}</span>
                  <span className="text-mine-400 shrink-0">
                    {e.lastMaintenance ? new Date(e.lastMaintenance).toLocaleDateString() : t("operationsDashboard.noMaintenanceRecord")}
                  </span>
                </div>
              ))
            ))}

          {queueTab === "handovers" &&
            (actionQueue.handoverIssues.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("operationsDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.handoverIssues.map((h) => (
                <div key={h.id} className="text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{h.outgoingSupervisor}</span>
                    <span className="text-mine-500 tabular-nums shrink-0">{new Date(h.shiftDate).toLocaleDateString()}</span>
                  </div>
                  {h.issues && <div className="text-mine-400 mt-0.5 truncate">{h.issues}</div>}
                  {h.actionItems && <div className="text-hazard-500 mt-0.5 truncate">{h.actionItems}</div>}
                </div>
              ))
            ))}
        </div>
      </div>
    </div>
  );
}
