import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api } from "../api/client";
import { MaintenanceSummary } from "../api/types";
import { ListIcon, ClockIcon, RefreshIcon, AlertTriangleIcon } from "./icons/DashboardIcons";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 9, fill: "#52525b" };
const TYPE_COLORS: Record<string, string> = {
  PLANNED: "#8a9ab5",
  PREVENTIVE: "#16a34a",
  CORRECTIVE: "#d9a441",
  EMERGENCY: "#e13b2e",
  INSPECTION: "#3f5a7d",
};
const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "#8a9ab5",
  IN_PROGRESS: "#d9a441",
  COMPLETED: "#16a34a",
  OVERDUE: "#e13b2e",
  CANCELLED: "#6b6b6b",
};
const cardOuter = "bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6";
const TONE_CLASS: Record<"danger" | "caution" | "neutral", string> = {
  danger: "bg-danger-500/10 text-danger-500",
  caution: "bg-hazard-500/10 text-hazard-500",
  neutral: "bg-mine-400/10 text-mine-400",
};

function IconStatCard({ icon, label, value, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; tone?: "danger" | "caution" | "neutral" }) {
  return (
    <div className={`${cardOuter} p-[22px]`}>
      <div className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center mb-3.5 ${TONE_CLASS[tone]}`}>{icon}</div>
      <div className="text-lg font-bold leading-none truncate">{value}</div>
      <div className="text-xs text-mine-400 mt-2">{label}</div>
    </div>
  );
}

export default function MaintenanceDowntimeWidget() {
  const { t } = useTranslation();
  const [data, setData] = useState<MaintenanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<MaintenanceSummary>("/maintenance/summary", { params: { days: 180 } })
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={cardOuter}>
        <div className="text-mine-300 text-xs">{t("common.loading")}</div>
      </div>
    );
  }
  if (!data) return null;

  const typeChartData = data.byType
    .filter((d) => d.count > 0)
    .map((d) => ({ type: t(`maintenance.types.${d.type}`), key: d.type, count: d.count }));
  const statusChartData = data.byStatus.filter((d) => d.count > 0).map((d) => ({ status: d.status, count: d.count }));

  return (
    <div className={`${cardOuter} space-y-6`}>
      <h2 className="text-sm font-semibold">{t("maintenance.downtimeOverviewTitle")}</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <IconStatCard icon={<ListIcon />} label={t("maintenance.backlog")} value={data.backlog.toString()} tone={data.backlog > 0 ? "caution" : "neutral"} />
        <IconStatCard
          icon={<ClockIcon />}
          label={t("maintenance.totalDowntime")}
          value={t("maintenance.hoursValue", { count: Math.round((data.totalDowntimeMinutes / 60) * 10) / 10 })}
          tone={data.totalDowntimeMinutes > 0 ? "caution" : "neutral"}
        />
        <IconStatCard icon={<RefreshIcon />} label={t("maintenance.mtbf")} value={data.mtbfDays != null ? t("maintenance.daysValue", { count: data.mtbfDays }) : "—"} />
        <IconStatCard icon={<AlertTriangleIcon />} label={t("maintenance.failureCount")} value={data.failureCount.toString()} tone={data.failureCount > 0 ? "caution" : "neutral"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardOuter}>
          <h3 className="text-sm font-semibold mb-4">{t("maintenance.byType")}</h3>
          {typeChartData.length === 0 ? (
            <div className="text-mine-400 text-xs h-48 flex items-center justify-center">{t("maintenance.noneYet")}</div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeChartData}>
                  <XAxis dataKey="type" tick={CHART_TICK_STYLE} interval={0} angle={-20} textAnchor="end" height={45} />
                  <YAxis tick={CHART_TICK_STYLE} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="count" name={t("maintenance.workOrders")} radius={[3, 3, 0, 0]}>
                    {typeChartData.map((d) => (
                      <Cell key={d.key} fill={TYPE_COLORS[d.key]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className={cardOuter}>
          <h3 className="text-sm font-semibold mb-4">{t("maintenance.byStatus")}</h3>
          {statusChartData.length === 0 ? (
            <div className="text-mine-400 text-xs h-48 flex items-center justify-center">{t("maintenance.noneYet")}</div>
          ) : (
            <div className="h-48 flex items-center gap-3">
              <div className="w-32 h-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusChartData} dataKey="count" nameKey="status" innerRadius={28} outerRadius={55} paddingAngle={2}>
                      {statusChartData.map((d) => (
                        <Cell key={d.status} fill={STATUS_COLORS[d.status]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 text-xs flex-1 min-w-0">
                {statusChartData.map((d) => (
                  <div key={d.status} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-mine-300 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[d.status] }} />
                      {t(`badges.status.${d.status}`)}
                    </span>
                    <span className="font-semibold text-mine-50">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardOuter}>
          <h3 className="text-sm font-semibold mb-4">{t("maintenance.byTechnician")}</h3>
          {data.byTechnician.length === 0 ? (
            <div className="text-mine-400 text-xs h-32 flex items-center justify-center">{t("maintenance.noneYet")}</div>
          ) : (
            <div className="space-y-1.5 text-xs max-h-40 overflow-y-auto">
              {data.byTechnician.map((tech) => (
                <div key={tech.name} className="flex items-center justify-between border-b border-mine-800 pb-1.5">
                  <span className="text-mine-300 truncate">{tech.name}</span>
                  <span>
                    <span className="text-hazard-500 font-semibold">{tech.open}</span>
                    <span className="text-mine-500"> {t("maintenance.open")} · </span>
                    <span className="text-success-500 font-semibold">{tech.completed}</span>
                    <span className="text-mine-500"> {t("maintenance.completed")}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={cardOuter}>
          <h3 className="text-sm font-semibold mb-4">{t("maintenance.topPartsUsed")}</h3>
          {data.topPartsUsed.length === 0 ? (
            <div className="text-mine-400 text-xs h-32 flex items-center justify-center">{t("maintenance.noneYet")}</div>
          ) : (
            <div className="space-y-1.5 text-xs max-h-40 overflow-y-auto">
              {data.topPartsUsed.map((p) => (
                <div key={p.name} className="flex items-center justify-between border-b border-mine-800 pb-1.5">
                  <span className="text-mine-300 truncate">{p.name}</span>
                  <span className="font-semibold text-mine-50">{p.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={cardOuter}>
        <h3 className="text-sm font-semibold mb-4">{t("maintenance.recentDowntimeEvents")}</h3>
        {data.recentDowntimeEvents.length === 0 ? (
          <div className="text-mine-400 text-xs h-16 flex items-center justify-center">{t("maintenance.noDowntimeEvents")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-mine-400 uppercase">
                <tr>
                  <th className="text-left pr-3 py-1.5">{t("nav.equipment")}</th>
                  <th className="text-left pr-3 py-1.5">{t("maintenance.type")}</th>
                  <th className="text-left pr-3 py-1.5">{t("maintenance.downtimeReason")}</th>
                  <th className="text-right pr-3 py-1.5">{t("maintenance.downtimeMinutes")}</th>
                  <th className="text-right py-1.5">{t("common.date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mine-800">
                {data.recentDowntimeEvents.map((ev, i) => (
                  <tr key={i}>
                    <td className="pr-3 py-1.5 font-medium">{ev.equipment}</td>
                    <td className="pr-3 py-1.5 text-mine-300">{t(`maintenance.types.${ev.type}`)}</td>
                    <td className="pr-3 py-1.5 text-mine-300">{ev.reason ?? "—"}</td>
                    <td className="text-right pr-3 py-1.5 text-danger-500 font-semibold">{ev.downtimeMinutes ?? "—"}</td>
                    <td className="text-right py-1.5 text-mine-400">{new Date(ev.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
