import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { getCyberTheme } from "./cyber/cyberTheme";
import DashboardTab from "./cyber/DashboardTab";
import EndpointsTab from "./cyber/EndpointsTab";
import NetworkTab from "./cyber/NetworkTab";
import VulnerabilitiesTab from "./cyber/VulnerabilitiesTab";
import IncidentsTab from "./cyber/IncidentsTab";
import ComplianceTab from "./cyber/ComplianceTab";
import IdentityTab from "./cyber/IdentityTab";
import AiAnalystTab from "./cyber/AiAnalystTab";

type CyberTab = "dashboard" | "endpoints" | "identity" | "network" | "vulnerabilities" | "incidents" | "compliance" | "ai";

const THEME_STORAGE_KEY = "mineguard.cyberCommandCenter.dark";

export default function CyberCommandCenter() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  // High-risk approvals (closing a CRITICAL incident, accepting risk on a CRITICAL
  // vulnerability) are additionally restricted to the mine owner or the IT Manager
  // specifically — mirrors requireCyberApprovalAccess on the server.
  const canApprove = user?.role === "ADMIN" || (user?.role === "EXECUTIVE" && user?.title === "IT_MANAGER");

  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored ? stored === "true" : true;
  });
  const [tab, setTab] = useState<CyberTab>("dashboard");
  const theme = getCyberTheme(dark);

  function toggleTheme() {
    setDark((d) => {
      const next = !d;
      localStorage.setItem(THEME_STORAGE_KEY, String(next));
      return next;
    });
  }

  const tabs: { key: CyberTab; label: string }[] = [
    { key: "dashboard", label: t("cyber.tabDashboard") },
    { key: "incidents", label: t("cyber.tabIncidents") },
    { key: "endpoints", label: t("cyber.tabEndpoints") },
    { key: "vulnerabilities", label: t("cyber.tabVulnerabilities") },
    { key: "network", label: t("cyber.tabNetwork") },
    { key: "identity", label: t("cyber.tabIdentity") },
    { key: "compliance", label: t("cyber.tabCompliance") },
    { key: "ai", label: t("cyber.tabAi") },
  ];

  return (
    <div className={`-m-5 sm:-m-6 lg:-m-8 p-5 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] ${theme.page}`}>
      <div className="space-y-5 max-w-[1400px] mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hazard-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-hazard-500" />
              </span>
              <h1 className={`text-lg font-extrabold uppercase tracking-wide ${theme.text}`}>{t("cyber.nav")}</h1>
            </div>
            <p className={`text-xs mt-0.5 ${theme.subtext}`}>{t("cyber.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
              dark ? "border-white/15 text-white/70 hover:bg-white/10" : "border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {dark ? t("cyber.lightMode") : t("cyber.darkMode")}
          </button>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                tab === tb.key
                  ? "bg-hazard-500 text-white"
                  : dark
                  ? "bg-white/5 text-white/60 hover:bg-white/10"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && <DashboardTab theme={theme} onNavigate={(t) => setTab(t as CyberTab)} />}
        {tab === "endpoints" && <EndpointsTab theme={theme} canEdit={canEdit} canDelete={canDelete} />}
        {tab === "network" && <NetworkTab theme={theme} canEdit={canEdit} canDelete={canDelete} />}
        {tab === "vulnerabilities" && <VulnerabilitiesTab theme={theme} canEdit={canEdit} canDelete={canDelete} />}
        {tab === "incidents" && <IncidentsTab theme={theme} canEdit={canEdit} canDelete={canDelete} canApprove={canApprove} />}
        {tab === "compliance" && <ComplianceTab theme={theme} canEdit={canEdit} canDelete={canDelete} />}
        {tab === "identity" && <IdentityTab theme={theme} canEdit={canEdit} />}
        {tab === "ai" && <AiAnalystTab theme={theme} canEdit={canEdit} />}
      </div>
    </div>
  );
}
