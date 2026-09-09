import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../api/client";
import { HrDashboardSummary } from "../api/types";
import LoadError from "../components/LoadError";
import AiAssistantWidget from "../components/AiAssistantWidget";
import { UsersIcon, ClockIcon, IdCardIcon, AlertTriangleIcon } from "../components/icons/DashboardIcons";

// Same F-pattern / dashboard-designer approach as SafetyDashboard.tsx and
// OperationsDashboard.tsx. HR previously had a single workforce widget bolted onto the
// shared ExecutiveDashboard.

type Tone = "positive" | "negative" | "caution";
type QueueTab = "leave" | "certificates" | "disciplinary" | "grievances" | "requisitions";

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

const CATEGORY_COLORS = ["#3b82f6", "#c48a1f", "#22c55e", "#e13b2e", "#8a9ab5", "#c026d3", "#f0803c", "#0ea5e9", "#6b7280", "#a855f7"];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const gradientId = `hr-spark-${useId().replace(/:/g, "")}`;
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

export default function HrDashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<HrDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [queueTab, setQueueTab] = useState<QueueTab>("leave");

  async function load() {
    setLoadError(false);
    try {
      const res = await api.get<HrDashboardSummary>("/hr-dashboard/summary");
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

  const { headline, trends, breakdowns, recruitment, leave, actionQueue } = summary;

  const headcountTrend = trends.headcount.map((d) => d.count);
  const headcountChartData = trends.headcount.map((d) => ({
    date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count: d.count,
  }));

  const categoryData = Object.entries(breakdowns.workersByCategory)
    .map(([category, count]) => ({ name: t(`hrDashboard.categories.${category}`, category), category, value: count }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const queueCounts: Record<QueueTab, number> = {
    leave: actionQueue.pendingLeave.length,
    certificates: actionQueue.expiringCertificates.length,
    disciplinary: actionQueue.disciplinaryCases.length,
    grievances: actionQueue.grievanceCases.length,
    requisitions: actionQueue.openRequisitions.length,
  };
  const totalActions = Object.values(queueCounts).reduce((a, b) => a + b, 0);

  const queueTabs: { key: QueueTab; label: string; to: string }[] = [
    { key: "leave", label: t("hrDashboard.queue.leave"), to: "/workforce" },
    { key: "certificates", label: t("hrDashboard.queue.certificates"), to: "/workforce" },
    { key: "disciplinary", label: t("hrDashboard.queue.disciplinary"), to: "/labour-relations" },
    { key: "grievances", label: t("hrDashboard.queue.grievances"), to: "/labour-relations" },
    { key: "requisitions", label: t("hrDashboard.queue.requisitions"), to: "/workforce" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("hrDashboard.title")}</h1>
        <p className="text-mine-300 text-sm">{t("hrDashboard.subtitle")}</p>
      </div>

      {/* Level 1 — headline KPIs, each with an explicit target */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <HeadlineKpi
          icon={<UsersIcon />}
          label={t("hrDashboard.headcount")}
          value={headline.activeHeadcount}
          target={t("hrDashboard.headcountTarget")}
          trend={headcountTrend}
          trendColor="#3b82f6"
        />
        <HeadlineKpi
          icon={<ClockIcon />}
          label={t("hrDashboard.attendanceToday")}
          value={`${headline.attendanceTodayPct}%`}
          target={t("hrDashboard.attendanceHint")}
          tone={headline.attendanceTodayPct >= 90 ? "positive" : headline.attendanceTodayPct >= 75 ? "caution" : "negative"}
        />
        <HeadlineKpi
          icon={<IdCardIcon />}
          label={t("hrDashboard.certificates")}
          value={headline.certificatesExpired + headline.certificatesExpiringSoon}
          target={t("hrDashboard.certificatesTarget", { expired: headline.certificatesExpired })}
          tone={headline.certificatesExpired > 0 ? "negative" : headline.certificatesExpiringSoon > 0 ? "caution" : "positive"}
        />
        <HeadlineKpi
          icon={<AlertTriangleIcon />}
          label={t("hrDashboard.relationsCases")}
          value={headline.openRelationsCases}
          target={t("hrDashboard.relationsCasesTarget")}
          tone={headline.openRelationsCases > 0 ? "negative" : "positive"}
        />
      </div>

      {/* Level 2 — primary trend + secondary breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardOuter} lg:col-span-2`}>
          <h2 className="text-sm font-semibold">{t("hrDashboard.trendTitle")}</h2>
          <p className="text-[11px] text-mine-400 mt-0.5 mb-4">{t("hrDashboard.trendHint")}</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={headcountChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="hr-headcount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#52525b" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} domain={["dataMin - 2", "dataMax + 2"]} />
                <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#hr-headcount)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardOuter}>
          <h2 className="text-sm font-semibold mb-4">{t("hrDashboard.workforceByCategory")}</h2>
          {categoryData.length === 0 ? (
            <div className="text-xs text-mine-400 py-8 text-center">{t("hrDashboard.noWorkers")}</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 12 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#52525b" }} width={90} />
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

      {/* The AI assistant is a standalone feature, not a panel: it renders its own
          hazard-bordered card, so boxing it inside a cardOuter column would double the
          border and padding and mute the styling that marks it out. Full width, same as
          CooDashboard/CfoDashboard. */}
      <AiAssistantWidget showHrReportGenerator />

      {/* Level 3 — supporting detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("hrDashboard.recruitmentTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("hrDashboard.recruitmentHint")}</p>
          </div>
          <StatRow label={t("hrDashboard.openRequisitions")} value={recruitment.openRequisitions} />
          <StatRow label={t("hrDashboard.positionsOpen")} value={recruitment.positionsOpen} />
          <StatRow label={t("hrDashboard.candidatesInPipeline")} value={recruitment.candidatesInPipeline} />
          <StatRow label={t("hrDashboard.hiredLast30")} value={recruitment.candidatesHiredLast30} tone={recruitment.candidatesHiredLast30 > 0 ? "positive" : undefined} />
          <div className="border-t border-mine-800 pt-3 space-y-3">
            <StatRow label={t("hrDashboard.pendingLeave")} value={leave.pendingCount} tone={leave.pendingCount > 0 ? "caution" : "positive"} />
            <StatRow label={t("hrDashboard.approvedLeaveDays")} value={leave.approvedDaysLast30} />
          </div>
        </div>

        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("hrDashboard.relationsTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("hrDashboard.relationsHint")}</p>
          </div>
          <StatRow label={t("hrDashboard.disciplinaryOpen")} value={breakdowns.relationsCasesByType.DISCIPLINARY} tone={breakdowns.relationsCasesByType.DISCIPLINARY > 0 ? "caution" : "positive"} />
          <StatRow label={t("hrDashboard.grievancesOpen")} value={breakdowns.relationsCasesByType.GRIEVANCE} tone={breakdowns.relationsCasesByType.GRIEVANCE > 0 ? "caution" : "positive"} />
          <StatRow label={t("hrDashboard.ccmaOpen")} value={breakdowns.relationsCasesByType.CCMA} tone={breakdowns.relationsCasesByType.CCMA > 0 ? "negative" : "positive"} />
          <div className="pt-2">
            <Link to="/labour-relations" className="text-xs text-hazard-500 hover:underline">{t("hrDashboard.openLabourRelations")}</Link>
          </div>
        </div>
      </div>

      {/* Action queue — tabbed rather than five stacked tables */}
      <div className={cardOuter}>
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold">{t("hrDashboard.actionQueueTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">
              {totalActions === 0 ? t("hrDashboard.actionQueueClear") : t("hrDashboard.actionQueueCount", { count: totalActions })}
            </p>
          </div>
          <Link to={queueTabs.find((q) => q.key === queueTab)?.to ?? "/workforce"} className="text-xs text-hazard-500 hover:underline">
            {t("hrDashboard.openModule")}
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
          {queueTab === "leave" &&
            (actionQueue.pendingLeave.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("hrDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.pendingLeave.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{l.workerName}</div>
                    <div className="text-mine-500 text-[11px]">{t(`hrDashboard.leaveTypes.${l.leaveType}`, l.leaveType)} · {l.daysRequested} {t("hrDashboard.days")}</div>
                  </div>
                  <span className="text-mine-400 tabular-nums shrink-0">{new Date(l.createdAt).toLocaleDateString()}</span>
                </div>
              ))
            ))}

          {queueTab === "certificates" &&
            (actionQueue.expiringCertificates.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("hrDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.expiringCertificates.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{c.workerName}</div>
                    <div className="text-mine-500 text-[11px]">{t(`hrDashboard.certificateTypes.${c.type}`, c.type)}</div>
                  </div>
                  <span className={`tabular-nums shrink-0 ${c.expired ? "text-danger-500 font-semibold" : "text-hazard-500"}`}>
                    {new Date(c.expiryDate).toLocaleDateString()}
                  </span>
                </div>
              ))
            ))}

          {queueTab === "disciplinary" &&
            (actionQueue.disciplinaryCases.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("hrDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.disciplinaryCases.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{d.workerName}</div>
                    <div className="text-mine-500 text-[11px] truncate">{d.chargeDescription}</div>
                  </div>
                  <span className="text-mine-400 tabular-nums shrink-0">{d.hearingDate ? new Date(d.hearingDate).toLocaleDateString() : t("hrDashboard.noHearingSet")}</span>
                </div>
              ))
            ))}

          {queueTab === "grievances" &&
            (actionQueue.grievanceCases.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("hrDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.grievanceCases.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{g.workerName}</div>
                    <div className="text-mine-500 text-[11px] truncate">{g.description}</div>
                  </div>
                  <span className="text-mine-400 tabular-nums shrink-0">{new Date(g.dateRaised).toLocaleDateString()}</span>
                </div>
              ))
            ))}

          {queueTab === "requisitions" &&
            (actionQueue.openRequisitions.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("hrDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.openRequisitions.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate">{r.positionTitle}</div>
                    <div className="text-mine-500 text-[11px]">{t("hrDashboard.candidatesCount", { count: r.candidateCount })}</div>
                  </div>
                  <span className="text-mine-400 tabular-nums shrink-0">
                    {r.targetFillDate ? new Date(r.targetFillDate).toLocaleDateString() : t("hrDashboard.noTargetDate")}
                  </span>
                </div>
              ))
            ))}
        </div>
      </div>
    </div>
  );
}
