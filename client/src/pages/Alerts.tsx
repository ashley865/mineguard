import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { Alert, AlertStatus } from "../api/types";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { buttonPrimary, buttonSecondary, cardClass } from "../components/ui";

const statusFilters: { label: string; value: AlertStatus | "ALL" }[] = [
  { label: "Open", value: "OPEN" },
  { label: "Acknowledged", value: "ACKNOWLEDGED" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "All", value: "ALL" },
];

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<AlertStatus | "ALL">("OPEN");
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Alerts</h1>
        <p className="text-mine-300 text-sm">Threshold breaches raised automatically from sensor readings</p>
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
        {loading && <div className="text-mine-300">Loading alerts…</div>}
        {!loading && alerts.length === 0 && (
          <div className={`${cardClass} p-6 text-center text-mine-400`}>No alerts in this view.</div>
        )}
        {alerts.map((alert) => (
          <div key={alert.id} className={`${cardClass} p-4 flex items-start justify-between gap-4`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <SeverityBadge severity={alert.severity} />
                <StatusBadge status={alert.status} />
                <span className="text-xs text-mine-400">{new Date(alert.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-sm">{alert.message}</div>
              <div className="text-xs text-mine-400 mt-1">
                {alert.site?.name}
                {alert.zone?.name ? ` · ${alert.zone.name}` : ""}
                {alert.sensor?.name ? ` · ${alert.sensor.name}` : ""}
              </div>
              {alert.acknowledgedBy && (
                <div className="text-xs text-mine-500 mt-1">Acknowledged by {alert.acknowledgedBy.name}</div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {alert.status === "OPEN" && (
                <button className={buttonSecondary} onClick={() => acknowledge(alert.id)}>Acknowledge</button>
              )}
              {alert.status !== "RESOLVED" && (
                <button className={buttonPrimary} onClick={() => resolve(alert.id)}>Resolve</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
