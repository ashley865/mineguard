import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../api/client";
import { BudgetSummary } from "../api/types";
import { cardClass } from "./ui";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 9, fill: "#52525b" };

function StatMini({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" | "caution" }) {
  const toneClass = tone === "negative" ? "text-danger-500" : tone === "caution" ? "text-hazard-500" : tone === "positive" ? "text-success-500" : "";
  return (
    <div className={`${cardClass} px-3 py-2.5`}>
      <div className="text-[10px] text-mine-300 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${toneClass}`}>{value}</div>
    </div>
  );
}

// Reuses the same /budget-plans/summary endpoint the Budget Planning page's own KPI
// cards and charts are built on (see BudgetPlanning.tsx) — a compact read of the same
// data for anyone with budget oversight but who doesn't need the full page.
export default function BudgetSummaryWidget() {
  const { t } = useTranslation();
  const [data, setData] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<BudgetSummary>("/budget-plans/summary")
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data || data.planCount === 0) return null;

  const money = (n: number) => `R ${Math.round(n).toLocaleString()}`;
  const chartData = data.byCategory.slice(0, 6).map((c) => ({ ...c, label: t(`expenses.categories.${c.category}`) }));

  return (
    <div className={`${cardClass} p-3 space-y-3`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold">{t("executive.budgetHealth.title")}</h2>
        <Link to="/budget-planning" className="text-[10px] text-hazard-600 hover:text-hazard-500 font-semibold">
          {t("executive.budgetHealth.viewAll")}
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatMini label={t("budgetPlanning.totalBudgeted")} value={money(data.totalBudgeted)} />
        <StatMini label={t("budgetPlanning.totalActual")} value={money(data.totalActual)} />
        <StatMini
          label={t("budgetPlanning.utilization")}
          value={`${data.utilizationPct}%`}
          tone={data.utilizationPct > 100 ? "negative" : data.utilizationPct > 85 ? "caution" : "positive"}
        />
        <StatMini
          label={t("budgetPlanning.overBudgetCount")}
          value={String(data.overBudgetCount)}
          tone={data.overBudgetCount > 0 ? "negative" : "positive"}
        />
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="label" tick={CHART_TICK_STYLE} interval={0} angle={-20} textAnchor="end" height={45} />
            <YAxis tick={CHART_TICK_STYLE} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => money(v)} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="budgeted" name={t("budgetPlanning.budgetedAmount")} fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="actual" name={t("budgetPlanning.actualAmount")} fill="#c48a1f" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
