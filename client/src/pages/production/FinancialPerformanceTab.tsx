import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { api } from "../../api/client";
import { ProductionFinancialSummary, Site } from "../../api/types";
import { cardClass, selectClass } from "../../components/ui";
import LoadError from "../../components/LoadError";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 10, fill: "#52525b" };
const CATEGORY_COLORS = ["#c48a1f", "#8a9ab5", "#16a34a", "#e13b2e", "#f3665b", "#5b7092", "#d9a441", "#3f5a7d", "#7a8a5a", "#9a6b3f", "#6b6b6b"];
const MINERAL_COLORS = ["#c48a1f", "#8a9ab5", "#16a34a", "#e13b2e", "#5b7092", "#d9a441", "#3f5a7d", "#7a8a5a"];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${cardClass} px-4 py-3`}>
      <div className="text-xs text-mine-300 uppercase">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default function FinancialPerformanceTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState("");
  const [months, setMonths] = useState(6);
  const [summary, setSummary] = useState<ProductionFinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ProductionFinancialSummary>("/production/financial-summary", {
        params: { siteId: siteId || undefined, months },
      });
      setSummary(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, months]);

  const currency = "ZAR";
  const money = (n: number) => `${currency} ${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select className={`${selectClass} max-w-xs`} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">{t("production.allSites")}</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={`${selectClass} max-w-[10rem]`} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          <option value={3}>{t("production.lastNMonths", { count: 3 })}</option>
          <option value={6}>{t("production.lastNMonths", { count: 6 })}</option>
          <option value={12}>{t("production.lastNMonths", { count: 12 })}</option>
        </select>
      </div>

      {loading && <div className="text-mine-300">{t("common.loading")}</div>}
      {loadError && <LoadError onRetry={load} />}

      {!loading && summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label={t("production.totalEarnings")} value={money(summary.totals.totalEarnings)} />
            <StatCard label={t("production.totalExpenses")} value={money(summary.totals.totalExpenses)} />
            <StatCard label={t("production.netMargin")} value={money(summary.totals.netMargin)} />
            <StatCard label={t("production.totalTonnes")} value={summary.totals.totalTonnes.toLocaleString()} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className={`${cardClass} p-4`}>
              <h3 className="text-sm font-semibold mb-3">{t("production.earningsVsExpenses")}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.months}>
                    <XAxis dataKey="month" tick={CHART_TICK_STYLE} tickFormatter={(m: string) => m.slice(2)} />
                    <YAxis tick={CHART_TICK_STYLE} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="earnings" name={t("production.earnings")} fill="#16a34a" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="expenses" name={t("production.expenses")} fill="#e13b2e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${cardClass} p-4`}>
              <h3 className="text-sm font-semibold mb-3">{t("production.tonnesByMineral")}</h3>
              {(summary.minerals ?? []).length === 0 ? (
                <div className="text-mine-400 text-xs h-64 flex items-center justify-center">{t("production.noneYet")}</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.months.map((m) => ({ month: m.month, ...m.tonnesByMineral }))}>
                      <XAxis dataKey="month" tick={CHART_TICK_STYLE} tickFormatter={(m: string) => m.slice(2)} />
                      <YAxis tick={CHART_TICK_STYLE} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {(summary.minerals ?? []).map((mineral, i) => (
                        <Bar key={mineral} dataKey={mineral} name={t(`mineralTypes.${mineral}`)} stackId="tonnes" fill={MINERAL_COLORS[i % MINERAL_COLORS.length]} radius={i === (summary.minerals ?? []).length - 1 ? [3, 3, 0, 0] : undefined} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className={`${cardClass} p-4`}>
            <h3 className="text-sm font-semibold mb-3">{t("expenses.byCategory")}</h3>
            {summary.expensesByCategory.length === 0 ? (
              <div className="text-mine-400 text-xs h-32 flex items-center justify-center">{t("expenses.noneYet")}</div>
            ) : (
              <div className="h-56 flex items-center gap-4">
                <div className="w-40 h-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={summary.expensesByCategory} dataKey="amount" nameKey="category" innerRadius={40} outerRadius={70} paddingAngle={2}>
                        {summary.expensesByCategory.map((d, i) => (
                          <Cell key={d.category} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => money(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1 text-xs flex-1 min-w-0">
                  {summary.expensesByCategory.map((d, i) => (
                    <div key={d.category} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-mine-300 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                        {t(`expenses.categories.${d.category}`)}
                      </span>
                      <span className="font-semibold text-mine-50">{money(d.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
