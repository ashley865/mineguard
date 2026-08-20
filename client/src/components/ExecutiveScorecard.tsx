import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "../api/client";
import { BudgetSummary, ExecutiveSummary } from "../api/types";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const cardOuter = "bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6";

// Budget health is scored around 100% utilization being "on plan" — mild penalty for
// drifting either side of it, a steeper one for actually going over, and a full mark
// when there's simply no budget data yet (nothing to be unhealthy about).
function scoreBudget(summary: BudgetSummary | null): number {
  if (!summary || summary.planCount === 0) return 100;
  const u = summary.utilizationPct;
  if (u <= 100) return Math.max(0, Math.round(100 - Math.abs(100 - u) * 0.5));
  return Math.max(0, Math.round(100 - (u - 100) * 2));
}

// A single "at a glance" cross-department read — five KPIs already computed elsewhere in
// the app (compliance, incidents, uptime, workforce coverage) or one cheap extra fetch
// (budget), normalized to a common 0-100 scale so they're comparable on one radar rather
// than scattered across five separate stat cards with five different units.
export default function ExecutiveScorecard({ summary }: { summary: ExecutiveSummary }) {
  const { t } = useTranslation();
  const [budget, setBudget] = useState<BudgetSummary | null>(null);

  useEffect(() => {
    api.get<BudgetSummary>("/budget-plans/summary").then((res) => setBudget(res.data)).catch(() => {});
  }, []);

  const complianceScore = summary.complianceScore;
  const safetyScore = Math.max(0, Math.round(100 - summary.incidents.open * 15 - summary.incidents.investigating * 5));
  const uptimeScore = summary.equipment.uptimePct;
  const workforceScore = summary.workers.total > 0 ? Math.round((summary.workers.onShift / summary.workers.total) * 100) : 100;
  const budgetScore = scoreBudget(budget);

  const data = [
    { metric: t("executive.scorecard.compliance"), value: complianceScore },
    { metric: t("executive.scorecard.safety"), value: safetyScore },
    { metric: t("executive.scorecard.uptime"), value: uptimeScore },
    { metric: t("executive.scorecard.workforce"), value: workforceScore },
    { metric: t("executive.scorecard.budget"), value: budgetScore },
  ];

  const overall = Math.round(data.reduce((sum, d) => sum + d.value, 0) / data.length);
  const overallTone = overall >= 80 ? "text-success-500" : overall >= 50 ? "text-hazard-500" : "text-danger-500";

  return (
    <div className={cardOuter}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold">{t("executive.scorecard.title")}</h2>
        <div className="text-right">
          <div className="text-[10px] text-mine-400 uppercase tracking-wide">{t("executive.scorecard.overall")}</div>
          <div className={`text-2xl font-bold leading-none ${overallTone}`}>{overall}</div>
        </div>
      </div>
      <p className="text-xs text-mine-400 mb-4">{t("executive.scorecard.hint")}</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="#e5e5e5" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "#52525b" }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8, fill: "#9ca3af" }} tickCount={5} axisLine={false} />
            <Radar dataKey="value" stroke="#c48a1f" fill="#c48a1f" fillOpacity={0.35} strokeWidth={2} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}/100`} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
