import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../api/client";
import { Alert, ExecutiveSummary, Incident } from "../api/types";
import { SeverityBadge } from "../components/Badges";
import { buttonPrimary, buttonSecondary, cardClass } from "../components/ui";

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "danger" | "hazard" }) {
  const toneClass =
    tone === "danger" ? "text-danger-400" : tone === "hazard" ? "text-hazard-400" : "text-mine-50";
  return (
    <div className={`${cardClass} px-5 py-4`}>
      <div className="text-xs text-mine-300 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</div>
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

  async function load() {
    const res = await api.get<ExecutiveSummary>("/executive/summary");
    setSummary(res.data);
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
  const scoreTone =
    complianceScore >= 80 ? "text-emerald-500" : complianceScore >= 50 ? "text-hazard-500" : "text-danger-500";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">{t("executive.title")}</h1>
          <p className="text-mine-300 text-sm">{t("executive.subtitle")}</p>
        </div>
        <div className={`${cardClass} px-5 py-3 text-right`}>
          <div className="text-xs text-mine-300 uppercase tracking-wide">{t("executive.complianceScore")}</div>
          <div className={`text-3xl font-bold ${scoreTone}`}>{complianceScore}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("executive.operational")} value={siteStatus.OPERATIONAL} />
        <StatCard label={t("executive.restricted")} value={siteStatus.RESTRICTED} tone={siteStatus.RESTRICTED > 0 ? "hazard" : undefined} />
        <StatCard label={t("executive.shutDown")} value={siteStatus.SHUT_DOWN} tone={siteStatus.SHUT_DOWN > 0 ? "danger" : undefined} />
        <StatCard label={t("executive.equipmentUptime")} value={`${equipment.uptimePct}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${cardClass} p-5`}>
          <h2 className="text-sm font-semibold mb-4">{t("executive.openAlertsBySeverity")}</h2>
          <div className="space-y-2">
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => (
              <div key={sev} className="flex items-center justify-between text-sm">
                <SeverityBadge severity={sev} />
                <span className="font-semibold">{alertSeverity[sev]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardClass} p-5`}>
          <h2 className="text-sm font-semibold mb-4">{t("executive.incidentOverview")}</h2>
          <div className="space-y-2 text-sm">
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

        <div className={`${cardClass} p-5`}>
          <h2 className="text-sm font-semibold mb-4">{t("executive.workforce")}</h2>
          <div className="space-y-2 text-sm">
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

      <div className={`${cardClass} p-5`}>
        <h2 className="text-sm font-semibold mb-4">{t("executive.incidentTrend")}</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incidentTrend}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#52525b" }}
                tickFormatter={(d: string) => d.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10, fill: "#52525b" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} />
              <Bar dataKey="count" fill="#a5811f" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`${cardClass} p-5`}>
        <h2 className="text-sm font-semibold mb-4">{t("executive.pendingReviews")}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold text-mine-300 uppercase mb-2">{t("executive.pendingAlerts")}</h3>
            <div className="space-y-2">
              {pendingReviews.alerts.length === 0 && (
                <div className="text-mine-400 text-sm">{t("executive.noPendingAlerts")}</div>
              )}
              {pendingReviews.alerts.map((alert: Alert) => (
                <ReviewRow
                  key={alert.id}
                  label={
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={alert.severity} />
                        <span className="text-xs text-mine-400">{new Date(alert.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-sm">{alert.message}</div>
                      <div className="text-xs text-mine-400">
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
            <h3 className="text-xs font-semibold text-mine-300 uppercase mb-2">{t("executive.pendingIncidents")}</h3>
            <div className="space-y-2">
              {pendingReviews.incidents.length === 0 && (
                <div className="text-mine-400 text-sm">{t("executive.noPendingIncidents")}</div>
              )}
              {pendingReviews.incidents.map((incident: Incident) => (
                <ReviewRow
                  key={incident.id}
                  label={
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={incident.severity} />
                        <span className="text-xs text-mine-400">{new Date(incident.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-sm font-medium">{incident.title}</div>
                      <div className="text-xs text-mine-400">
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
