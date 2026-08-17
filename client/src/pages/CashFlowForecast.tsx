import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { CashFlowForecastResponse } from "../api/types";
import { cardClass } from "../components/ui";
import LoadError from "../components/LoadError";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 10, fill: "#52525b" };

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${cardClass} px-4 py-3`}>
      <div className="text-xs text-mine-300 uppercase">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default function CashFlowForecast() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canView = user?.role === "ADMIN" || ["CFO", "GENERAL_MANAGER", "COO"].includes(user?.title ?? "");
  const [data, setData] = useState<CashFlowForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<CashFlowForecastResponse>("/cash-flow-forecast");
      setData(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canView) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canView) return <Navigate to="/" replace />;
  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;
  if (!data) return null;

  const money = (n: number) => `ZAR ${Math.round(n).toLocaleString()}`;
  const chartData = [
    ...data.history.map((m) => ({ month: m.month, netCashFlow: m.netCashFlow, projected: null as number | null })),
    ...data.forecast.map((f) => ({ month: f.month, netCashFlow: null as number | null, projected: f.projectedNetCashFlow })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("cashFlowForecast.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("cashFlowForecast.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label={t("cashFlowForecast.currentRatio")} value={data.ratios.currentRatio?.toFixed(2) ?? "—"} />
        <StatCard label={t("cashFlowForecast.quickRatio")} value={data.ratios.quickRatio?.toFixed(2) ?? "—"} />
        <StatCard label={t("cashFlowForecast.debtToEquity")} value={data.ratios.debtToEquity?.toFixed(2) ?? "—"} />
      </div>

      <div className={`${cardClass} p-4`}>
        <h3 className="text-sm font-semibold mb-1">{t("cashFlowForecast.chartTitle")}</h3>
        <p className="text-xs text-mine-400 mb-3">{t("cashFlowForecast.chartHint")}</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="month" tick={CHART_TICK_STYLE} tickFormatter={(m: string) => m.slice(2)} />
              <YAxis tick={CHART_TICK_STYLE} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => money(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="netCashFlow" name={t("cashFlowForecast.actual")} fill="#16a34a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="projected" name={t("cashFlowForecast.projected")} fill="#c48a1f" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("cashFlowForecast.cash")} value={money(data.balanceSnapshot.cashAndEquivalents)} />
        <StatCard label={t("cashFlowForecast.receivable")} value={money(data.balanceSnapshot.accountsReceivable)} />
        <StatCard label={t("cashFlowForecast.inventory")} value={money(data.balanceSnapshot.inventory)} />
        <StatCard label={t("cashFlowForecast.payable")} value={money(data.balanceSnapshot.accountsPayable)} />
      </div>

      <p className="text-[10px] text-mine-500">{t("cashFlowForecast.disclaimer")}</p>
    </div>
  );
}
