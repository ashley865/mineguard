import { ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../../api/client";
import { CyberDashboard } from "../../api/types";
import { CyberTheme, SeverityPill } from "./cyberTheme";

function scoreTone(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-amber-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function scoreStroke(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#d9a441";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
    </svg>
  );
}

function badgeBg(toneClass: string | undefined, dark: boolean): string {
  if (toneClass === "text-amber-500") return "bg-amber-500/10";
  if (toneClass === "text-red-500") return "bg-red-500/10";
  return dark ? "bg-white/5" : "bg-slate-900/5";
}

function IconStatCard({
  theme,
  icon,
  label,
  value,
  toneClass,
}: {
  theme: CyberTheme;
  icon: ReactNode;
  label: string;
  value: string | number;
  toneClass?: string;
}) {
  return (
    <div className={`${theme.panel} p-[22px]`}>
      <div className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center mb-3.5 ${badgeBg(toneClass, theme.dark)} ${toneClass ?? theme.mutedText}`}>
        {icon}
      </div>
      <div className={`text-[28px] font-bold leading-none ${toneClass ?? theme.text}`}>{value}</div>
      <div className={`text-xs mt-2 ${theme.mutedText}`}>{label}</div>
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
  const overdueVulns = data.vulnerabilities.overdueCritical + data.vulnerabilities.overdueHigh;

  return (
    <div className="space-y-4">
      {/* Score + posture summary */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <div className={`${theme.panel} p-6 flex flex-col items-center justify-center text-center`}>
          <div className={`text-[10px] uppercase tracking-wide ${theme.mutedText} mb-4`}>{t("cyber.dashboard.securityScore")}</div>
          <div className="relative w-[132px] h-[132px]">
            <svg width="132" height="132" viewBox="0 0 132 132">
              <circle cx="66" cy="66" r="56" fill="none" stroke={theme.dark ? "rgba(255,255,255,0.08)" : "#e2e8f0"} strokeWidth="10" />
              <circle
                cx="66"
                cy="66"
                r="56"
                fill="none"
                stroke={scoreStroke(data.score)}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 56}
                strokeDashoffset={2 * Math.PI * 56 * (1 - data.score / 100)}
                transform="rotate(-90 66 66)"
                style={{ filter: `drop-shadow(0 0 6px ${scoreStroke(data.score)}80)` }}
              />
            </svg>
            <div className={`absolute inset-0 flex items-center justify-center text-3xl font-extrabold ${scoreTone(data.score)}`}>{data.score}</div>
          </div>
          {data.trendDirection && (
            <div className={`text-xs mt-3 font-semibold ${trendTone}`}>
              {trendArrow} {t(`cyber.dashboard.trend.${data.trendDirection}`)}
            </div>
          )}
        </div>

        <div className={`${theme.panel} p-6 flex items-center`}>
          <div className={`text-[15px] font-semibold ${theme.text}`}>
            {data.score}/100 — {data.activeThreats.criticalCount > 0
              ? t("cyber.dashboard.postureCritical", { count: data.activeThreats.criticalCount, incidents: data.activeThreats.openIncidents })
              : t("cyber.dashboard.postureOk", { count: data.activeThreats.openIncidents })}
          </div>
        </div>
      </div>

      {/* Stat row — icon-badge cards, same anatomy as the HR dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <IconStatCard theme={theme} icon={<BellIcon />} label={t("cyber.dashboard.openAlerts")} value={data.activeThreats.openAlerts} toneClass={data.activeThreats.openAlerts > 0 ? "text-amber-500" : undefined} />
        <IconStatCard theme={theme} icon={<BellIcon />} label={t("cyber.dashboard.openIncidents")} value={data.activeThreats.openIncidents} toneClass={data.activeThreats.openIncidents > 0 ? "text-amber-500" : undefined} />
        <IconStatCard theme={theme} icon={<BellIcon />} label={t("cyber.dashboard.criticalCount")} value={data.activeThreats.criticalCount} toneClass={data.activeThreats.criticalCount > 0 ? "text-red-500" : undefined} />
        <IconStatCard theme={theme} icon={<ShieldIcon />} label={t("cyber.dashboard.compromisedEndpoints")} value={data.endpoints.compromised} toneClass={data.endpoints.compromised > 0 ? "text-red-500" : undefined} />
        <IconStatCard theme={theme} icon={<ShieldIcon />} label={t("cyber.dashboard.unprotectedEndpoints")} value={data.endpoints.unprotected} toneClass={data.endpoints.unprotected > 0 ? "text-amber-500" : undefined} />
        <IconStatCard theme={theme} icon={<ClockIcon />} label={t("cyber.dashboard.overdueVulns")} value={overdueVulns} toneClass={overdueVulns > 0 ? "text-red-500" : undefined} />
        <IconStatCard theme={theme} icon={<ClipboardIcon />} label={t("cyber.dashboard.nonCompliantPolicies")} value={data.compliance.nonCompliantPolicies} toneClass={data.compliance.nonCompliantPolicies > 0 ? "text-amber-500" : undefined} />
        <IconStatCard theme={theme} icon={<ClipboardIcon />} label={t("cyber.dashboard.openFindings")} value={data.compliance.openFindings} />
      </div>

      {data.trend.length > 1 && (
        <div className={`${theme.panel} p-6`}>
          <div className={`text-sm font-semibold mb-5 ${theme.text}`}>{t("cyber.dashboard.trendChart")}</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend}>
                <defs>
                  <linearGradient id="cyberScoreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d9a441" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#d9a441" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <Area type="monotone" dataKey="score" stroke="#d9a441" strokeWidth={2.5} fill="url(#cyberScoreFill)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.scoreBreakdown.length > 0 && (
        <div className={`${theme.panel} p-6`}>
          <div className={`text-sm font-semibold mb-4 ${theme.text}`}>{t("cyber.dashboard.scoreBreakdown")}</div>
          <div className="space-y-2">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`${theme.panel} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-sm font-semibold ${theme.text}`}>{t("cyber.dashboard.recentAlerts")}</span>
            <button className={`text-[10px] ${theme.subtext} hover:text-hazard-500`} onClick={() => onNavigate("incidents")}>
              {t("cyber.dashboard.viewAll")}
            </button>
          </div>
          <div className="space-y-2.5">
            {data.recentAlerts.length === 0 && <div className={`text-xs ${theme.mutedText}`}>{t("cyber.dashboard.noActiveAlerts")}</div>}
            {data.recentAlerts.map((a) => (
              <div key={a.id} className={`flex items-center justify-between gap-2 text-xs border-t ${theme.rowBorder} pt-2.5 first:border-t-0 first:pt-0`}>
                <span className={`${theme.text} truncate`}>{a.title}</span>
                <SeverityPill severity={a.severity} />
              </div>
            ))}
          </div>
        </div>
        <div className={`${theme.panel} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-sm font-semibold ${theme.text}`}>{t("cyber.dashboard.recentIncidents")}</span>
            <button className={`text-[10px] ${theme.subtext} hover:text-hazard-500`} onClick={() => onNavigate("incidents")}>
              {t("cyber.dashboard.viewAll")}
            </button>
          </div>
          <div className="space-y-2.5">
            {data.recentIncidents.length === 0 && <div className={`text-xs ${theme.mutedText}`}>{t("cyber.dashboard.noActiveIncidents")}</div>}
            {data.recentIncidents.map((i) => (
              <div key={i.id} className={`flex items-center justify-between gap-2 text-xs border-t ${theme.rowBorder} pt-2.5 first:border-t-0 first:pt-0`}>
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
