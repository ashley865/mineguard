import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ComposedChart,
  BarChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { api } from "../api/client";
import { ProductionAnalytics } from "../api/types";
import { cardClass, selectClass } from "./ui";
import LoadError from "./LoadError";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 9, fill: "#52525b" };
const SHIFT_COLORS: Record<string, string> = { DAY: "#c48a1f", AFTERNOON: "#8a9ab5", NIGHT: "#3f5a7d" };
const SECTION_COLORS = ["#c48a1f", "#8a9ab5", "#16a34a", "#e13b2e", "#5b7092", "#d9a441", "#3f5a7d", "#7a8a5a"];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${cardClass} px-3 py-2.5`}>
      <div className="text-[10px] text-mine-300 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}

const periodTickFormatter = (period: "daily" | "weekly" | "monthly") => (v: string) => {
  if (period === "monthly") return v.slice(2);
  return v.slice(5);
};

const DAYS_BY_PERIOD: Record<"daily" | "weekly" | "monthly", number> = {
  daily: 30,
  weekly: 90,
  monthly: 365,
};

export default function ProductionAnalyticsWidget({ siteId }: { siteId?: string }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [data, setData] = useState<ProductionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ProductionAnalytics>("/production/analytics", {
        params: { siteId: siteId || undefined, period, days: DAYS_BY_PERIOD[period] },
      });
      setData(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, period]);

  const tickFormatter = periodTickFormatter(period);

  return (
    <div className={`${cardClass} p-3 space-y-4`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xs font-semibold">{t("production.analyticsTitle")}</h2>
        <select className={`${selectClass} text-xs max-w-[10rem] py-1.5`} value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>
          <option value="daily">{t("production.periodDaily")}</option>
          <option value="weekly">{t("production.periodWeekly")}</option>
          <option value="monthly">{t("production.periodMonthly")}</option>
        </select>
      </div>

      {loading && <div className="text-mine-300 text-xs">{t("common.loading")}</div>}
      {loadError && <LoadError onRetry={load} />}

      {!loading && !loadError && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label={t("production.tonnesMined")} value={data.totals.tonnesMined.toLocaleString()} />
            <StatCard label={t("production.tonnesProcessed")} value={data.totals.tonnesProcessed.toLocaleString()} />
            <StatCard label={t("production.avgOreGrade")} value={data.totals.avgOreGrade != null ? `${data.totals.avgOreGrade}%` : "—"} />
            <StatCard label={t("production.avgRecovery")} value={data.totals.avgRecoveryRate != null ? `${data.totals.avgRecoveryRate}%` : "—"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className={`${cardClass} p-3`}>
              <h3 className="text-xs font-semibold mb-2">{t("production.actualVsPlanned")}</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.trend}>
                    <XAxis dataKey="period" tick={CHART_TICK_STYLE} tickFormatter={tickFormatter} />
                    <YAxis tick={CHART_TICK_STYLE} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="tonnesMined" name={t("production.tonnesMined")} fill="#c48a1f" radius={[3, 3, 0, 0]} />
                    <Line type="monotone" dataKey="targetTonnes" name={t("production.targetTonnes")} stroke="#e13b2e" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${cardClass} p-3`}>
              <h3 className="text-xs font-semibold mb-2">{t("production.minedVsProcessed")}</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trend}>
                    <XAxis dataKey="period" tick={CHART_TICK_STYLE} tickFormatter={tickFormatter} />
                    <YAxis tick={CHART_TICK_STYLE} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="tonnesMined" name={t("production.tonnesMined")} fill="#8a9ab5" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="tonnesProcessed" name={t("production.tonnesProcessed")} fill="#16a34a" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${cardClass} p-3`}>
              <h3 className="text-xs font-semibold mb-2">{t("production.oreVsWaste")}</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trend}>
                    <XAxis dataKey="period" tick={CHART_TICK_STYLE} tickFormatter={tickFormatter} />
                    <YAxis tick={CHART_TICK_STYLE} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="tonnesMined" name={t("production.ore")} stackId="ow" fill="#c48a1f" />
                    <Bar dataKey="wasteRemoved" name={t("production.waste")} stackId="ow" fill="#6b6b6b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${cardClass} p-3`}>
              <h3 className="text-xs font-semibold mb-2">{t("production.gradeAndRecovery")}</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trend}>
                    <XAxis dataKey="period" tick={CHART_TICK_STYLE} tickFormatter={tickFormatter} />
                    <YAxis tick={CHART_TICK_STYLE} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="oreGrade" name={t("production.oreGrade")} stroke="#d9a441" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="recoveryRate" name={t("production.recoveryRate")} stroke="#16a34a" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className={`${cardClass} p-3`}>
              <h3 className="text-xs font-semibold mb-2">{t("production.byShift")}</h3>
              {data.byShift.every((s) => s.tonnesMined === 0) ? (
                <div className="text-mine-400 text-xs h-40 flex items-center justify-center">{t("production.noneYet")}</div>
              ) : (
                <div className="h-40 flex items-center gap-3">
                  <div className="w-32 h-32 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.byShift} dataKey="tonnesMined" nameKey="shift" innerRadius={28} outerRadius={55} paddingAngle={2}>
                          {data.byShift.map((s) => (
                            <Cell key={s.shift} fill={SHIFT_COLORS[s.shift]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1 text-xs flex-1 min-w-0">
                    {data.byShift.map((s) => (
                      <div key={s.shift} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-mine-300 truncate">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SHIFT_COLORS[s.shift] }} />
                          {t(`production.shifts.${s.shift}`)}
                        </span>
                        <span className="font-semibold text-mine-50">{s.tonnesMined.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={`${cardClass} p-3`}>
              <h3 className="text-xs font-semibold mb-2">{t("production.bySection")}</h3>
              {data.bySection.length === 0 ? (
                <div className="text-mine-400 text-xs h-40 flex items-center justify-center">{t("production.noneYet")}</div>
              ) : (
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.bySection} layout="vertical" margin={{ left: 8 }}>
                      <XAxis type="number" tick={CHART_TICK_STYLE} />
                      <YAxis type="category" dataKey="name" tick={CHART_TICK_STYLE} width={90} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Bar dataKey="tonnesMined" name={t("production.tonnesMined")} radius={[0, 3, 3, 0]}>
                        {data.bySection.map((s, i) => (
                          <Cell key={s.name} fill={SECTION_COLORS[i % SECTION_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
