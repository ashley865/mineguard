import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Alert, DashboardSummary, OwnerAttentionSummary } from "../api/types";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { cardClass } from "../components/ui";
import FinancialSummaryWidget from "../components/FinancialSummaryWidget";
import AiAssistantWidget from "../components/AiAssistantWidget";
import LiveDataWidget from "../components/LiveDataWidget";
import IndustryNewsWidget from "../components/IndustryNewsWidget";
import CyberSecurityWidget from "../components/CyberSecurityWidget";

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
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

function SectionHeader({ label }: { label: string }) {
  return <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-mine-400 pt-1">{label}</h2>;
}

function QuickActionLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className={`${cardClass} px-3 py-2 text-xs font-semibold text-mine-100 hover:border-mine-600 hover:text-hazard-400 transition-colors whitespace-nowrap`}
    >
      {label}
    </Link>
  );
}

function AttentionCard({ label, value, to }: { label: string; value: number | string; to: string }) {
  const urgent = typeof value === "number" && value > 0;
  return (
    <Link
      to={to}
      className={`${cardClass} px-3 py-2.5 block hover:border-mine-600 transition-colors ${urgent ? "border-hazard-500/50" : ""}`}
    >
      <div className="text-[10px] text-mine-300 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${urgent ? "text-hazard-500" : "text-mine-50"}`}>{value}</div>
    </Link>
  );
}

function OwnerAttentionPanel() {
  const { t } = useTranslation();
  const [data, setData] = useState<OwnerAttentionSummary | null>(null);

  useEffect(() => {
    api
      .get<OwnerAttentionSummary>("/owner-attention")
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  const money = (n: number) => `ZAR ${Math.round(n).toLocaleString()}`;
  const totalUrgent =
    data.pendingExpenses.count +
    data.pendingPurchaseOrders.count +
    data.pendingExecutiveRequests.count +
    data.criticalItIncidents.count +
    data.pendingExecutiveInvites.count +
    data.pendingPermitsToWork.count +
    data.pendingItAccessRequests.count +
    data.pendingLeaveRequests.count;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <SectionHeader label={t("dashboard.needsAttention")} />
        {totalUrgent > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-hazard-500 text-white">{totalUrgent}</span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <AttentionCard label={t("dashboard.pendingExpenses")} value={data.pendingExpenses.count} to="/expenses" />
        <AttentionCard label={t("dashboard.pendingOrders")} value={data.pendingPurchaseOrders.count} to="/procurement" />
        <AttentionCard label={t("dashboard.pendingRequests")} value={data.pendingExecutiveRequests.count} to="/executive-requests" />
        <AttentionCard label={t("dashboard.criticalItIncidents")} value={data.criticalItIncidents.count} to="/it-operations" />
        <AttentionCard label={t("dashboard.pendingInvites")} value={data.pendingExecutiveInvites.count} to="/settings" />
        <AttentionCard label={t("dashboard.pendingPermits")} value={data.pendingPermitsToWork.count} to="/permits-to-work" />
        <AttentionCard label={t("dashboard.pendingItAccess")} value={data.pendingItAccessRequests.count} to="/it-operations" />
        <AttentionCard label={t("dashboard.pendingLeave")} value={data.pendingLeaveRequests.count} to="/payroll" />
      </div>
      {(data.pendingExpenses.count > 0 || data.pendingPurchaseOrders.count > 0) && (
        <p className="text-[10px] text-mine-400 mt-1.5">
          {t("dashboard.pendingFinanceTotal", {
            amount: money(data.pendingExpenses.total + data.pendingPurchaseOrders.total),
          })}
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
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

  const { counts, workforce, equipmentSummary, complianceScore, recentAlerts, sites, marketplace } = summary;
  const scoreTone =
    complianceScore >= 80 ? "text-success-500" : complianceScore >= 50 ? "text-hazard-500" : "text-danger-500";

  const isOwner = user?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">{t("dashboard.title")}</h1>
        <p className="text-mine-300 text-xs">{t("dashboard.subtitle")}</p>
      </div>

      {isOwner && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <QuickActionLink to="/approvals-inbox" label={t("dashboard.quickApprovalsInbox")} />
          <QuickActionLink to="/executive-requests" label={t("dashboard.quickExecutiveRequests")} />
          <QuickActionLink to="/reporting" label={t("dashboard.quickReporting")} />
          <QuickActionLink to="/settings" label={t("dashboard.quickMineSettings")} />
        </div>
      )}

      {isOwner && <OwnerAttentionPanel />}

      <div className="space-y-3">
        <SectionHeader label={t("dashboard.sectionOverview")} />
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

        <div className="grid grid-cols-2 gap-2">
          <StatCard label={t("dashboard.tonnesSold")} value={(marketplace?.totalTonnesSold ?? 0).toLocaleString()} />
          <StatCard
            label={t("dashboard.biggestBuyer")}
            value={marketplace?.biggestBuyer ? `${marketplace.biggestBuyer.name} (${marketplace.biggestBuyer.quantity.toLocaleString()}t)` : "—"}
          />
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader label={t("dashboard.sectionInsights")} />
        {isOwner && <AiAssistantWidget showReportGenerator />}
        {isOwner && <CyberSecurityWidget />}
        <LiveDataWidget showMineralPrices={isOwner} />
        <IndustryNewsWidget />
        {isOwner && <FinancialSummaryWidget />}
      </div>

      <div className="space-y-3">
        <SectionHeader label={t("dashboard.sectionOperations")} />
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
    </div>
  );
}
