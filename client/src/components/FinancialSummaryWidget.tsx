import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../api/client";
import { ProductionFinancialSummary } from "../api/types";
import { TrendingUpIcon, TrendingDownIcon, CoinsIcon, PackageIcon } from "./icons/DashboardIcons";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 9, fill: "#52525b" };
const MINERAL_COLORS = ["#c48a1f", "#8a9ab5", "#16a34a", "#e13b2e", "#5b7092", "#d9a441", "#3f5a7d", "#7a8a5a"];

const cardOuter = "bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6";

function IconStatCard({ icon, tone, label, value }: { icon: React.ReactNode; tone: string; label: string; value: string }) {
  return (
    <div className={`${cardOuter} p-[22px]`}>
      <div className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center mb-3.5 ${tone}`}>{icon}</div>
      <div className="text-lg font-bold leading-none truncate">{value}</div>
      <div className="text-xs text-mine-400 mt-2">{label}</div>
    </div>
  );
}

export default function FinancialSummaryWidget() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<ProductionFinancialSummary | null>(null);

  useEffect(() => {
    api
      .get<ProductionFinancialSummary>("/production/financial-summary", { params: { months: 6 } })
      .then((res) => setSummary(res.data))
      .catch(() => {});
  }, []);

  if (!summary) return null;

  const money = (n: number) => `ZAR ${Math.round(n).toLocaleString()}`;
  const minerals = summary.minerals ?? [];

  const firstMonth = summary.months[0];
  const lastMonth = summary.months[summary.months.length - 1];
  const earningsChangePct = firstMonth && lastMonth && firstMonth.earnings > 0
    ? Math.round(((lastMonth.earnings - firstMonth.earnings) / firstMonth.earnings) * 100)
    : null;

  const mineralTotals = minerals.map((mineral) => ({
    mineral,
    total: summary.months.reduce((sum, m) => sum + (m.tonnesByMineral?.[mineral] ?? 0), 0),
  }));
  const topMineral = mineralTotals.length > 0 ? mineralTotals.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  const mineralGrandTotal = mineralTotals.reduce((sum, m) => sum + m.total, 0);
  const topMineralPct = topMineral && mineralGrandTotal > 0 ? Math.round((topMineral.total / mineralGrandTotal) * 100) : null;

  return (
    <div className={cardOuter}>
      <h2 className="text-sm font-semibold mb-5">{t("dashboard.financialPerformance")}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <IconStatCard icon={<TrendingUpIcon />} tone="bg-success-500/10 text-success-500" label={t("production.totalEarnings")} value={money(summary.totals.totalEarnings)} />
        <IconStatCard icon={<TrendingDownIcon />} tone="bg-danger-500/10 text-danger-500" label={t("production.totalExpenses")} value={money(summary.totals.totalExpenses)} />
        <IconStatCard icon={<CoinsIcon />} tone="bg-hazard-500/10 text-hazard-500" label={t("production.netMargin")} value={money(summary.totals.netMargin)} />
        <IconStatCard icon={<PackageIcon />} tone="bg-mine-400/10 text-mine-400" label={t("production.totalTonnes")} value={summary.totals.totalTonnes.toLocaleString()} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-semibold">{t("production.earningsVsExpenses")}</div>
          {earningsChangePct !== null && (
            <p className="text-[11px] text-mine-400 mt-0.5 mb-3">
              {earningsChangePct >= 0
                ? t("production.earningsTrendUp", { pct: earningsChangePct })
                : t("production.earningsTrendDown", { pct: Math.abs(earningsChangePct) })}
            </p>
          )}
          <div className={`h-48 ${earningsChangePct === null ? "mt-4" : ""}`}>
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
          <div className="text-sm font-semibold">{t("production.tonnesByMineral")}</div>
          {topMineral && topMineralPct !== null && (
            <p className="text-[11px] text-mine-400 mt-0.5 mb-3">{t("production.topMineralInsight", { mineral: topMineral.mineral, pct: topMineralPct })}</p>
          )}
          <div className={`h-48 ${!topMineral ? "mt-4" : ""}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.months.map((m) => ({ month: m.month, ...m.tonnesByMineral }))}>
                <XAxis dataKey="month" tick={CHART_TICK_STYLE} tickFormatter={(m: string) => m.slice(2)} />
                <YAxis tick={CHART_TICK_STYLE} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {minerals.map((mineral, i) => (
                  <Bar key={mineral} dataKey={mineral} name={mineral} stackId="tonnes" fill={MINERAL_COLORS[i % MINERAL_COLORS.length]} radius={i === minerals.length - 1 ? [3, 3, 0, 0] : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
