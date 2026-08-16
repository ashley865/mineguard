import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api } from "../api/client";
import { InventoryProcurementSummary } from "../api/types";
import { cardClass } from "./ui";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 9, fill: "#52525b" };
const PO_STATUS_COLORS: Record<string, string> = {
  DRAFT: "#6b6b6b",
  SUBMITTED: "#d9a441",
  APPROVED: "#8a9ab5",
  ORDERED: "#3f5a7d",
  RECEIVED: "#16a34a",
  CANCELLED: "#e13b2e",
};
const SUPPLIER_STATUS_COLORS: Record<string, string> = { ACTIVE: "#16a34a", INACTIVE: "#6b6b6b", BLACKLISTED: "#e13b2e" };
const EXPLOSIVES_STATUS_COLORS: Record<string, string> = { ACTIVE: "#16a34a", SUSPENDED: "#d9a441", EXPIRED: "#e13b2e" };

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "danger" | "caution" }) {
  const toneClass = tone === "danger" ? "text-danger-500" : tone === "caution" ? "text-hazard-500" : "text-mine-50";
  return (
    <div className={`${cardClass} px-3 py-2.5`}>
      <div className="text-[10px] text-mine-300 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${toneClass}`}>{value}</div>
    </div>
  );
}

export default function InventoryProcurementWidget() {
  const { t } = useTranslation();
  const [data, setData] = useState<InventoryProcurementSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<InventoryProcurementSummary>("/inventory/summary")
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={`${cardClass} p-3`}>
        <div className="text-mine-300 text-xs">{t("common.loading")}</div>
      </div>
    );
  }
  if (!data) return null;

  const categoryChartData = data.categories.map((c) => ({
    category: t(`inventory.categories.${c.category}`),
    itemCount: c.itemCount,
    lowStockCount: c.lowStockCount,
    totalValue: c.totalValue,
  }));

  const poChartData = Object.entries(data.purchaseOrders.byStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ status, count }));

  const supplierChartData = Object.entries(data.suppliers.byStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ status, count }));

  const explosivesChartData = Object.entries(data.explosives.byStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ status, count }));

  return (
    <div className={`${cardClass} p-3 space-y-4`}>
      <h2 className="text-xs font-semibold">{t("inventory.procurementOverviewTitle")}</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label={t("inventory.lowStockItems")} value={data.lowStockItems.length.toString()} tone={data.lowStockItems.length > 0 ? "caution" : undefined} />
        <StatCard label={t("inventory.explosivesStock")} value={`${data.explosives.totalCurrentStock.toLocaleString()} / ${data.explosives.totalCapacity.toLocaleString()}`} />
        <StatCard label={t("inventory.openPoValue")} value={`ZAR ${Math.round(data.purchaseOrders.openValue).toLocaleString()}`} />
        <StatCard
          label={t("inventory.pendingApproval")}
          value={data.purchaseOrders.pendingApproval.toString()}
          tone={data.purchaseOrders.pendingApproval > 0 ? "caution" : undefined}
        />
      </div>

      <div className={`${cardClass} p-3`}>
        <h3 className="text-xs font-semibold mb-2">{t("inventory.byCategory")}</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryChartData}>
              <XAxis dataKey="category" tick={CHART_TICK_STYLE} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={CHART_TICK_STYLE} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="itemCount" name={t("inventory.itemCount")} fill="#8a9ab5" radius={[3, 3, 0, 0]} />
              <Bar dataKey="lowStockCount" name={t("inventory.lowStockOnly")} fill="#e13b2e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className={`${cardClass} p-3`}>
          <h3 className="text-xs font-semibold mb-2">{t("inventory.explosivesByStatus")}</h3>
          {explosivesChartData.length === 0 ? (
            <div className="text-mine-400 text-xs h-32 flex items-center justify-center">{t("inventory.noneYet")}</div>
          ) : (
            <div className="h-32 flex items-center gap-2">
              <div className="w-24 h-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={explosivesChartData} dataKey="count" nameKey="status" innerRadius={22} outerRadius={40} paddingAngle={2}>
                      {explosivesChartData.map((d) => (
                        <Cell key={d.status} fill={EXPLOSIVES_STATUS_COLORS[d.status]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 text-xs flex-1 min-w-0">
                {explosivesChartData.map((d) => (
                  <div key={d.status} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-mine-300 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: EXPLOSIVES_STATUS_COLORS[d.status] }} />
                      {t(`badges.status.${d.status}`)}
                    </span>
                    <span className="font-semibold text-mine-50">{d.count}</span>
                  </div>
                ))}
                {data.explosives.expiringLicenses > 0 && (
                  <div className="text-hazard-500 font-semibold pt-1">
                    {t("inventory.expiringLicenses", { count: data.explosives.expiringLicenses })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={`${cardClass} p-3`}>
          <h3 className="text-xs font-semibold mb-2">{t("inventory.poByStatus")}</h3>
          {poChartData.length === 0 ? (
            <div className="text-mine-400 text-xs h-32 flex items-center justify-center">{t("inventory.noneYet")}</div>
          ) : (
            <div className="h-32 flex items-center gap-2">
              <div className="w-24 h-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={poChartData} dataKey="count" nameKey="status" innerRadius={22} outerRadius={40} paddingAngle={2}>
                      {poChartData.map((d) => (
                        <Cell key={d.status} fill={PO_STATUS_COLORS[d.status]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 text-xs flex-1 min-w-0">
                {poChartData.map((d) => (
                  <div key={d.status} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-mine-300 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PO_STATUS_COLORS[d.status] }} />
                      {t(`badges.status.${d.status}`)}
                    </span>
                    <span className="font-semibold text-mine-50">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`${cardClass} p-3`}>
          <h3 className="text-xs font-semibold mb-2">{t("inventory.suppliersByStatus")}</h3>
          {supplierChartData.length === 0 ? (
            <div className="text-mine-400 text-xs h-32 flex items-center justify-center">{t("inventory.noneYet")}</div>
          ) : (
            <div className="h-32 flex items-center gap-2">
              <div className="w-24 h-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={supplierChartData} dataKey="count" nameKey="status" innerRadius={22} outerRadius={40} paddingAngle={2}>
                      {supplierChartData.map((d) => (
                        <Cell key={d.status} fill={SUPPLIER_STATUS_COLORS[d.status]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 text-xs flex-1 min-w-0">
                {supplierChartData.map((d) => (
                  <div key={d.status} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-mine-300 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SUPPLIER_STATUS_COLORS[d.status] }} />
                      {t(`badges.status.${d.status}`)}
                    </span>
                    <span className="font-semibold text-mine-50">{d.count}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-mine-800">
                  <span className="text-mine-300">{t("inventory.totalSuppliers")}</span>
                  <span className="font-semibold text-mine-50">{data.suppliers.total}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`${cardClass} p-3`}>
        <h3 className="text-xs font-semibold mb-2">{t("inventory.lowStockItems")}</h3>
        {data.lowStockItems.length === 0 ? (
          <div className="text-mine-400 text-xs h-16 flex items-center justify-center">{t("inventory.noLowStock")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-mine-400 uppercase">
                <tr>
                  <th className="text-left pr-3 py-1.5">{t("common.name")}</th>
                  <th className="text-left pr-3 py-1.5">{t("inventory.category")}</th>
                  <th className="text-left pr-3 py-1.5">{t("common.site")}</th>
                  <th className="text-right py-1.5">{t("inventory.quantityOnHand")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mine-800">
                {data.lowStockItems.map((item, i) => (
                  <tr key={i}>
                    <td className="pr-3 py-1.5 font-medium">{item.name}</td>
                    <td className="pr-3 py-1.5 text-mine-300">{item.category ? t(`inventory.categories.${item.category}`) : t("inventory.uncategorized")}</td>
                    <td className="pr-3 py-1.5 text-mine-300">{item.site ?? "—"}</td>
                    <td className="text-right py-1.5 text-danger-500 font-semibold">
                      {item.quantityOnHand} {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
