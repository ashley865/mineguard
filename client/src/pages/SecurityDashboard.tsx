import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../api/client";
import { SecurityDashboardSummary } from "../api/types";
import { SeverityBadge } from "../components/Badges";
import LoadError from "../components/LoadError";
import AiAssistantWidget from "../components/AiAssistantWidget";
import SecurityVisitorHistoryWidget from "../components/SecurityVisitorHistoryWidget";
import { AlertTriangleIcon, ShieldCheckIcon, ClipboardIcon, UsersIcon } from "../components/icons/DashboardIcons";

// Same F-pattern / dashboard-designer approach as the other department dashboards.
// Security Manager previously had only a single visitor-history widget bolted onto the
// shared ExecutiveDashboard.

type Tone = "positive" | "negative" | "caution";
type QueueTab = "incidents" | "visitors" | "patrols" | "vetting";

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

const CATEGORY_COLORS = ["#e13b2e", "#f0803c", "#c48a1f", "#c026d3", "#3b82f6", "#8a9ab5", "#22c55e", "#0ea5e9", "#a855f7", "#6b7280"];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const gradientId = `sec-spark-${useId().replace(/:/g, "")}`;
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

export default function SecurityDashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<SecurityDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [queueTab, setQueueTab] = useState<QueueTab>("incidents");

  async function load() {
    setLoadError(false);
    try {
      const res = await api.get<SecurityDashboardSummary>("/security-dashboard/summary");
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

  const { headline, trends, breakdowns, gateActivity, vetting, blacklist, actionQueue } = summary;

  const incidentTrend = trends.incidents.map((d) => d.count);
  const incidentChartData = trends.incidents.map((d) => ({
    date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count: d.count,
  }));

  const categoryData = Object.entries(breakdowns.incidentsByCategory)
    .map(([category, count]) => ({ name: t(`securityDashboard.incidentCategories.${category}`, category), category, value: count }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const queueCounts: Record<QueueTab, number> = {
    incidents: actionQueue.openIncidents.length,
    visitors: actionQueue.pendingVisitors.length,
    patrols: actionQueue.missedPatrols.length,
    vetting: actionQueue.vettingFailed.length,
  };
  const totalActions = Object.values(queueCounts).reduce((a, b) => a + b, 0);

  const queueTabs: { key: QueueTab; label: string; to: string }[] = [
    { key: "incidents", label: t("securityDashboard.queue.incidents"), to: "/security" },
    { key: "visitors", label: t("securityDashboard.queue.visitors"), to: "/visitors" },
    { key: "patrols", label: t("securityDashboard.queue.patrols"), to: "/security" },
    { key: "vetting", label: t("securityDashboard.queue.vetting"), to: "/vetting-records" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("securityDashboard.title")}</h1>
        <p className="text-mine-300 text-sm">{t("securityDashboard.subtitle")}</p>
      </div>

      {/* Level 1 — headline KPIs, each with an explicit target */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <HeadlineKpi
          icon={<AlertTriangleIcon />}
          label={t("securityDashboard.openIncidents")}
          value={headline.openIncidents}
          target={t("securityDashboard.criticalCount", { count: headline.criticalIncidents })}
          tone={headline.criticalIncidents > 0 ? "negative" : headline.openIncidents > 0 ? "caution" : "positive"}
          trend={incidentTrend}
          trendColor="#e13b2e"
        />
        <HeadlineKpi
          icon={<ShieldCheckIcon />}
          label={t("securityDashboard.cameraUptime")}
          value={`${headline.cameraUptimePct}%`}
          target={t("securityDashboard.camerasDownTarget", { count: headline.camerasDownCount })}
          tone={headline.camerasDownCount === 0 ? "positive" : headline.cameraUptimePct >= 80 ? "caution" : "negative"}
        />
        <HeadlineKpi
          icon={<ClipboardIcon />}
          label={t("securityDashboard.patrolCompliance")}
          value={headline.patrolCompliancePct !== null ? `${headline.patrolCompliancePct}%` : "—"}
          target={
            headline.patrolsScheduledToday > 0
              ? t("securityDashboard.patrolsScheduled", { count: headline.patrolsScheduledToday })
              : t("securityDashboard.noPatrolsScheduled")
          }
          tone={headline.patrolCompliancePct === null ? undefined : headline.patrolCompliancePct >= 90 ? "positive" : headline.patrolCompliancePct >= 70 ? "caution" : "negative"}
        />
        <HeadlineKpi
          icon={<UsersIcon />}
          label={t("securityDashboard.pendingVisitors")}
          value={headline.pendingVisitorApprovals}
          target={t("securityDashboard.pendingVisitorsTarget")}
          tone={headline.pendingVisitorApprovals > 0 ? "caution" : "positive"}
        />
      </div>

      {/* Level 2 — primary trend + secondary breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardOuter} lg:col-span-2`}>
          <h2 className="text-sm font-semibold">{t("securityDashboard.trendTitle")}</h2>
          <p className="text-[11px] text-mine-400 mt-0.5 mb-4">{t("securityDashboard.trendHint")}</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={incidentChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="sec-inc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e13b2e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#e13b2e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#52525b" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#e13b2e" strokeWidth={2} fill="url(#sec-inc)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardOuter}>
          <h2 className="text-sm font-semibold mb-4">{t("securityDashboard.incidentsByCategory")}</h2>
          {categoryData.length === 0 ? (
            <div className="text-xs text-mine-400 py-8 text-center">{t("securityDashboard.noOpenIncidents")}</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 12 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#52525b" }} width={100} />
                  <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {categoryData.map((d, i) => (
                      <Cell key={d.category} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
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
            <h2 className="text-sm font-semibold">{t("securityDashboard.gateActivityTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("securityDashboard.gateActivityHint")}</p>
          </div>
          <StatRow label={t("securityDashboard.gateIn")} value={gateActivity.inToday} />
          <StatRow label={t("securityDashboard.gateOut")} value={gateActivity.outToday} />
          <div className="border-t border-mine-800 pt-3 space-y-3">
            <StatRow label={t("securityDashboard.vettingPending")} value={vetting.pending} tone={vetting.pending > 0 ? "caution" : "positive"} />
            <StatRow label={t("securityDashboard.vettingFailed")} value={vetting.failed} tone={vetting.failed > 0 ? "negative" : "positive"} />
            <StatRow label={t("securityDashboard.activeBlacklist")} value={blacklist.activeEntries} />
          </div>
        </div>

        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("securityDashboard.visitorsTodayTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("securityDashboard.visitorsTodayHint")}</p>
          </div>
          {Object.keys(breakdowns.visitorsByStatusToday).length === 0 ? (
            <p className="text-xs text-mine-400 py-4 text-center">{t("securityDashboard.noVisitorsToday")}</p>
          ) : (
            Object.entries(breakdowns.visitorsByStatusToday).map(([status, count]) => (
              <StatRow key={status} label={t(`securityDashboard.visitorStatuses.${status}`, status)} value={count} />
            ))
          )}
          <div className="pt-2">
            <Link to="/visitors" className="text-xs text-hazard-500 hover:underline">{t("securityDashboard.openVisitors")}</Link>
          </div>
        </div>

        <div className={cardOuter}>
          <AiAssistantWidget />
        </div>
      </div>

      {/* Action queue — tabbed rather than four stacked tables */}
      <div className={cardOuter}>
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold">{t("securityDashboard.actionQueueTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">
              {totalActions === 0 ? t("securityDashboard.actionQueueClear") : t("securityDashboard.actionQueueCount", { count: totalActions })}
            </p>
          </div>
          <Link to={queueTabs.find((q) => q.key === queueTab)?.to ?? "/security"} className="text-xs text-hazard-500 hover:underline">
            {t("securityDashboard.openModule")}
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
          {queueTab === "incidents" &&
            (actionQueue.openIncidents.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("securityDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.openIncidents.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate">{i.description}</div>
                    <div className="text-mine-500 text-[11px]">{t(`securityDashboard.incidentCategories.${i.category}`, i.category)} {i.location ? `· ${i.location}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <SeverityBadge severity={i.severity} />
                    <span className="text-mine-400 tabular-nums">{new Date(i.occurredAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            ))}

          {queueTab === "visitors" &&
            (actionQueue.pendingVisitors.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("securityDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.pendingVisitors.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate">
                      {v.fullName} {v.isEmergency && <span className="text-danger-500 font-semibold">· {t("securityDashboard.emergency")}</span>}
                    </div>
                    <div className="text-mine-500 text-[11px] truncate">{t("securityDashboard.visitingLabel", { host: v.hostName, purpose: v.purposeOfVisit })}</div>
                  </div>
                  <span className="text-mine-400 tabular-nums shrink-0">{new Date(v.scheduledFor).toLocaleString()}</span>
                </div>
              ))
            ))}

          {queueTab === "patrols" &&
            (actionQueue.missedPatrols.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("securityDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.missedPatrols.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate">{p.routeName}</div>
                    <div className="text-mine-500 text-[11px]">{p.workerName}</div>
                  </div>
                  <span className="text-danger-500 tabular-nums shrink-0">{new Date(p.shiftDate).toLocaleDateString()}</span>
                </div>
              ))
            ))}

          {queueTab === "vetting" &&
            (actionQueue.vettingFailed.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("securityDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.vettingFailed.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate">{v.subjectName}</div>
                    <div className="text-mine-500 text-[11px]">{t(`securityDashboard.vettingCheckTypes.${v.checkType}`, v.checkType)}</div>
                  </div>
                  <span className="text-mine-400 tabular-nums shrink-0">{v.checkedDate ? new Date(v.checkedDate).toLocaleDateString() : "—"}</span>
                </div>
              ))
            ))}
        </div>
      </div>

      <SecurityVisitorHistoryWidget />
    </div>
  );
}
