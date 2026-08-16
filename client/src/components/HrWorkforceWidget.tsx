import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../api/client";
import { HrWorkforceSnapshot } from "../api/types";
import { SeverityBadge } from "./Badges";
import { cardClass } from "./ui";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 9, fill: "#52525b" };

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "positive" | "negative" | "caution" }) {
  const toneClass = tone === "positive" ? "text-success-500" : tone === "negative" ? "text-danger-500" : tone === "caution" ? "text-hazard-500" : "text-mine-50";
  return (
    <div className={`${cardClass} px-3 py-2.5`}>
      <div className="text-[10px] text-mine-300 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${toneClass}`}>{value}</div>
    </div>
  );
}

function barColor(pct: number) {
  if (pct >= 80) return "#16a34a";
  if (pct >= 50) return "#c48a1f";
  return "#e13b2e";
}

export default function HrWorkforceWidget() {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<HrWorkforceSnapshot | null>(null);

  useEffect(() => {
    api.get<HrWorkforceSnapshot>("/executive/hr-workforce").then((res) => setSnapshot(res.data)).catch(() => {});
  }, []);

  if (!snapshot) return null;

  const newHires = snapshot.newHires ?? [];
  const workerWarnings = snapshot.workerWarnings ?? [];

  const chartData = (snapshot.byCategory ?? []).map((c) => ({
    category: t(`workers.categories.${c.category}`),
    onShiftPct: c.onShiftPct,
    total: c.total,
    onShift: c.onShift,
  }));

  return (
    <>
    <div className={`${cardClass} p-3`}>
      <h2 className="text-xs font-semibold mb-2">{t("executive.hrWorkforceTitle")}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <StatCard label={t("executive.onShiftNow")} value={`${snapshot.onShiftPct}%`} tone={snapshot.onShiftPct >= 60 ? "positive" : "caution"} />
        <StatCard label={t("executive.totalWorkers")} value={snapshot.totalWorkers} />
        <StatCard label={t("executive.spotsToFillToday")} value={snapshot.onLeaveToday} tone={snapshot.onLeaveToday > 0 ? "caution" : "positive"} />
        <StatCard label={t("executive.pendingLeaveRequests")} value={snapshot.pendingLeaveRequests} tone={snapshot.pendingLeaveRequests > 0 ? "caution" : "positive"} />
      </div>
      <div className="text-[10px] text-mine-400 mb-1 uppercase tracking-wide">{t("executive.onShiftByCategory")}</div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: -10 }}>
            <XAxis dataKey="category" tick={CHART_TICK_STYLE} interval={0} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={CHART_TICK_STYLE} unit="%" domain={[0, 100]} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number, _name, item: any) => [`${value}% (${item.payload.onShift}/${item.payload.total})`, t("executive.onShiftNow")]}
            />
            <Bar dataKey="onShiftPct" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={barColor(d.onShiftPct)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* New Hires */}
    <div className={`${cardClass} p-3`}>
      <h2 className="text-xs font-semibold mb-2">{t("executive.newHiresTitle")}</h2>
      {newHires.length === 0 ? (
        <div className="text-mine-400 text-xs">{t("executive.noNewHires")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-mine-400 uppercase">
              <tr>
                <th className="text-left pr-3 py-1.5">{t("workers.colName")}</th>
                <th className="text-left pr-3 py-1.5">{t("workers.colRole")}</th>
                <th className="text-left pr-3 py-1.5">{t("workers.colSiteZone")}</th>
                <th className="text-left pr-3 py-1.5">{t("workers.manager")}</th>
                <th className="text-left py-1.5">{t("executive.hiredOn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mine-800">
              {newHires.map((h) => (
                <tr key={h.id}>
                  <td className="pr-3 py-1.5 font-medium">{h.name}</td>
                  <td className="pr-3 py-1.5 text-mine-300">{h.role}</td>
                  <td className="pr-3 py-1.5 text-mine-300">{h.site?.name ?? "—"}</td>
                  <td className="pr-3 py-1.5 text-mine-300">{h.manager?.name ?? t("workers.noManager")}</td>
                  <td className="py-1.5 text-mine-400">{new Date(h.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* Worker Warnings */}
    <div className={`${cardClass} p-3`}>
      <h2 className="text-xs font-semibold mb-2">{t("executive.workerWarningsTitle")}</h2>
      {workerWarnings.length === 0 ? (
        <div className="text-mine-400 text-xs">{t("executive.noWorkerWarnings")}</div>
      ) : (
        <div className="space-y-1.5">
          {workerWarnings.map((w) => (
            <div key={w.id} className="border border-mine-800 rounded-lg p-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <SeverityBadge severity={w.severity} />
                  <span className="text-xs font-semibold truncate">{w.workerName}</span>
                </div>
                <div className="text-xs text-mine-400 truncate">{w.message}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {w.phone && (
                  <a href={`tel:${w.phone}`} className="px-2.5 py-1 rounded-lg text-xs font-medium text-hazard-400 hover:bg-mine-800 transition-colors">
                    {t("executive.contactWorker")}
                  </a>
                )}
                <Link to="/workers" className="px-2.5 py-1 rounded-lg text-xs font-medium text-mine-300 hover:text-mine-50 hover:bg-mine-800 transition-colors">
                  {t("workers.viewProfile")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </>
  );
}
