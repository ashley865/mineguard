import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "../api/client";
import { HrWorkforceSnapshot } from "../api/types";
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
    api.get<HrWorkforceSnapshot>("/executive/hr-workforce").then((res) => setSnapshot(res.data));
  }, []);

  if (!snapshot) return null;

  const chartData = snapshot.byCategory.map((c) => ({
    category: t(`workers.categories.${c.category}`),
    onShiftPct: c.onShiftPct,
    total: c.total,
    onShift: c.onShift,
  }));

  return (
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
  );
}
