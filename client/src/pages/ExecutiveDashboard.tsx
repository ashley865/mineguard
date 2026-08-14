import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Alert, ExecutiveSummary, Incident, ReportTrends } from "../api/types";
import { SeverityBadge } from "../components/Badges";
import { buttonPrimary, buttonSecondary, cardClass } from "../components/ui";
import FinancialSummaryWidget from "../components/FinancialSummaryWidget";
import HrWorkforceWidget from "../components/HrWorkforceWidget";
import SecurityVisitorHistoryWidget from "../components/SecurityVisitorHistoryWidget";
import ProductionAnalyticsWidget from "../components/ProductionAnalyticsWidget";
import InventoryProcurementWidget from "../components/InventoryProcurementWidget";
import MaintenanceDowntimeWidget from "../components/MaintenanceDowntimeWidget";
import AiAssistantWidget from "../components/AiAssistantWidget";

type Tone = "positive" | "negative" | "caution";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 9, fill: "#52525b" };

function toneText(tone?: Tone) {
  return tone === "positive" ? "text-success-500" : tone === "negative" ? "text-danger-500" : tone === "caution" ? "text-hazard-500" : "text-mine-50";
}

function OpsCard({ label, value, to, tone }: { label: string; value: number; to: string; tone?: Tone }) {
  return (
    <Link to={to} className={`${cardClass} px-3 py-2.5 block hover:border-hazard-500 transition-colors`}>
      <div className="text-[10px] text-mine-300 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${toneText(tone)}`}>{value}</div>
    </Link>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: Tone }) {
  return (
    <div className={`${cardClass} px-3 py-2.5`}>
      <div className="text-[10px] text-mine-300 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${toneText(tone)}`}>{value}</div>
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
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
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
            <span className="font-semibold text-mine-50">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  onApprove,
  onReject,
}: {
  label: React.ReactNode;
  onApprove: (note: string) => void;
  onReject: (note: string) => void;
}) {
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
        <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => onApprove(note)}>
          {t("common.approve")}
        </button>
        <button className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => onReject(note)}>
          {t("common.reject")}
        </button>
      </div>
    </div>
  );
}

export default function ExecutiveDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canSeeFinancials = user?.title === "CFO" || user?.title === "GENERAL_MANAGER";
  const canSeeHrWorkforce = user?.title === "HR_MANAGER";
  const canSeeVisitorHistory = user?.title === "SECURITY_MANAGER";
  const canSeeProductionAnalytics = user?.title === "OPERATIONS_MANAGER";
  const canSeeAiAssistant =
    user?.title === "GENERAL_MANAGER" ||
    user?.title === "HR_MANAGER" ||
    user?.title === "CFO" ||
    user?.title === "COMPLIANCE_OFFICER" ||
    user?.title === "OPERATIONS_MANAGER" ||
    user?.title === "COO";
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold">{t("executive.title")}</h1>
          <p className="text-mine-300 text-xs">{t("executive.subtitle")}</p>
        </div>
        <div className={`${cardClass} px-3 py-2 text-right`}>
          <div className="text-[10px] text-mine-300 uppercase tracking-wide">{t("executive.complianceScore")}</div>
          <div className={`text-xl font-bold ${scoreTone}`}>{complianceScore}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label={t("executive.operational")} value={siteStatus.OPERATIONAL} tone="positive" />
        <StatCard label={t("executive.restricted")} value={siteStatus.RESTRICTED} tone={siteStatus.RESTRICTED > 0 ? "caution" : undefined} />
        <StatCard label={t("executive.shutDown")} value={siteStatus.SHUT_DOWN} tone={siteStatus.SHUT_DOWN > 0 ? "negative" : undefined} />
        <StatCard label={t("executive.equipmentUptime")} value={`${equipment.uptimePct}%`} tone={equipment.uptimePct >= 80 ? "positive" : equipment.uptimePct >= 50 ? "caution" : "negative"} />
      </div>

      {executiveOps.hasSiteAccess ? (
        <>
          <div className={`${cardClass} p-3 flex items-center justify-between flex-wrap gap-3`}>
            <div>
              <h2 className="text-xs font-semibold">{t("executive.peopleOnSite")}</h2>
              <p className="text-[10px] text-mine-400 mt-0.5">
                {t("executive.peopleOnSiteBreakdown", {
                  visitors: executiveOps.peopleOnSite.visitors,
                  staff: executiveOps.peopleOnSite.staff,
                  drivers: executiveOps.peopleOnSite.truckDrivers,
                })}
              </p>
            </div>
            <div className="text-2xl font-bold text-mine-50">{executiveOps.peopleOnSite.total}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
        <div className={`${cardClass} p-3 text-xs text-mine-300`}>{t("executive.noSiteAccess")}</div>
      )}

      {trends && (
        <div className={`${cardClass} p-3`}>
          <h2 className="text-xs font-semibold mb-2">{t("executive.complianceBreakdown")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1.5">
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

      {canSeeAiAssistant && <AiAssistantWidget showReportGenerator={user?.title === "GENERAL_MANAGER"} />}
      {canSeeFinancials && <FinancialSummaryWidget />}
      {canSeeHrWorkforce && <HrWorkforceWidget />}
      {canSeeVisitorHistory && <SecurityVisitorHistoryWidget />}
      {canSeeProductionAnalytics && <ProductionAnalyticsWidget />}
      {canSeeProductionAnalytics && <InventoryProcurementWidget />}
      {canSeeProductionAnalytics && <MaintenanceDowntimeWidget />}

      <div className={`${cardClass} p-3`}>
        <h2 className="text-xs font-semibold mb-2">{t("executive.suggestionsTitle")}</h2>
        <ul className="space-y-1.5">
          {suggestions.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-mine-200">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${suggestionDot[s.tone]}`} />
              {s.text}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className={`${cardClass} p-3`}>
          <h2 className="text-xs font-semibold mb-2">{t("executive.openAlertsBySeverity")}</h2>
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

        <div className={`${cardClass} p-3`}>
          <h2 className="text-xs font-semibold mb-2">{t("executive.incidentOverview")}</h2>
          <MiniPie
            emptyLabel={t("executive.noPendingIncidents")}
            data={[
              { name: t("executive.open"), value: incidents.open, color: "#e13b2e" },
              { name: t("executive.investigating"), value: incidents.investigating, color: "#c48a1f" },
              { name: t("executive.resolved"), value: incidents.resolved, color: "#16a34a" },
            ]}
          />
        </div>

        <div className={`${cardClass} p-3`}>
          <h2 className="text-xs font-semibold mb-2">{t("executive.workforce")}</h2>
          <div className="space-y-1.5 text-xs">
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

      <div className={`${cardClass} p-3`}>
        <h2 className="text-xs font-semibold mb-2">{t("executive.incidentTrend")}</h2>
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

      <div className={`${cardClass} p-3`}>
        <h2 className="text-xs font-semibold mb-2">{t("executive.pendingReviews")}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-[10px] font-semibold text-mine-300 uppercase mb-1.5">{t("executive.pendingAlerts")}</h3>
            <div className="space-y-1.5">
              {pendingReviews.alerts.length === 0 && (
                <div className="text-mine-400 text-xs">{t("executive.noPendingAlerts")}</div>
              )}
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
              {pendingReviews.incidents.length === 0 && (
                <div className="text-mine-400 text-xs">{t("executive.noPendingIncidents")}</div>
              )}
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
