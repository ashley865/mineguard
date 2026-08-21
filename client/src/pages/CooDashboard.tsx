import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api } from "../api/client";
import { Alert, ExecutiveSummary, Incident, ReportTrends } from "../api/types";
import { SeverityBadge } from "../components/Badges";
import { buttonPrimary, buttonSecondary } from "../components/ui";
import DataTable, { DataTableColumn } from "../components/DataTable";
import { CheckCircleIcon, ShieldCheckIcon, GaugeIcon, UsersIcon, AlertTriangleIcon, ChevronRightIcon } from "../components/icons/DashboardIcons";
import ExecutiveScorecard from "../components/ExecutiveScorecard";
import ProductionAnalyticsWidget from "../components/ProductionAnalyticsWidget";
import InventoryProcurementWidget from "../components/InventoryProcurementWidget";
import MaintenanceDowntimeWidget from "../components/MaintenanceDowntimeWidget";
import BudgetSummaryWidget from "../components/BudgetSummaryWidget";
import AiAssistantWidget from "../components/AiAssistantWidget";
import LiveDataWidget from "../components/LiveDataWidget";
import IndustryNewsWidget from "../components/IndustryNewsWidget";

// Built with the dashboard-designer skill's F-pattern: a small headline row of
// target-comparable KPIs (top-left, biggest), a primary + secondary chart row,
// an "Operations" tab group instead of four stacked full-height widgets (the skill's
// "max 6-8 charts per screen" + "drill-down by click" rules), then supporting detail.
// The skill's own best practice is "one dashboard, one audience" — the COO was
// previously served the same shared ExecutiveDashboard as every other title with
// widgets just appended in a fixed order; this is a dedicated layout instead.

type Tone = "positive" | "negative" | "caution";
type OpsTab = "production" | "inventory" | "maintenance" | "budget";

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

