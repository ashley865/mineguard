import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { Alert, DashboardSummary } from "../api/types";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { cardClass } from "../components/ui";

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger" | "hazard" | "success";
}) {
  const toneClass =
    tone === "danger" ? "text-danger-500" : tone === "hazard" ? "text-hazard-500" : tone === "success" ? "text-success-500" : "text-mine-50";
  return (
    <div className={`${cardClass} px-3 py-2.5`}>
      <div className="text-[10px] text-mine-300 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${toneClass}`}>{value}</div>
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

  const { counts, workforce, equipmentSummary, complianceScore, recentAlerts, sites } = summary;
  const scoreTone =
    complianceScore >= 80 ? "text-success-500" : complianceScore >= 50 ? "text-hazard-500" : "text-danger-500";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">{t("dashboard.title")}</h1>
        <p className="text-mine-300 text-xs">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <StatCard label={t("dashboard.sites")} value={counts.siteCount} />
        <StatCard label={t("dashboard.sensors")} value={counts.sensorCount} />
        <StatCard label={t("dashboard.openAlerts")} value={counts.openAlerts} tone={counts.openAlerts > 0 ? "hazard" : "success"} />
        <StatCard label={t("dashboard.critical")} value={counts.criticalAlerts} tone={counts.criticalAlerts > 0 ? "danger" : "success"} />
        <StatCard label={t("dashboard.onShift")} value={counts.onShiftWorkers} tone="success" />
        <StatCard label={t("dashboard.openIncidents")} value={counts.openIncidents} tone={counts.openIncidents > 0 ? "hazard" : "success"} />
        <StatCard label={t("dashboard.equipmentDown")} value={counts.equipmentDown} tone={counts.equipmentDown > 0 ? "danger" : "success"} />
      </div>

      <div className={`${cardClass} p-3 flex items-center justify-between flex-wrap gap-3`}>
        <h2 className="text-xs font-semibold">{t("dashboard.complianceScore")}</h2>
        <div className={`text-xl font-bold ${scoreTone}`}>{complianceScore}%</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`${cardClass} p-3`}>
          <h2 className="text-xs font-semibold mb-2">{t("dashboard.workforceStatus")}</h2>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-mine-300">{t("workers.onShift")}</span>
              <span className="font-semibold text-success-500">{workforce.byStatus.ON_SHIFT}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-mine-300">{t("workers.offShift")}</span>
              <span className="font-semibold">{workforce.byStatus.OFF_SHIFT}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-mine-300">{t("workers.emergency")}</span>
              <span className={`font-semibold ${workforce.byStatus.EMERGENCY > 0 ? "text-danger-500" : ""}`}>{workforce.byStatus.EMERGENCY}</span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-mine-800">
              <span className="text-mine-300">{t("workers.title")}</span>
              <span className="font-semibold">{workforce.total}</span>
            </div>
          </div>
        </div>

        <div className={`${cardClass} p-3`}>
          <h2 className="text-xs font-semibold mb-2">{t("dashboard.equipmentStatus")}</h2>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-mine-300">{t("equipment.operational")}</span>
              <span className="font-semibold text-success-500">{equipmentSummary.byStatus.OPERATIONAL}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-mine-300">{t("equipment.maintenance")}</span>
              <span className="font-semibold text-hazard-500">{equipmentSummary.byStatus.MAINTENANCE}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-mine-300">{t("equipment.down")}</span>
              <span className={`font-semibold ${equipmentSummary.byStatus.DOWN > 0 ? "text-danger-500" : ""}`}>{equipmentSummary.byStatus.DOWN}</span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-mine-800">
              <span className="text-mine-300">{t("equipment.title")}</span>
              <span className="font-semibold">{equipmentSummary.total}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className={`${cardClass} lg:col-span-2 p-3`}>
          <h2 className="text-xs font-semibold mb-2">{t("dashboard.siteStatus")}</h2>
          <div className="space-y-2">
            {sites.map((site) => (
              <div key={site.id} className="border border-mine-800 rounded-md p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold text-sm">{site.name}</div>
                    <div className="text-[10px] text-mine-300">{site.location}</div>
                  </div>
                  <StatusBadge status={site.status} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {site.zones?.flatMap((zone) =>
                    (zone.sensors ?? []).map((sensor) => {
                      const latest = sensor.readings?.[0];
                      const outOfRange =
                        latest && (latest.value < sensor.minSafe || latest.value > sensor.maxSafe);
                      return (
                        <div
                          key={sensor.id}
                          className={`rounded-md px-2 py-1.5 text-[11px] border ${
                            outOfRange
                              ? "border-danger-500 bg-danger-500/10"
                              : "border-mine-700 bg-mine-800/50"
                          }`}
                        >
                          <div className="font-medium truncate">{sensor.name}</div>
                          <div className="text-mine-300">{zone.name}</div>
                          <div className={`font-bold mt-0.5 ${outOfRange ? "text-danger-400" : "text-mine-100"}`}>
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

        <div className={`${cardClass} p-3`}>
          <h2 className="text-xs font-semibold mb-2">{t("dashboard.activeAlerts")}</h2>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {recentAlerts.length === 0 && (
              <div className="text-mine-400 text-xs">{t("dashboard.noOpenAlerts")}</div>
            )}
            {recentAlerts.map((alert: Alert) => (
              <div key={alert.id} className="border border-mine-800 rounded-md p-2">
                <div className="flex items-center justify-between mb-1">
                  <SeverityBadge severity={alert.severity} />
                  <span className="text-[10px] text-mine-400">
                    {new Date(alert.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-xs">{alert.message}</div>
                <div className="text-[10px] text-mine-400 mt-0.5">
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
