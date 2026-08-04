import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../api/client";
import { ProductionFinancialSummary } from "../api/types";
import { cardClass } from "./ui";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 9, fill: "#52525b" };

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
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={summary.months}>
            <XAxis dataKey="month" tick={CHART_TICK_STYLE} tickFormatter={(m: string) => m.slice(2)} />
            <YAxis yAxisId="money" tick={CHART_TICK_STYLE} />
            <YAxis yAxisId="tonnes" orientation="right" tick={CHART_TICK_STYLE} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar yAxisId="money" dataKey="earnings" name={t("production.earnings")} fill="#16a34a" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="money" dataKey="expenses" name={t("production.expenses")} fill="#e13b2e" radius={[3, 3, 0, 0]} />
            <Line yAxisId="tonnes" type="monotone" dataKey="tonnesMined" name={t("production.tonnesMined")} stroke="#c48a1f" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
