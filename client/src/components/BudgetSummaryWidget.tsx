import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../api/client";
import { BudgetSummary } from "../api/types";
import { WalletIcon, ReceiptIcon, GaugeIcon, AlertTriangleIcon } from "./icons/DashboardIcons";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 9, fill: "#52525b" };
const cardOuter = "bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6";
const TONE_CLASS: Record<"positive" | "negative" | "caution" | "neutral", string> = {
  positive: "bg-success-500/10 text-success-500",
  negative: "bg-danger-500/10 text-danger-500",
  caution: "bg-hazard-500/10 text-hazard-500",
  neutral: "bg-mine-400/10 text-mine-400",
};

function IconStatCard({ icon, label, value, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; tone?: "positive" | "negative" | "caution" | "neutral" }) {
  return (
    <div className={`${cardOuter} p-[22px]`}>
      <div className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center mb-3.5 ${TONE_CLASS[tone]}`}>{icon}</div>
      <div className="text-lg font-bold leading-none truncate">{value}</div>
      <div className="text-xs text-mine-400 mt-2">{label}</div>
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
    <div className={cardOuter}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold">{t("executive.budgetHealth.title")}</h2>
        <Link to="/budget-planning" className="text-xs text-hazard-600 hover:text-hazard-500 font-semibold">
          {t("executive.budgetHealth.viewAll")}
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <IconStatCard icon={<WalletIcon />} label={t("budgetPlanning.totalBudgeted")} value={money(data.totalBudgeted)} />
        <IconStatCard icon={<ReceiptIcon />} label={t("budgetPlanning.totalActual")} value={money(data.totalActual)} />
        <IconStatCard
          icon={<GaugeIcon />}
          label={t("budgetPlanning.utilization")}
          value={`${data.utilizationPct}%`}
          tone={data.utilizationPct > 100 ? "negative" : data.utilizationPct > 85 ? "caution" : "positive"}
        />
        <IconStatCard
          icon={<AlertTriangleIcon />}
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