// Level 1 (headline) KPI: large value + an explicit comparison target, per the
// skill's "every KPI needs a target or it's meaningless" rule. `trend` is optional and
// only ever passed real historical data — cards without a genuine series behind them
// just don't get a sparkline rather than showing a fabricated one.
function HeadlineKpi({
  icon,
  label,
  value,
  target,
  tone,
  trend,
  trendColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  target: string;
  tone?: Tone;
  trend?: number[];
  trendColor?: string;
}) {
  return (
    <div className={`${cardOuter} p-6`}>
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

function RateRow({ label, numerator, denominator }: { label: string; numerator: number; denominator: number }) {
  const pct = denominator === 0 ? 100 : Math.round((numerator / denominator) * 100);
  const tone: Tone = pct >= 80 ? "positive" : pct >= 50 ? "caution" : "negative";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-mine-300">{label}</span>
      <span className={`font-semibold tabular-nums ${toneText(tone)}`}>{pct}%</span>
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
            <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 }} />
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
            <span className="font-semibold text-mine-50 tabular-nums">{d.value}</span>
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

export default function CooDashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [trends, setTrends] = useState<ReportTrends | null>(null);
  const [opsTab, setOpsTab] = useState<OpsTab>("production");
  const [reviewsExpanded, setReviewsExpanded] = useState(false);

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

  const { siteStatus, alertSeverity, complianceScore, incidents, incidentTrend, workers, equipment, pendingReviews } = summary;
  const totalSites = siteStatus.OPERATIONAL + siteStatus.RESTRICTED + siteStatus.SHUT_DOWN;
  const onShiftPct = workers.total > 0 ? Math.round((workers.onShift / workers.total) * 100) : 100;

  // Real daily counts from /reports/trends — "new per day", the closest genuine trend
  // signal behind the incidents/alerts KPIs, not a replay of the open-count snapshots.
  const incidentsSparkline = trends?.trend.map((d) => d.incidents) ?? [];
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
      <div>
        <h1 className="text-lg font-bold">{t("executive.coo.title")}</h1>
        <p className="text-mine-300 text-xs mt-0.5">
          {t("executive.coo.briefing", { operational: siteStatus.OPERATIONAL, total: totalSites, compliance: complianceScore, uptime: equipment.uptimePct })}
        </p>
      </div>

      {/* Level 1 — headline KPIs, each with an explicit target */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <HeadlineKpi
          icon={<ShieldCheckIcon />}
          label={t("executive.complianceScore")}
          value={`${complianceScore}%`}
          target={t("executive.coo.targetPct", { pct: 80 })}
          tone={complianceScore >= 80 ? "positive" : complianceScore >= 50 ? "caution" : "negative"}
        />
        <HeadlineKpi
          icon={<GaugeIcon />}
          label={t("executive.equipmentUptime")}
          value={`${equipment.uptimePct}%`}
          target={t("executive.coo.targetPct", { pct: 80 })}
          tone={equipment.uptimePct >= 80 ? "positive" : equipment.uptimePct >= 50 ? "caution" : "negative"}
        />
        <HeadlineKpi
          icon={<UsersIcon />}
          label={t("executive.onShiftNow")}
          value={`${onShiftPct}%`}
          target={t("executive.coo.targetPct", { pct: 60 })}
          tone={onShiftPct >= 60 ? "positive" : "caution"}
        />
        <HeadlineKpi
          icon={<CheckCircleIcon />}
          label={t("executive.coo.sitesOperational")}
          value={`${siteStatus.OPERATIONAL}/${totalSites}`}
          target={t("executive.coo.targetAllSites")}
          tone={siteStatus.OPERATIONAL === totalSites ? "positive" : siteStatus.SHUT_DOWN > 0 ? "negative" : "caution"}
        />
        <HeadlineKpi
          icon={<AlertTriangleIcon />}
          label={t("executive.coo.openCriticalIncidents")}
          value={incidents.open}
          target={t("executive.coo.targetZero")}
          tone={incidents.open === 0 ? "positive" : "negative"}
          trend={incidentsSparkline}
          trendColor={incidents.open === 0 ? "#16a34a" : "#e13b2e"}
        />
      </div>

      {/* Primary + secondary chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ExecutiveScorecard summary={summary} />
        </div>
        <div className={cardOuter}>
          <h2 className="text-sm font-semibold mb-4">{t("executive.incidentTrend")}</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incidentTrend}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#52525b" }} tickFormatter={(d: string) => d.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "#52525b" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 }} />
                <Bar dataKey="count" fill="#c48a1f" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <AiAssistantWidget showDepartmentReportGenerator />
      <LiveDataWidget />
      <IndustryNewsWidget />

      {/* Operations detail — tabbed instead of four stacked full-height widgets */}
      <div>
        <div className="flex gap-2 flex-wrap mb-4">
          <button className={opsTab === "production" ? buttonPrimary : buttonSecondary} onClick={() => setOpsTab("production")}>{t("reporting.tabProduction")}</button>
          <button className={opsTab === "inventory" ? buttonPrimary : buttonSecondary} onClick={() => setOpsTab("inventory")}>{t("reporting.tabInventory")}</button>
          <button className={opsTab === "maintenance" ? buttonPrimary : buttonSecondary} onClick={() => setOpsTab("maintenance")}>{t("reporting.tabMaintenance")}</button>
          <button className={opsTab === "budget" ? buttonPrimary : buttonSecondary} onClick={() => setOpsTab("budget")}>{t("executive.budgetHealth.title")}</button>
        </div>
        {opsTab === "production" && <ProductionAnalyticsWidget />}
        {opsTab === "inventory" && <InventoryProcurementWidget />}
        {opsTab === "maintenance" && <MaintenanceDowntimeWidget />}
        {opsTab === "budget" && <BudgetSummaryWidget />}
      </div>

      {/* Supporting detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

        {trends && (
          <div className={cardOuter}>
            <h2 className="text-sm font-semibold mb-3">{t("executive.complianceBreakdown")}</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <RateRow label={t("compliance.tabCop")} numerator={trends.compliance.codesOfPractice.active} denominator={trends.compliance.codesOfPractice.total} />
              <RateRow label={t("compliance.tabRisk")} numerator={trends.compliance.riskAssessments.approved} denominator={trends.compliance.riskAssessments.total} />
              <RateRow label={t("permits.nav")} numerator={trends.compliance.permits.active} denominator={trends.compliance.permits.total} />
              <RateRow label={t("compliance.tabInspections")} numerator={trends.compliance.safetyInspections.completed} denominator={trends.compliance.safetyInspections.total} />
            </div>
          </div>
        )}
      </div>

      <div className={cardOuter}>
        <h2 className="text-sm font-semibold mb-4">{t("executive.pendingReviews")}</h2>
        <DataTable
          columns={reviewColumns}
          rows={reviewsExpanded ? reviewItems : reviewItems.slice(0, 5)}
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
        {reviewItems.length > 5 && (
          <div className="flex justify-center mt-4 pt-4 border-t border-mine-800">
            <button
              type="button"
              onClick={() => setReviewsExpanded((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-hazard-600 hover:text-hazard-500 bg-hazard-500/5 hover:bg-hazard-500/10 border border-hazard-500/20 hover:border-hazard-500/40 rounded-full px-4 py-2 transition-colors"
            >
              {reviewsExpanded ? t("executive.showFewerReviews") : t("executive.readMoreReviews", { count: reviewItems.length - 5 })}
              <span className={`inline-flex transition-transform duration-200 ${reviewsExpanded ? "-rotate-90" : "rotate-90"}`}>
                <ChevronRightIcon />
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
