import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api } from "../api/client";
import { Alert, ExecutiveSummary, Incident, ReportTrends } from "../api/types";
import { SeverityBadge } from "../components/Badges";
import { buttonPrimary, buttonSecondary } from "../components/ui";
import { CheckCircleIcon, ShieldCheckIcon, GaugeIcon, UsersIcon, AlertTriangleIcon } from "../components/icons/DashboardIcons";
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

// Level 1 (headline) KPI: large value + an explicit comparison target, per the
// skill's "every KPI needs a target or it's meaningless" rule.
function HeadlineKpi({ icon, label, value, target, tone }: { icon: React.ReactNode; label: string; value: string | number; target: string; tone?: Tone }) {
  return (
    <div className={`${cardOuter} p-6`}>
      <div className={`w-9 h-9 rounded-[11px] flex items-center justify-center mb-4 ${TONE_BADGE[tone ?? "neutral"]}`}>{icon}</div>
      <div className={`text-[32px] font-bold leading-none tabular-nums ${toneText(tone)}`}>{value}</div>
      <div className="text-xs text-mine-300 mt-2.5">{label}</div>
      <div className="text-[10px] text-mine-500 mt-1">{target}</div>
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
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return <div className="text-mine-400 text-xs h-32 flex items-center justify-center">{emptyLabel}</div>;
  }
  return (
    <div className="h-32 flex items-center gap-2">
      <div className="w-24 h-24 shrink-0">
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

function ReviewRow({ label, onApprove, onReject }: { label: React.ReactNode; onApprove: (note: string) => void; onReject: (note: string) => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  return (
    <div className="border border-mine-800 rounded-md p-3 space-y-2">
      {label}
      <div className="flex gap-2 items-center">
        <input
          className="flex-1 bg-mine-800 border border-mine-700 rounded-md px-2 py-1 text-xs"
          placeholder={t("common.reviewNotePlaceholder") ?? ""}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => onApprove(note)}>{t("common.approve")}</button>
        <button className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => onReject(note)}>{t("common.reject")}</button>
      </div>
    </div>
  );
}

export default function CooDashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [trends, setTrends] = useState<ReportTrends | null>(null);
  const [opsTab, setOpsTab] = useState<OpsTab>("production");

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
          <h2 className="text-sm font-semibold mb-3">{t("executive.openAlertsBySeverity")}</h2>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-[10px] font-semibold text-mine-300 uppercase mb-1.5">{t("executive.pendingAlerts")}</h3>
            <div className="space-y-1.5">
              {pendingReviews.alerts.length === 0 && <div className="text-mine-400 text-xs">{t("executive.noPendingAlerts")}</div>}
              {pendingReviews.alerts.map((alert: Alert) => (
                <ReviewRow
                  key={alert.id}
                  label={
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={alert.severity} />
                        <span className="text-[10px] text-mine-400">{new Date(alert.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-xs">{alert.message}</div>
                      <div className="text-[10px] text-mine-400">
                        {alert.site?.name}
                        {alert.zone?.name ? ` · ${alert.zone.name}` : ""}
                      </div>
                    </div>
                  }
                  onApprove={(note) => reviewAlert(alert.id, "APPROVED", note)}
                  onReject={(note) => reviewAlert(alert.id, "REJECTED", note)}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-semibold text-mine-300 uppercase mb-1.5">{t("executive.pendingIncidents")}</h3>
            <div className="space-y-1.5">
              {pendingReviews.incidents.length === 0 && <div className="text-mine-400 text-xs">{t("executive.noPendingIncidents")}</div>}
              {pendingReviews.incidents.map((incident: Incident) => (
                <ReviewRow
                  key={incident.id}
                  label={
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={incident.severity} />
                        <span className="text-[10px] text-mine-400">{new Date(incident.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-xs font-medium">{incident.title}</div>
                      <div className="text-[10px] text-mine-400">
                        {incident.site?.name}
                        {incident.zone?.name ? ` · ${incident.zone.name}` : ""}
                      </div>
                    </div>
                  }
                  onApprove={(note) => reviewIncident(incident.id, "APPROVED", note)}
                  onReject={(note) => reviewIncident(incident.id, "REJECTED", note)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
