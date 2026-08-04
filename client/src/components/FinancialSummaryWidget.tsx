import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../api/client";
import { ProductionFinancialSummary } from "../api/types";
import { cardClass } from "./ui";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 9, fill: "#52525b" };
const MINERAL_COLORS = ["#c48a1f", "#8a9ab5", "#16a34a", "#e13b2e", "#5b7092", "#d9a441", "#3f5a7d", "#7a8a5a"];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${cardClass} px-3 py-2.5`}>
      <div className="text-[10px] text-mine-300 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}

export default function FinancialSummaryWidget() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<ProductionFinancialSummary | null>(null);

  useEffect(() => {
    api
      .get<ProductionFinancialSummary>("/production/financial-summary", { params: { months: 6 } })
      .then((res) => setSummary(res.data));
  }, []);

  if (!summary) return null;

  const money = (n: number) => `ZAR ${Math.round(n).toLocaleString()}`;

  return (
    <div className={`${cardClass} p-3`}>
      <h2 className="text-xs font-semibold mb-2">{t("dashboard.financialPerformance")}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <StatCard label={t("production.totalEarnings")} value={money(summary.totals.totalEarnings)} />
        <StatCard label={t("production.totalExpenses")} value={money(summary.totals.totalExpenses)} />
        <StatCard label={t("production.netMargin")} value={money(summary.totals.netMargin)} />
        <StatCard label={t("production.totalTonnes")} value={summary.totals.totalTonnes.toLocaleString()} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-mine-400 mb-1 uppercase tracking-wide">{t("production.earningsVsExpenses")}</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.months}>
                <XAxis dataKey="month" tick={CHART_TICK_STYLE} tickFormatter={(m: string) => m.slice(2)} />
                <YAxis tick={CHART_TICK_STYLE} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="earnings" name={t("production.earnings")} fill="#16a34a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" name={t("production.expenses")} fill="#e13b2e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-mine-400 mb-1 uppercase tracking-wide">{t("production.tonnesByMineral")}</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.months.map((m) => ({ month: m.month, ...m.tonnesByMineral }))}>
                <XAxis dataKey="month" tick={CHART_TICK_STYLE} tickFormatter={(m: string) => m.slice(2)} />
                <YAxis tick={CHART_TICK_STYLE} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {summary.minerals.map((mineral, i) => (
                  <Bar key={mineral} dataKey={mineral} name={mineral} stackId="tonnes" fill={MINERAL_COLORS[i % MINERAL_COLORS.length]} radius={i === summary.minerals.length - 1 ? [3, 3, 0, 0] : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
