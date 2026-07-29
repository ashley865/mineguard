import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Alert, AlertStatus } from "../api/types";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { buttonPrimary, buttonSecondary, cardClass } from "../components/ui";

export default function Alerts() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isExecutive = user?.role === "EXECUTIVE";
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<AlertStatus | "ALL">("OPEN");
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const socket = useSocket();

  const statusFilters: { label: string; value: AlertStatus | "ALL" }[] = [
    { label: t("alerts.filterOpen"), value: "OPEN" },
    { label: t("alerts.filterAcknowledged"), value: "ACKNOWLEDGED" },
    { label: t("alerts.filterResolved"), value: "RESOLVED" },
    { label: t("alerts.filterAll"), value: "ALL" },
  ];

  async function load(status: AlertStatus | "ALL") {
    setLoading(true);
    const res = await api.get<Alert[]>("/alerts", { params: status === "ALL" ? {} : { status } });
    setAlerts(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load(filter);
    socket.on("alert:new", refresh);
    socket.on("alert:updated", refresh);
    return () => {
      socket.off("alert:new", refresh);
      socket.off("alert:updated", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, filter]);

  async function acknowledge(id: string) {
    await api.post(`/alerts/${id}/acknowledge`);
    await load(filter);
  }

  async function resolve(id: string) {
    await api.post(`/alerts/${id}/resolve`);
    await load(filter);
  }

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    await api.post(`/alerts/${id}/review`, { decision, note: reviewNotes[id] || undefined });
    await load(filter);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("alerts.title")}</h1>
        <p className="text-mine-300 text-sm">{t("alerts.subtitle")}</p>
      </div>

      <div className="flex gap-2">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            className={filter === f.value ? buttonPrimary : buttonSecondary}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading && <div className="text-mine-300">{t("alerts.loading")}</div>}
        {!loading && alerts.length === 0 && (
          <div className={`${cardClass} p-6 text-center text-mine-400`}>{t("alerts.noAlertsInView")}</div>
        )}
        {alerts.map((alert) => (
          <div key={alert.id} className={`${cardClass} p-4 flex items-start justify-between gap-4`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <SeverityBadge severity={alert.severity} />
                <StatusBadge status={alert.status} />
                {alert.reviewStatus !== "PENDING" && <StatusBadge status={alert.reviewStatus} />}
                <span className="text-xs text-mine-400">{new Date(alert.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-sm">{alert.message}</div>
              <div className="text-xs text-mine-400 mt-1">
                {alert.site?.name}
                {alert.zone?.name ? ` · ${alert.zone.name}` : ""}
                {alert.sensor?.name ? ` · ${alert.sensor.name}` : ""}
              </div>
              {alert.acknowledgedBy && (
                <div className="text-xs text-mine-500 mt-1">{t("alerts.acknowledgedBy", { name: alert.acknowledgedBy.name })}</div>
              )}
              {alert.reviewedBy && (
                <div className="text-xs text-mine-500 mt-1">{t("common.reviewedBy", { name: alert.reviewedBy.name })}</div>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0 items-end">
              <div className="flex gap-2">
                {alert.status === "OPEN" && (
                  <button className={buttonSecondary} onClick={() => acknowledge(alert.id)}>{t("alerts.acknowledge")}</button>
                )}
                {alert.status !== "RESOLVED" && (
                  <button className={buttonPrimary} onClick={() => resolve(alert.id)}>{t("alerts.resolve")}</button>
                )}
              </div>
              {isExecutive && alert.reviewStatus === "PENDING" && (
                <div className="flex gap-2 items-center">
                  <input
                    className="w-32 bg-mine-800 border border-mine-700 rounded-md px-2 py-1 text-xs"
                    placeholder={t("common.reviewNotePlaceholder") ?? ""}
                    value={reviewNotes[alert.id] ?? ""}
                    onChange={(e) => setReviewNotes((prev) => ({ ...prev, [alert.id]: e.target.value }))}
                  />
                  <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => review(alert.id, "APPROVED")}>
                    {t("common.approve")}
                  </button>
                  <button className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => review(alert.id, "REJECTED")}>
                    {t("common.reject")}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
