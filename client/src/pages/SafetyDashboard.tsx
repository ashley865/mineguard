import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { api } from "../api/client";
import { SafetyDashboardSummary } from "../api/types";
import { SeverityBadge } from "../components/Badges";
import DataTable, { DataTableColumn } from "../components/DataTable";
import LoadError from "../components/LoadError";
import AiAssistantWidget from "../components/AiAssistantWidget";
import { AlertTriangleIcon, CheckCircleIcon, ShieldCheckIcon, UsersIcon } from "../components/icons/DashboardIcons";

// Built with the dashboard-designer skill's F-pattern, same as CooDashboard: a headline
// KPI row with explicit targets, one primary + one secondary chart, then supporting
// detail. The action queue is a tab group rather than five stacked tables, per the
// skill's "max 6-8 charts per screen" and "one dashboard, one audience" rules — the
// Safety Manager previously shared the generic ExecutiveDashboard with every other title.
//
// The headline deliberately pairs a lagging indicator (days since last incident) with
// leading ones (observations, hazards): a safety dashboard showing only lagging metrics
// reports how last month went rather than where the next incident is coming from.

type Tone = "positive" | "negative" | "caution";
type QueueTab = "hazards" | "inspections" | "riskAssessments" | "permits" | "medicals";

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

const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#e13b2e",
  HIGH: "#f0803c",
  MEDIUM: "#c48a1f",
  LOW: "#3b82f6",
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  // Each instance needs its own gradient id or sparklines on the same page collide on the
  // same <defs> id and borrow each other's colour.
  const gradientId = `safety-spark-${useId().replace(/:/g, "")}`;
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

