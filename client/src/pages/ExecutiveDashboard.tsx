import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Alert, ExecutiveSummary, Incident, ReportTrends } from "../api/types";
import { SeverityBadge } from "../components/Badges";
import { buttonPrimary, buttonSecondary } from "../components/ui";
import DataTable, { DataTableColumn } from "../components/DataTable";
import { CheckCircleIcon, AlertTriangleIcon, XCircleIcon, GaugeIcon } from "../components/icons/DashboardIcons";
import FinancialSummaryWidget from "../components/FinancialSummaryWidget";
import HrWorkforceWidget from "../components/HrWorkforceWidget";
import SecurityVisitorHistoryWidget from "../components/SecurityVisitorHistoryWidget";
import ProductionAnalyticsWidget from "../components/ProductionAnalyticsWidget";
import InventoryProcurementWidget from "../components/InventoryProcurementWidget";
import MaintenanceDowntimeWidget from "../components/MaintenanceDowntimeWidget";
import AiAssistantWidget from "../components/AiAssistantWidget";
import LiveDataWidget, { MINERAL_PRICE_RELEVANT_TITLES } from "../components/LiveDataWidget";
import IndustryNewsWidget from "../components/IndustryNewsWidget";
import ExecutiveScorecard from "../components/ExecutiveScorecard";
import BudgetSummaryWidget from "../components/BudgetSummaryWidget";

type Tone = "positive" | "negative" | "caution";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 9, fill: "#52525b" };
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

function OpsCard({ label, value, to, tone }: { label: string; value: number; to: string; tone?: Tone }) {
  return (
    <Link to={to} className={`${cardOuter} p-[22px] block hover:border-hazard-500 transition-colors`}>
      <div className="text-[10px] text-mine-300 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${toneText(tone)}`}>{value}</div>
    </Link>
  );
}

function IconStatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone?: Tone }) {
  return (
    <div className={`${cardOuter} p-[22px]`}>
      <div className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center mb-3.5 ${TONE_BADGE[tone ?? "neutral"]}`}>{icon}</div>
      <div className={`text-lg font-bold leading-none truncate ${toneText(tone)}`}>{value}</div>
      <div className="text-xs text-mine-400 mt-2">{label}</div>
    </div>
  );
}

function RateRow({ label, numerator, denominator }: { label: string; numerator: number; denominator: number }) {
  const pct = denominator === 0 ? 100 : Math.round((numerator / denominator) * 100);
  const tone: Tone = pct >= 80 ? "positive" : pct >= 50 ? "caution" : "negative";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-mine-300">{label}</span>
      <span className={`font-semibold ${toneText(tone)}`}>{pct}%</span>
    </div>
  );
}

// Small inline trend line, no axes/grid — a decorative-but-real indicator dropped into
// KPI cards and chart headers wherever genuine day-by-day or month-by-month data backs
// it (never fabricated). Each instance needs its own gradient id or multiple sparklines
// on the same page collide on the same <defs> id and borrow each other's color.
function Sparkline({ data, color, className = "h-7 w-full" }: { data: number[]; color: string; className?: string }) {
  const gradientId = `spark-${useId().replace(/:/g, "")}`;
  if (data.length < 2) return null;
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
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

function MiniPie({ data, emptyLabel }: { data: { name: string; value: number; color: string }[]; emptyLabel: string }) {
  const { t } = useTranslation();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return <div className="text-mine-400 text-xs h-32 flex items-center justify-center">{emptyLabel}</div>;
  }
  return (
    <div className="h-32 flex items-center gap-2">
      <div className="w-24 h-24 shrink-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={22} outerRadius={40} paddingAngle={2}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-sm font-bold text-mine-50 tabular-nums leading-none">{total}</div>
          <div className="text-[7px] text-mine-400 uppercase tracking-wide mt-0.5">{t("common.total")}</div>
        </div>
      </div>
      <div className="space-y-1 text-xs flex-1 min-w-0">
        {data.filter((d) => d.value > 0).map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-mine-300 truncate">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
              {d.name}
            </span>
            <span className="font-semibold text-mine-50">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Compact approve/reject cell for a table row — the note input and buttons only;
// the item's own details render as ordinary table columns instead of being bundled
// into the same block, so a page of pending items reads as one scannable table.
function ReviewActions({ onApprove, onReject }: { onApprove: (note: string) => void; onReject: (note: string) => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col items-end gap-1">
      <input
        className="w-32 bg-mine-800 border border-mine-700 rounded-md px-1.5 py-1 text-[10px]"
        placeholder={t("common.reviewNotePlaceholder") ?? ""}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-1">
        <button className={`${buttonPrimary} text-[10px] px-2 py-0.5`} onClick={() => onApprove(note)}>{t("common.approve")}</button>
        <button className={`${buttonSecondary} text-[10px] px-2 py-0.5`} onClick={() => onReject(note)}>{t("common.reject")}</button>
      </div>
    </div>
  );
}

type ReviewItem = { kind: "alert"; data: Alert } | { kind: "incident"; data: Incident };

export default function ExecutiveDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // CFO has its own dedicated CfoDashboard.tsx and COO its own CooDashboard.tsx
  // (both routed in App.tsx's HomeRoute) — neither title ever renders this component,
  // so this file's gates only need to account for GM and the other titles.
  const canSeeFinancials = user?.title === "GENERAL_MANAGER";
  const canSeeHrWorkforce = user?.title === "HR_MANAGER";
  const canSeeVisitorHistory = user?.title === "SECURITY_MANAGER";
  // GM has full module access to Production/Inventory/Maintenance already (see
  // executiveAccess.ts's fullAccess list) but this dashboard didn't reflect it — GM
  // was the only "full access" title with nothing operational of their own here.
  const canSeeProductionAnalytics = user?.title === "OPERATIONS_MANAGER" || user?.title === "GENERAL_MANAGER";
  const isGeneralManager = user?.title === "GENERAL_MANAGER";
  const canSeeBudget = canSeeFinancials;
  // Every executive title has an AI module now except the generic "OTHER" catch-all.
  const canSeeAiAssistant = !!user?.title && user.title !== "OTHER";
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [trends, setTrends] = useState<ReportTrends | null>(null);

  async function load() {
    const [s, r] = await Promise.all([
      api.get<ExecutiveSummary>("/executive/summary"),
      api.get<ReportTrends>("/reports/trends", { params: { days: 30 } }),
    ]);
    setSummary(s.data);
    setTrends(r.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function reviewAlert(id: string, decision: "APPROVED" | "REJECTED", note: string) {
    await api.post(`/alerts/${id}/review`, { decision, note: note || undefined });
    await load();
  }

  async function reviewIncident(id: string, decision: "APPROVED" | "REJECTED", note: string) {
    await api.post(`/incidents/${id}/review`, { decision, note: note || undefined });
    await load();
  }

  if (!summary) {
    return <div className="text-mine-300">{t("executive.loading")}</div>;
  }

  const { siteStatus, alertSeverity, complianceScore, executiveOps, incidents, incidentTrend, workers, equipment, pendingReviews } =
    summary;
  const scoreTone =
    complianceScore >= 80 ? "text-success-500" : complianceScore >= 50 ? "text-hazard-500" : "text-danger-500";

  const suggestions: { text: string; tone: Tone }[] = [];
  if (siteStatus.SHUT_DOWN > 0) {
    suggestions.push({ text: t("executive.suggestions.sitesShutDown", { count: siteStatus.SHUT_DOWN }), tone: "negative" });
  }
  if (alertSeverity.CRITICAL > 0) {
    suggestions.push({ text: t("executive.suggestions.criticalAlerts", { count: alertSeverity.CRITICAL }), tone: "negative" });
  }
  if (pendingReviews.alerts.length > 0) {
    suggestions.push({ text: t("executive.suggestions.pendingAlertReviews", { count: pendingReviews.alerts.length }), tone: "caution" });
  }
  if (pendingReviews.incidents.length > 0) {
    suggestions.push({ text: t("executive.suggestions.pendingIncidentReviews", { count: pendingReviews.incidents.length }), tone: "caution" });
  }
  if (executiveOps.hasSiteAccess && executiveOps.escalatedRisks > 0) {
    suggestions.push({ text: t("executive.suggestions.escalatedRisks", { count: executiveOps.escalatedRisks }), tone: "negative" });
  }
  if (executiveOps.hasSiteAccess && executiveOps.pendingPermitsToWork > 0) {
    suggestions.push({ text: t("executive.suggestions.pendingPermits", { count: executiveOps.pendingPermitsToWork }), tone: "caution" });
  }
  if (equipment.uptimePct < 80) {
    suggestions.push({ text: t("executive.suggestions.lowUptime", { pct: equipment.uptimePct }), tone: "caution" });
  }
  if (complianceScore < 80) {
    suggestions.push({ text: t("executive.suggestions.lowCompliance", { pct: complianceScore }), tone: "caution" });
  }
  if (trends && trends.compliance.trainingRecords.expiringSoon > 0) {
    suggestions.push({ text: t("executive.suggestions.trainingExpiring", { count: trends.compliance.trainingRecords.expiringSoon }), tone: "caution" });
  }
  if (suggestions.length === 0) {
    suggestions.push({ text: t("executive.suggestions.allClear"), tone: "positive" });
  }
  const suggestionDot: Record<Tone, string> = {
    positive: "bg-success-500",
    caution: "bg-hazard-500",
    negative: "bg-danger-500",
  };

  // Real daily counts from /reports/trends — "new per day", not a replay of the
  // open-alert snapshot above it, but the closest genuine trend signal available.
  const alertsSparkline = trends?.trend.map((d) => d.alerts) ?? [];

  const reviewItems: ReviewItem[] = [
    ...pendingReviews.alerts.map((a): ReviewItem => ({ kind: "alert", data: a })),
    ...pendingReviews.incidents.map((i): ReviewItem => ({ kind: "incident", data: i })),
  ].sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime());

  const reviewColumns: DataTableColumn<ReviewItem>[] = [
    {
      key: "date",
      header: t("common.date"),
      sortValue: (r) => r.data.createdAt,
      render: (r) => <span className="text-mine-400 whitespace-nowrap">{new Date(r.data.createdAt).toLocaleString()}</span>,
    },
    {
      key: "type",
      header: t("common.type"),
      render: (r) => (
        <span className="text-[10px] uppercase tracking-wide text-mine-400">
          {r.kind === "alert" ? t("executive.pendingAlerts") : t("executive.pendingIncidents")}
        </span>
      ),
    },
    {
      key: "detail",
      header: t("common.description"),
      render: (r) => (
        <div className="max-w-xs">
          <div className="font-medium text-mine-50 truncate">{r.kind === "alert" ? r.data.message : r.data.title}</div>
          <div className="text-[10px] text-mine-400 truncate">
            {r.data.site?.name}
            {r.data.zone?.name ? ` · ${r.data.zone.name}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "severity",
      header: t("common.status"),
      render: (r) => <SeverityBadge severity={r.data.severity} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold">{t("executive.title")}</h1>
          <p className="text-mine-300 text-xs">{t("executive.subtitle")}</p>
        </div>
        <div className={`${cardOuter} p-[22px] text-right`}>
          <div className="text-[10px] text-mine-300 uppercase tracking-wide">{t("executive.complianceScore")}</div>
          <div className={`text-2xl font-bold ${scoreTone}`}>{complianceScore}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <IconStatCard icon={<CheckCircleIcon />} label={t("executive.operational")} value={siteStatus.OPERATIONAL} tone="positive" />
        <IconStatCard icon={<AlertTriangleIcon />} label={t("executive.restricted")} value={siteStatus.RESTRICTED} tone={siteStatus.RESTRICTED > 0 ? "caution" : undefined} />
        <IconStatCard icon={<XCircleIcon />} label={t("executive.shutDown")} value={siteStatus.SHUT_DOWN} tone={siteStatus.SHUT_DOWN > 0 ? "negative" : undefined} />
        <IconStatCard icon={<GaugeIcon />} label={t("executive.equipmentUptime")} value={`${equipment.uptimePct}%`} tone={equipment.uptimePct >= 80 ? "positive" : equipment.uptimePct >= 50 ? "caution" : "negative"} />
      </div>

      {isGeneralManager && <ExecutiveScorecard summary={summary} />}

      {executiveOps.hasSiteAccess ? (
        <>
          <div className={`${cardOuter} flex items-center justify-between flex-wrap gap-3`}>
            <div>
              <h2 className="text-sm font-semibold">{t("executive.peopleOnSite")}</h2>
              <p className="text-xs text-mine-400 mt-1">
                {t("executive.peopleOnSiteBreakdown", {
                  visitors: executiveOps.peopleOnSite.visitors,
                  staff: executiveOps.peopleOnSite.staff,
                  drivers: executiveOps.peopleOnSite.truckDrivers,
                })}
              </p>
            </div>
            <div className="text-2xl font-bold text-mine-50">{executiveOps.peopleOnSite.total}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <OpsCard label={t("executive.visitorsOnSite")} value={executiveOps.visitorsOnSite} to="/visitors" />
            <OpsCard
              label={t("executive.pendingPermitsToWork")}
              value={executiveOps.pendingPermitsToWork}
              to="/permits-to-work"
              tone={executiveOps.pendingPermitsToWork > 0 ? "caution" : "positive"}
            />
            <OpsCard
              label={t("executive.escalatedRisks")}
              value={executiveOps.escalatedRisks}
              to="/compliance"
              tone={executiveOps.escalatedRisks > 0 ? "negative" : "positive"}
            />
          </div>
        </>
      ) : (
        <div className={`${cardOuter} text-xs text-mine-300`}>{t("executive.noSiteAccess")}</div>
      )}

      {trends && (
        <div className={cardOuter}>
          <h2 className="text-sm font-semibold mb-4">{t("executive.complianceBreakdown")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
            <RateRow label={t("compliance.tabCop")} numerator={trends.compliance.codesOfPractice.active} denominator={trends.compliance.codesOfPractice.total} />
            <RateRow label={t("compliance.tabRisk")} numerator={trends.compliance.riskAssessments.approved} denominator={trends.compliance.riskAssessments.total} />
            <RateRow label={t("permits.nav")} numerator={trends.compliance.permits.active} denominator={trends.compliance.permits.total} />
            <RateRow label={t("compliance.tabInspections")} numerator={trends.compliance.safetyInspections.completed} denominator={trends.compliance.safetyInspections.total} />
            <RateRow label={t("workforce.tabCertificates")} numerator={trends.compliance.certificates.active} denominator={trends.compliance.certificates.total} />
            <RateRow label={t("reporting.trainingCurrent")} numerator={trends.compliance.trainingRecords.total - trends.compliance.trainingRecords.expiringSoon} denominator={trends.compliance.trainingRecords.total} />
            <RateRow label={t("contractors.nav")} numerator={trends.compliance.contractors.active} denominator={trends.compliance.contractors.total} />
          </div>
        </div>
      )}

      {canSeeAiAssistant && (
        <>
          <AiAssistantWidget
            showReportGenerator={user?.title === "GENERAL_MANAGER"}
            showHrReportGenerator={user?.title === "HR_MANAGER"}
            showDepartmentReportGenerator={
              !!user?.title && !["GENERAL_MANAGER", "HR_MANAGER", "OTHER"].includes(user.title)
            }
          />
          <LiveDataWidget showMineralPrices={!!user?.title && MINERAL_PRICE_RELEVANT_TITLES.includes(user.title)} />
          <IndustryNewsWidget />
        </>
      )}
      {canSeeFinancials && <FinancialSummaryWidget />}
      {canSeeBudget && <BudgetSummaryWidget />}
      {canSeeHrWorkforce && <HrWorkforceWidget />}
      {canSeeVisitorHistory && <SecurityVisitorHistoryWidget />}
      {canSeeProductionAnalytics && <ProductionAnalyticsWidget />}
      {canSeeProductionAnalytics && <InventoryProcurementWidget />}
      {canSeeProductionAnalytics && <MaintenanceDowntimeWidget />}

      <div className={cardOuter}>
        <h2 className="text-sm font-semibold mb-4">{t("executive.suggestionsTitle")}</h2>
        <ul className="space-y-2">
          {suggestions.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-mine-200">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${suggestionDot[s.tone]}`} />
              {s.text}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={cardOuter}>
          <div className="flex items-center justify-between gap-3 mb-1">
            <h2 className="text-sm font-semibold">{t("executive.openAlertsBySeverity")}</h2>
            {alertsSparkline.length >= 2 && <Sparkline data={alertsSparkline} color="#8a9ab5" className="h-6 w-20 shrink-0" />}
          </div>
          {alertsSparkline.length >= 2 && (
            <p className="text-[10px] text-mine-400 mb-2">{t("executive.alertsTrendCaption", { days: trends?.days ?? 30 })}</p>
          )}
          <MiniPie
            emptyLabel={t("dashboard.noOpenAlerts")}
            data={[
              { name: t("badges.severity.CRITICAL"), value: alertSeverity.CRITICAL, color: "#e13b2e" },
              { name: t("badges.severity.HIGH"), value: alertSeverity.HIGH, color: "#f3665b" },
              { name: t("badges.severity.MEDIUM"), value: alertSeverity.MEDIUM, color: "#d9a441" },
              { name: t("badges.severity.LOW"), value: alertSeverity.LOW, color: "#8a9ab5" },
            ]}
          />
        </div>

        <div className={cardOuter}>
          <h2 className="text-sm font-semibold mb-3">{t("executive.incidentOverview")}</h2>
          <MiniPie
            emptyLabel={t("executive.noPendingIncidents")}
            data={[
              { name: t("executive.open"), value: incidents.open, color: "#e13b2e" },
              { name: t("executive.investigating"), value: incidents.investigating, color: "#c48a1f" },
              { name: t("executive.resolved"), value: incidents.resolved, color: "#16a34a" },
            ]}
          />
        </div>

        <div className={cardOuter}>
          <h2 className="text-sm font-semibold mb-3">{t("executive.workforce")}</h2>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-mine-300">{t("executive.totalWorkers")}</span>
              <span className="font-semibold">{workers.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-mine-300">{t("executive.onShiftNow")}</span>
              <span className="font-semibold">{workers.onShift}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-mine-300">{t("executive.equipmentUptime")}</span>
              <span className="font-semibold">
                {t("executive.operationalOf", { operational: equipment.operational, total: equipment.total })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={cardOuter}>
        <h2 className="text-sm font-semibold mb-4">{t("executive.incidentTrend")}</h2>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incidentTrend}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "#52525b" }}
                tickFormatter={(d: string) => d.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 9, fill: "#52525b" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 }} />
              <Bar dataKey="count" fill="#c48a1f" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={cardOuter}>
        <h2 className="text-sm font-semibold mb-4">{t("executive.pendingReviews")}</h2>
        <DataTable
          columns={reviewColumns}
          rows={reviewItems}
          rowKey={(r) => `${r.kind}-${r.data.id}`}
          emptyMessage={t("executive.noPendingReviews")}
          actions={(r) =>
            r.kind === "alert" ? (
              <ReviewActions onApprove={(note) => reviewAlert(r.data.id, "APPROVED", note)} onReject={(note) => reviewAlert(r.data.id, "REJECTED", note)} />
            ) : (
              <ReviewActions onApprove={(note) => reviewIncident(r.data.id, "APPROVED", note)} onReject={(note) => reviewIncident(r.data.id, "REJECTED", note)} />
            )
          }
        />
      </div>
    </div>
  );
}
