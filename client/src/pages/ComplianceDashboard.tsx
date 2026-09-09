import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { api } from "../api/client";
import { ComplianceDashboardSummary } from "../api/types";
import LoadError from "../components/LoadError";
import AiAssistantWidget from "../components/AiAssistantWidget";
import { AlertTriangleIcon, CheckCircleIcon, ClipboardIcon, ListIcon } from "../components/icons/DashboardIcons";

// Same F-pattern / dashboard-designer approach as the other department dashboards.
// Compliance Officer previously had nothing of their own on the shared ExecutiveDashboard.

type Tone = "positive" | "negative" | "caution";
type QueueTab = "notices" | "findings" | "legalItems" | "submissions";

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

const STATUS_COLORS: Record<string, string> = {
  COMPLIANT: "#22c55e",
  PENDING: "#8a9ab5",
  IN_PROGRESS: "#3b82f6",
  NON_COMPLIANT: "#e13b2e",
  OVERDUE: "#f0803c",
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const gradientId = `comp-spark-${useId().replace(/:/g, "")}`;
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

export default function ComplianceDashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<ComplianceDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [queueTab, setQueueTab] = useState<QueueTab>("notices");

  async function load() {
    setLoadError(false);
    try {
      const res = await api.get<ComplianceDashboardSummary>("/compliance-dashboard/summary");
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

  const { headline, trends, breakdowns, workforceCompliance, actionQueue } = summary;

  const noticesTrend = trends.notices.map((d) => d.count);
  const combinedTrend = trends.notices.map((d, i) => ({
    date: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    notices: d.count,
    findings: trends.findings[i]?.count ?? 0,
  }));

  const statusOrder = ["NON_COMPLIANT", "OVERDUE", "IN_PROGRESS", "PENDING", "COMPLIANT"];
  const requirementsData = statusOrder
    .map((status) => ({ name: t(`complianceDashboard.requirementStatuses.${status}`, status), status, value: breakdowns.requirementsByStatus[status] ?? 0 }))
    .filter((d) => d.value > 0);

  const queueCounts: Record<QueueTab, number> = {
    notices: actionQueue.openNotices.length,
    findings: actionQueue.openFindings.length,
    legalItems: actionQueue.legalItems.length,
    submissions: actionQueue.submissionsOverdue.length,
  };
  const totalActions = Object.values(queueCounts).reduce((a, b) => a + b, 0);

  const queueTabs: { key: QueueTab; label: string; to: string }[] = [
    { key: "notices", label: t("complianceDashboard.queue.notices"), to: "/compliance" },
    { key: "findings", label: t("complianceDashboard.queue.findings"), to: "/compliance" },
    { key: "legalItems", label: t("complianceDashboard.queue.legalItems"), to: "/legal-compliance" },
    { key: "submissions", label: t("complianceDashboard.queue.submissions"), to: "/regulatory-submissions" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("complianceDashboard.title")}</h1>
        <p className="text-mine-300 text-sm">{t("complianceDashboard.subtitle")}</p>
      </div>

      {/* Level 1 — headline KPIs, each with an explicit target. Regulatory notices lead —
          an open Section 54/55 can mean a stopped operation, the highest-stakes item here. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <HeadlineKpi
          icon={<AlertTriangleIcon />}
          label={t("complianceDashboard.openNotices")}
          value={headline.openNotices}
          target={t("complianceDashboard.overdueNoticesTarget", { count: headline.overdueNotices })}
          tone={headline.overdueNotices > 0 ? "negative" : headline.openNotices > 0 ? "caution" : "positive"}
          trend={noticesTrend}
          trendColor="#e13b2e"
        />
        <HeadlineKpi
          icon={<CheckCircleIcon />}
          label={t("complianceDashboard.compliancePct")}
          value={`${headline.compliancePct}%`}
          target={t("complianceDashboard.nonCompliantTarget", { count: headline.nonCompliantRequirements })}
          tone={headline.compliancePct >= 90 ? "positive" : headline.compliancePct >= 70 ? "caution" : "negative"}
        />
        <HeadlineKpi
          icon={<ClipboardIcon />}
          label={t("complianceDashboard.openFindings")}
          value={headline.openFindings}
          target={t("complianceDashboard.overdueFindingsTarget", { count: headline.overdueFindings })}
          tone={headline.overdueFindings > 0 ? "negative" : headline.openFindings > 0 ? "caution" : "positive"}
        />
        <HeadlineKpi
          icon={<ListIcon />}
          label={t("complianceDashboard.itemsDueSoon")}
          value={headline.itemsDueSoon}
          target={t("complianceDashboard.itemsDueSoonTarget")}
          tone={headline.itemsDueSoon > 0 ? "caution" : "positive"}
        />
      </div>

      {/* Level 2 — primary trend + secondary breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardOuter} lg:col-span-2`}>
          <h2 className="text-sm font-semibold">{t("complianceDashboard.trendTitle")}</h2>
          <p className="text-[11px] text-mine-400 mt-0.5 mb-4">{t("complianceDashboard.trendHint")}</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={combinedTrend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="comp-notices" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e13b2e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#e13b2e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="comp-findings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f0803c" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f0803c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#52525b" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="notices"
                  name={t("complianceDashboard.noticesSeries") ?? "Notices"}
                  stroke="#e13b2e"
                  strokeWidth={2}
                  fill="url(#comp-notices)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="findings"
                  name={t("complianceDashboard.findingsSeries") ?? "Findings"}
                  stroke="#f0803c"
                  strokeWidth={1.5}
                  fill="url(#comp-findings)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardOuter}>
          <h2 className="text-sm font-semibold mb-4">{t("complianceDashboard.requirementsByStatus")}</h2>
          {requirementsData.length === 0 ? (
            <div className="text-xs text-mine-400 py-8 text-center">{t("complianceDashboard.noRequirements")}</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={requirementsData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 12 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#52525b" }} width={90} />
                  <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {requirementsData.map((d) => (
                      <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? "#8a9ab5"} />
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
            <h2 className="text-sm font-semibold">{t("complianceDashboard.noticesBySectionTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("complianceDashboard.noticesBySectionHint")}</p>
          </div>
          {Object.keys(breakdowns.noticesBySection).length === 0 ? (
            <p className="text-xs text-mine-400 py-4 text-center">{t("complianceDashboard.noOpenNotices")}</p>
          ) : (
            Object.entries(breakdowns.noticesBySection).map(([section, count]) => (
              <StatRow key={section} label={t(`complianceDashboard.noticeSections.${section}`, section)} value={count} tone="negative" />
            ))
          )}
          <div className="pt-2">
            <Link to="/compliance" className="text-xs text-hazard-500 hover:underline">{t("complianceDashboard.openCompliance")}</Link>
          </div>
        </div>

        <div className={`${cardOuter} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold">{t("complianceDashboard.workforceComplianceTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">{t("complianceDashboard.workforceComplianceHint")}</p>
          </div>
          <StatRow label={t("complianceDashboard.workersAssessed")} value={workforceCompliance.workersAssessed} />
          <StatRow label={t("complianceDashboard.workersWithGap")} value={workforceCompliance.workersWithGap} tone={workforceCompliance.workersWithGap > 0 ? "negative" : "positive"} />
        </div>

        <div className={cardOuter}>
          <AiAssistantWidget />
        </div>
      </div>

      {/* Action queue — tabbed rather than four stacked tables */}
      <div className={cardOuter}>
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold">{t("complianceDashboard.actionQueueTitle")}</h2>
            <p className="text-[11px] text-mine-400 mt-0.5">
              {totalActions === 0 ? t("complianceDashboard.actionQueueClear") : t("complianceDashboard.actionQueueCount", { count: totalActions })}
            </p>
          </div>
          <Link to={queueTabs.find((q) => q.key === queueTab)?.to ?? "/compliance"} className="text-xs text-hazard-500 hover:underline">
            {t("complianceDashboard.openModule")}
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
          {queueTab === "notices" &&
            (actionQueue.openNotices.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("complianceDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.openNotices.map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate">{n.noticeNumber} — {t(`complianceDashboard.noticeSections.${n.section}`, n.section)}</div>
                    <div className="text-mine-500 text-[11px] truncate">{n.description}</div>
                  </div>
                  <span className="text-danger-500 tabular-nums shrink-0">
                    {n.complianceDeadline ? new Date(n.complianceDeadline).toLocaleDateString() : t("complianceDashboard.noDeadline")}
                  </span>
                </div>
              ))
            ))}

          {queueTab === "findings" &&
            (actionQueue.openFindings.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("complianceDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.openFindings.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate">{f.findingNumber} — {f.requirementViolated}</div>
                    <div className="text-mine-500 text-[11px]">{t(`complianceDashboard.riskLevels.${f.severity}`, f.severity)}</div>
                  </div>
                  <span className="text-danger-500 tabular-nums shrink-0">{new Date(f.dueDate).toLocaleDateString()}</span>
                </div>
              ))
            ))}

          {queueTab === "legalItems" &&
            (actionQueue.legalItems.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("complianceDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.legalItems.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate">{l.title}</div>
                    <div className="text-mine-500 text-[11px]">{t(`complianceDashboard.legalCategories.${l.category}`, l.category)}</div>
                  </div>
                  <span className={`tabular-nums shrink-0 ${l.status === "OVERDUE" ? "text-danger-500 font-semibold" : "text-hazard-500"}`}>
                    {new Date(l.dueDate).toLocaleDateString()}
                  </span>
                </div>
              ))
            ))}

          {queueTab === "submissions" &&
            (actionQueue.submissionsOverdue.length === 0 ? (
              <p className="text-xs text-mine-400 py-4 text-center">{t("complianceDashboard.queueEmpty")}</p>
            ) : (
              actionQueue.submissionsOverdue.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 text-xs border-b border-mine-800 pb-2 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate">{s.subject}</div>
                    <div className="text-mine-500 text-[11px]">{s.regulator}</div>
                  </div>
                  <span className="text-danger-500 tabular-nums shrink-0">
                    {s.dueDate ? new Date(s.dueDate).toLocaleDateString() : t("complianceDashboard.noDeadline")}
                  </span>
                </div>
              ))
            ))}
        </div>
      </div>
    </div>
  );
}