export default function SafetyDashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<SafetyDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [queueTab, setQueueTab] = useState<QueueTab>("hazards");

  async function load() {
    setLoadError(false);
    try {
      const res = await api.get<SafetyDashboardSummary>("/safety-dashboard/summary");
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

  const { headline, trends, breakdowns, leadingIndicators, workforceHealth, actionQueue, recentIncidents } = summary;

  const incidentTrend = trends.incidents.map((d) => d.count);
  const observationTrend = trends.observations.map((d) => d.count);

  const combinedTrend = trends.incidents.map((d, i) => ({
    date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    incidents: d.count,
    observations: trends.observations[i]?.count ?? 0,
  }));

  const hazardRiskData = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    .map((level) => ({ name: t(`safetyDashboard.riskLevels.${level}`, level), level, value: breakdowns.hazardsByRisk[level] ?? 0 }))
    .filter((d) => d.value > 0);

  const queueCounts: Record<QueueTab, number> = {
    hazards: actionQueue.overdueHazards.length,
    inspections: actionQueue.overdueInspections.length,
    riskAssessments: actionQueue.riskAssessmentsDue.length,
    permits: actionQueue.permitsAwaitingApproval.length,
    medicals: actionQueue.medicalsOverdue.length,
  };
  const totalActions = Object.values(queueCounts).reduce((a, b) => a + b, 0);

  const queueTabs: { key: QueueTab; label: string; to: string }[] = [
    { key: "hazards", label: t("safetyDashboard.queue.hazards"), to: "/hazards" },
    { key: "inspections", label: t("safetyDashboard.queue.inspections"), to: "/inspection" },
    { key: "riskAssessments", label: t("safetyDashboard.queue.riskAssessments"), to: "/compliance" },
    { key: "permits", label: t("safetyDashboard.queue.permits"), to: "/permits-to-work" },
    { key: "medicals", label: t("safetyDashboard.queue.medicals"), to: "/workforce" },
  ];

  const incidentColumns: DataTableColumn<SafetyDashboardSummary["recentIncidents"][number]>[] = [
    { key: "title", header: t("safetyDashboard.incidentTitle"), render: (i) => i.title, sortValue: (i) => i.title },
    { key: "site", header: t("common.site"), render: (i) => i.siteName, sortValue: (i) => i.siteName },
    { key: "severity", header: t("safetyDashboard.severity"), render: (i) => <SeverityBadge severity={i.severity} />, sortValue: (i) => i.severity },
    { key: "date", header: t("safetyDashboard.reported"), render: (i) => new Date(i.createdAt).toLocaleDateString(), sortValue: (i) => i.createdAt },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("safetyDashboard.title")}</h1>
        <p className="text-mine-300 text-sm">{t("safetyDashboard.subtitle")}</p>
      </div>

      {/* Level 1 — headline KPIs, each with an explicit target line */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <HeadlineKpi
          icon={<CheckCircleIcon />}
          label={t("safetyDashboard.daysSinceIncident")}
          value={headline.daysSinceLastIncident ?? t("safetyDashboard.noIncidentsEver")}
          target={t("safetyDashboard.daysSinceIncidentTarget")}
          tone={headline.daysSinceLastIncident === null || headline.daysSinceLastIncident >= 30 ? "positive" : headline.daysSinceLastIncident >= 7 ? "caution" : "negative"}
        />
        <HeadlineKpi
          icon={<AlertTriangleIcon />}
          label={t("safetyDashboard.openIncidents")}
          value={headline.openIncidents}
          target={t("safetyDashboard.criticalCount", { count: headline.criticalIncidents })}
          tone={headline.criticalIncidents > 0 ? "negative" : headline.openIncidents > 0 ? "caution" : "positive"}
          trend={incidentTrend}
          trendColor="#e13b2e"
        />
        <HeadlineKpi
          icon={<ShieldCheckIcon />}
          label={t("safetyDashboard.openHazards")}
          value={headline.openHazards}
          target={t("safetyDashboard.overdueCount", { count: headline.overdueHazards })}
          tone={headline.overdueHazards > 0 ? "negative" : headline.openHazards > 0 ? "caution" : "positive"}
        />
        <HeadlineKpi
          icon={<UsersIcon />}
          label={t("safetyDashboard.openObservations")}
          value={headline.openObservations}
          target={t("safetyDashboard.observationsTarget", { count: leadingIndicators.observationsLast30 })}
          trend={observationTrend}
          trendColor="#3b82f6"
        />
      </div>

      {/* Level 2 — primary trend + secondary breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardOuter} lg:col-span-2`}>
          <h2 className="text-sm font-semibold">{t("safetyDashboard.trendTitle")}</h2>
          <p className="text-[11px] text-mine-400 mt-0.5 mb-4">{t("safetyDashboard.trendHint")}</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={combinedTrend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="safety-obs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="safety-inc" x1="0" y1="0" x2="0" y2="1">
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
                  dataKey="observations"
                  name={t("safetyDashboard.observationsSeries") ?? "Observations"}
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  fill="url(#safety-obs)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="incidents"
                  name={t("safetyDashboard.incidentsSeries") ?? "Incidents"}
                  stroke="#e13b2e"
                  strokeWidth={2}
                  fill="url(#safety-inc)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardOuter}>
          <h2 className="text-sm font-semibold mb-4">{t("safetyDashboard.hazardsByRisk")}</h2>
          {hazardRiskData.length === 0 ? (
            <div className="text-xs text-mine-400 py-8 text-center">{t("safetyDashboard.noOpenHazards")}</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hazardRiskData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 12 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#52525b" }} width={70} />
                  <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {hazardRiskData.map((d) => (
                      <Cell key={d.level} fill={RISK_COLORS[d.level] ?? "#8a9ab5"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Level 3 — supporting detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("safetyDashboard.leadingTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("safetyDashboard.leadingHint")}</p>
          </div>
          <StatRow label={t("safetyDashboard.observationsLogged")} value={leadingIndicators.observationsLast30} tone={leadingIndicators.observationsLast30 > 0 ? "positive" : "caution"} />
          <StatRow label={t("safetyDashboard.toolboxTalks")} value={leadingIndicators.toolboxTalksLast30} tone={leadingIndicators.toolboxTalksLast30 > 0 ? "positive" : "caution"} />
          <StatRow label={t("safetyDashboard.toolboxAttendees")} value={leadingIndicators.toolboxAttendeesLast30} />
          <StatRow label={t("safetyDashboard.inspectionsCompleted")} value={leadingIndicators.inspectionsCompletedLast30} tone={leadingIndicators.inspectionsCompletedLast30 > 0 ? "positive" : "caution"} />
          <div className="border-t border-mine-800 pt-3 space-y-3">
            <StatRow label={t("safetyDashboard.fatigueChecks")} value={leadingIndicators.fatigueAssessmentsLast30} />
            <StatRow label={t("safetyDashboard.fatigueFailures")} value={leadingIndicators.fatigueFailuresLast30} tone={leadingIndicators.fatigueFailuresLast30 > 0 ? "negative" : "positive"} />
            <StatRow label={t("safetyDashboard.fatigueStoodDown")} value={leadingIndicators.fatigueStoodDownLast30} tone={leadingIndicators.fatigueStoodDownLast30 > 0 ? "caution" : "positive"} />
          </div>
        </div>

        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("safetyDashboard.workforceHealthTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("safetyDashboard.workforceHealthHint")}</p>
          </div>
          <StatRow label={t("safetyDashboard.unfitWorkers")} value={workforceHealth.unfitWorkers} tone={workforceHealth.unfitWorkers > 0 ? "negative" : "positive"} />
          <StatRow label={t("safetyDashboard.medicalsOverdue")} value={workforceHealth.medicalsOverdue} tone={workforceHealth.medicalsOverdue > 0 ? "negative" : "positive"} />
          <StatRow label={t("safetyDashboard.openIodClaims")} value={headline.openIodClaims} tone={headline.openIodClaims > 0 ? "caution" : "positive"} />
          <div className="pt-2">
            <Link to="/workforce" className="text-xs text-hazard-500 hover:underline">{t("safetyDashboard.openWorkforce")}</Link>
          </div>
        </div>

        <div className={cardOuter}>
          <AiAssistantWidget />
        </div>
      </div>

      {/* Action queue — tabbed rather than five stacked tables */}
      <div className={cardOuter}>
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold">{t("safetyDashboard.actionQueueTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">
              {totalActions === 0 ? t("safetyDashboard.actionQueueClear") : t("safetyDashboard.actionQueueCount", { count: totalActions })}
            </p>
          </div>
          <Link to={queueTabs.find((q) => q.key === queueTab)?.to ?? "/hazards"} className="text-xs text-hazard-500 hover:underline">
            {t("safetyDashboard.openModule")}
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
          {queueTab === "hazards" &&
            (actionQueue.overdueHazards.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("safetyDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.overdueHazards.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate">{h.description}</div>
                    <div className="text-mine-500 text-[11px]">{h.location}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold" style={{ color: RISK_COLORS[h.riskLevel] ?? "#8a9ab5" }}>
                      {t(`safetyDashboard.riskLevels.${h.riskLevel}`, h.riskLevel)}
                    </span>
                    {h.dueDate && <span className="text-danger-500 tabular-nums">{new Date(h.dueDate).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))
            ))}

          {queueTab === "inspections" &&
            (actionQueue.overdueInspections.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("safetyDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.overdueInspections.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0">
                  <span className="truncate">{i.title}</span>
                  <span className="text-danger-500 tabular-nums shrink-0">{new Date(i.scheduledDate).toLocaleDateString()}</span>
                </div>
              ))
            ))}

          {queueTab === "riskAssessments" &&
            (actionQueue.riskAssessmentsDue.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("safetyDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.riskAssessmentsDue.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0">
                  <span className="truncate">{r.title}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold" style={{ color: RISK_COLORS[r.residualRiskLevel] ?? "#8a9ab5" }}>
                      {t(`safetyDashboard.riskLevels.${r.residualRiskLevel}`, r.residualRiskLevel)}
                    </span>
                    <span className="text-danger-500 tabular-nums">{new Date(r.reviewDate).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            ))}

          {queueTab === "permits" &&
            (actionQueue.permitsAwaitingApproval.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("safetyDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.permitsAwaitingApproval.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0">
                  <span className="truncate">{p.workDescription}</span>
                  <span className="text-hazard-500 tabular-nums shrink-0">{new Date(p.endDate).toLocaleDateString()}</span>
                </div>
              ))
            ))}

          {queueTab === "medicals" &&
            (actionQueue.medicalsOverdue.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("safetyDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.medicalsOverdue.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0">
                  <span className="truncate">{m.workerName}</span>
                  <span className="text-danger-500 tabular-nums shrink-0">{new Date(m.nextExamDue).toLocaleDateString()}</span>
                </div>
              ))
            ))}
        </div>
      </div>

      <div className={cardOuter}>
        <h2 className="text-sm font-semibold mb-4">{t("safetyDashboard.recentIncidents")}</h2>
        <DataTable
          columns={incidentColumns}
          rows={recentIncidents}
          rowKey={(i) => i.id}
          emptyMessage={t("safetyDashboard.noIncidents")}
        />
      </div>
    </div>
  );
}
