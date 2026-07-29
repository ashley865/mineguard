import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { Alert, DashboardSummary } from "../api/types";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { cardClass } from "../components/ui";

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "danger" | "hazard" }) {
  const toneClass =
    tone === "danger" ? "text-danger-400" : tone === "hazard" ? "text-hazard-400" : "text-mine-50";
  return (
    <div className={`${cardClass} px-5 py-4`}>
      <div className="text-xs text-mine-300 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const socket = useSocket();

  async function load() {
    const res = await api.get<DashboardSummary>("/dashboard/summary");
    setSummary(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!socket) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 500);
    };
    socket.on("alert:new", refresh);
    socket.on("alert:updated", refresh);
    socket.on("sensor:reading", refresh);
    return () => {
      if (timer) clearTimeout(timer);
      socket.off("alert:new", refresh);
      socket.off("alert:updated", refresh);
      socket.off("sensor:reading", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  if (!summary) {
    return <div className="text-mine-300">{t("dashboard.loading")}</div>;
  }

  const { counts, recentAlerts, sites } = summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("dashboard.title")}</h1>
        <p className="text-mine-300 text-sm">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label={t("dashboard.sites")} value={counts.siteCount} />
        <StatCard label={t("dashboard.sensors")} value={counts.sensorCount} />
        <StatCard label={t("dashboard.openAlerts")} value={counts.openAlerts} tone={counts.openAlerts > 0 ? "hazard" : undefined} />
        <StatCard label={t("dashboard.critical")} value={counts.criticalAlerts} tone={counts.criticalAlerts > 0 ? "danger" : undefined} />
        <StatCard label={t("dashboard.onShift")} value={counts.onShiftWorkers} />
        <StatCard label={t("dashboard.openIncidents")} value={counts.openIncidents} tone={counts.openIncidents > 0 ? "hazard" : undefined} />
        <StatCard label={t("dashboard.equipmentDown")} value={counts.equipmentDown} tone={counts.equipmentDown > 0 ? "danger" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${cardClass} lg:col-span-2 p-5`}>
          <h2 className="text-sm font-semibold mb-4">{t("dashboard.siteStatus")}</h2>
          <div className="space-y-4">
            {sites.map((site) => (
              <div key={site.id} className="border border-mine-800 rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-semibold">{site.name}</div>
                    <div className="text-xs text-mine-300">{site.location}</div>
                  </div>
                  <StatusBadge status={site.status} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {site.zones?.flatMap((zone) =>
                    (zone.sensors ?? []).map((sensor) => {
                      const latest = sensor.readings?.[0];
                      const outOfRange =
                        latest && (latest.value < sensor.minSafe || latest.value > sensor.maxSafe);
                      return (
                        <div
                          key={sensor.id}
                          className={`rounded-md px-3 py-2 text-xs border ${
                            outOfRange
                              ? "border-danger-500 bg-danger-500/10"
                              : "border-mine-700 bg-mine-800/50"
                          }`}
                        >
                          <div className="font-medium truncate">{sensor.name}</div>
                          <div className="text-mine-300">{zone.name}</div>
                          <div className={`font-bold mt-1 ${outOfRange ? "text-danger-400" : "text-mine-100"}`}>
                            {latest ? `${latest.value}${sensor.unit}` : "—"}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardClass} p-5`}>
          <h2 className="text-sm font-semibold mb-4">{t("dashboard.activeAlerts")}</h2>
          <div className="space-y-3 max-h-[560px] overflow-y-auto">
            {recentAlerts.length === 0 && (
              <div className="text-mine-400 text-sm">{t("dashboard.noOpenAlerts")}</div>
            )}
            {recentAlerts.map((alert: Alert) => (
              <div key={alert.id} className="border border-mine-800 rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <SeverityBadge severity={alert.severity} />
                  <span className="text-xs text-mine-400">
                    {new Date(alert.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm">{alert.message}</div>
                <div className="text-xs text-mine-400 mt-1">
                  {alert.site?.name}
                  {alert.zone?.name ? ` · ${alert.zone.name}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
