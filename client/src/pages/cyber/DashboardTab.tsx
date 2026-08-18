import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../../api/client";
import { CyberDashboard } from "../../api/types";
import { CyberTheme, SeverityPill } from "./cyberTheme";

function scoreTone(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-amber-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function scoreRing(score: number): string {
  if (score >= 80) return "border-green-500";
  if (score >= 60) return "border-amber-500";
  if (score >= 40) return "border-orange-500";
  return "border-red-500";
}

function StatBlock({ theme, label, value, tone }: { theme: CyberTheme; label: string; value: string | number; tone?: string }) {
  return (
    <div className={`${theme.panel} px-3 py-2.5`}>
      <div className={`text-[10px] uppercase tracking-wide ${theme.mutedText}`}>{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${tone ?? theme.text}`}>{value}</div>
    </div>
  );
}

export default function DashboardTab({ theme, onNavigate }: { theme: CyberTheme; onNavigate: (tab: string) => void }) {
  const { t } = useTranslation();
  const [data, setData] = useState<CyberDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<CyberDashboard>("/cyber-dashboard");
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading || !data) return <div className={theme.subtext}>{t("common.loading")}</div>;

  const trendArrow = data.trendDirection === "up" ? "▲" : data.trendDirection === "down" ? "▼" : "—";
  const trendTone = data.trendDirection === "up" ? "text-green-500" : data.trendDirection === "down" ? "text-red-500" : theme.mutedText;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className={`${theme.panel} p-4 flex flex-col items-center justify-center text-center lg:col-span-1`}>
          <div className={`text-[10px] uppercase tracking-wide ${theme.mutedText} mb-2`}>{t("cyber.dashboard.securityScore")}</div>
          <div className={`w-28 h-28 rounded-full border-4 ${scoreRing(data.score)} flex items-center justify-center`}>
            <span className={`text-3xl font-extrabold ${scoreTone(data.score)}`}>{data.score}</span>
          </div>
          {data.trendDirection && (
            <div className={`text-xs mt-2 font-semibold ${trendTone}`}>
              {trendArrow} {t(`cyber.dashboard.trend.${data.trendDirection}`)}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatBlock theme={theme} label={t("cyber.dashboard.openAlerts")} value={data.activeThreats.openAlerts} tone={data.activeThreats.openAlerts > 0 ? "text-amber-500" : undefined} />
          <StatBlock theme={theme} label={t("cyber.dashboard.openIncidents")} value={data.activeThreats.openIncidents} tone={data.activeThreats.openIncidents > 0 ? "text-amber-500" : undefined} />
          <StatBlock theme={theme} label={t("cyber.dashboard.criticalCount")} value={data.activeThreats.criticalCount} tone={data.activeThreats.criticalCount > 0 ? "text-red-500" : undefined} />
          <StatBlock theme={theme} label={t("cyber.dashboard.compromisedEndpoints")} value={data.endpoints.compromised} tone={data.endpoints.compromised > 0 ? "text-red-500" : undefined} />
          <StatBlock theme={theme} label={t("cyber.dashboard.unprotectedEndpoints")} value={data.endpoints.unprotected} tone={data.endpoints.unprotected > 0 ? "text-amber-500" : undefined} />
          <StatBlock theme={theme} label={t("cyber.dashboard.overdueVulns")} value={data.vulnerabilities.overdueCritical + data.vulnerabilities.overdueHigh} tone={data.vulnerabilities.overdueCritical + data.vulnerabilities.overdueHigh > 0 ? "text-red-500" : undefined} />
          <StatBlock theme={theme} label={t("cyber.dashboard.nonCompliantPolicies")} value={data.compliance.nonCompliantPolicies} tone={data.compliance.nonCompliantPolicies > 0 ? "text-amber-500" : undefined} />
          <StatBlock theme={theme} label={t("cyber.dashboard.openFindings")} value={data.compliance.openFindings} />
        </div>
      </div>

      {data.trend.length > 1 && (
        <div className={`${theme.panel} p-4`}>
          <div className={`text-xs font-semibold mb-2 ${theme.text}`}>{t("cyber.dashboard.trendChart")}</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.dark ? "rgba(255,255,255,0.08)" : "#e2e8f0"} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: theme.dark ? "rgba(255,255,255,0.4)" : "#94a3b8" }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: theme.dark ? "rgba(255,255,255,0.4)" : "#94a3b8" }} width={28} />
                <Tooltip
                  contentStyle={
                    theme.dark
                      ? { background: "#0f1523", border: "1px solid rgba(255,255,255,0.15)", fontSize: 11, borderRadius: 6, color: "#fff" }
                      : { background: "#fff", border: "1px solid #e2e8f0", fontSize: 11, borderRadius: 6 }
                  }
                />
                <Line type="monotone" dataKey="score" stroke="#c48a1f" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.scoreBreakdown.length > 0 && (
        <div className={`${theme.panel} p-4`}>
          <div className={`text-xs font-semibold mb-2 ${theme.text}`}>{t("cyber.dashboard.scoreBreakdown")}</div>
          <div className="space-y-1.5">
            {data.scoreBreakdown.map((b) => (
              <div key={b.label} className="flex items-center justify-between text-xs">
                <span className={theme.subtext}>
                  {b.label} ({b.count})
                </span>
                <span className="text-red-500 font-semibold">-{b.pointsDeducted}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`${theme.panel} p-4`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-semibold ${theme.text}`}>{t("cyber.dashboard.recentAlerts")}</span>
            <button className={`text-[10px] ${theme.subtext} hover:text-hazard-500`} onClick={() => onNavigate("incidents")}>
              {t("cyber.dashboard.viewAll")}
            </button>
          </div>
          <div className="space-y-1.5">
            {data.recentAlerts.length === 0 && <div className={`text-xs ${theme.mutedText}`}>{t("cyber.dashboard.noActiveAlerts")}</div>}
            {data.recentAlerts.map((a) => (
              <div key={a.id} className={`flex items-center justify-between gap-2 text-xs border-t ${theme.rowBorder} pt-1.5 first:border-t-0 first:pt-0`}>
                <span className={`${theme.text} truncate`}>{a.title}</span>
                <SeverityPill severity={a.severity} />
              </div>
            ))}
          </div>
        </div>
        <div className={`${theme.panel} p-4`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-semibold ${theme.text}`}>{t("cyber.dashboard.recentIncidents")}</span>
            <button className={`text-[10px] ${theme.subtext} hover:text-hazard-500`} onClick={() => onNavigate("incidents")}>
              {t("cyber.dashboard.viewAll")}
            </button>
          </div>
          <div className="space-y-1.5">
            {data.recentIncidents.length === 0 && <div className={`text-xs ${theme.mutedText}`}>{t("cyber.dashboard.noActiveIncidents")}</div>}
            {data.recentIncidents.map((i) => (
              <div key={i.id} className={`flex items-center justify-between gap-2 text-xs border-t ${theme.rowBorder} pt-1.5 first:border-t-0 first:pt-0`}>
                <span className={`${theme.text} truncate`}>{i.title}</span>
                <SeverityPill severity={i.severity} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
