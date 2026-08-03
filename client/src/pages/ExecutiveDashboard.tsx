import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../api/client";
import { Alert, ExecutiveSummary, Incident, ReportTrends } from "../api/types";
import { SeverityBadge } from "../components/Badges";
import { buttonPrimary, buttonSecondary, cardClass } from "../components/ui";

type Tone = "positive" | "negative" | "caution";

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

  return (
    <div className="space-y-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className={`${cardClass} p-3`}>
          <h2 className="text-xs font-semibold mb-2">{t("executive.openAlertsBySeverity")}</h2>
          <div className="space-y-1.5">
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => (
              <div key={sev} className="flex items-center justify-between text-xs">
                <SeverityBadge severity={sev} />
                <span className="font-semibold">{alertSeverity[sev]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardClass} p-3`}>
          <h2 className="text-xs font-semibold mb-2">{t("executive.incidentOverview")}</h2>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-mine-300">{t("executive.open")}</span>
              <span className="font-semibold">{incidents.open}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-mine-300">{t("executive.investigating")}</span>
              <span className="font-semibold">{incidents.investigating}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-mine-300">{t("executive.resolved")}</span>
              <span className="font-semibold">{incidents.resolved}</span>
            </div>
          </div>
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
