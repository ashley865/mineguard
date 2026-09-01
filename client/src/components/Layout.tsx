import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ErrorBoundary from "./ErrorBoundary";
import { useAuth } from "../context/AuthContext";
import { useAssignedSiteIds } from "../hooks/useAssignedSiteIds";
import { api, API_URL } from "../api/client";
import { Mine } from "../api/types";
import { isModuleAllowed } from "../lib/executiveAccess";
import { useEvacuation } from "../context/EvacuationContext";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationBell from "./NotificationBell";
import MessagesBell from "./MessagesBell";
import EvacuationSystem from "./EvacuationSystem";
import ClockInOutWidget from "./ClockInOutWidget";
import CallUI from "./CallUI";
import ToastContainer from "./ToastContainer";
import RequestNotificationListener from "./RequestNotificationListener";
import { LogoMark } from "./Logo";

export default function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { siteIds: assignedSiteIds } = useAssignedSiteIds();
  const { active: activeEvacuations } = useEvacuation();
  const [mine, setMine] = useState<Mine | null>(null);
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isEvacuating = activeEvacuations.length > 0;

  useEffect(() => {
    api
      .get<Mine>("/mines/mine")
      .then((res) => setMine(res.data))
      .catch(() => {});
  }, []);

  const isAdmin = user?.role === "ADMIN";
  const isExecutiveWithSites = user?.role === "EXECUTIVE" && (assignedSiteIds?.length ?? 0) > 0;
  const canSeeExecutiveOps = isAdmin || isExecutiveWithSites;
  const canUseScanner = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canMessage = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const canSeeFinancials = isAdmin || ["GENERAL_MANAGER", "CFO", "COO"].includes(user?.title ?? "");
  const canSeeDailyBriefing = isAdmin || ["GENERAL_MANAGER", "COO"].includes(user?.title ?? "");
  const canSeeNarrativeScan = isAdmin || ["SAFETY_MANAGER", "COMPLIANCE_OFFICER", "GENERAL_MANAGER"].includes(user?.title ?? "");
  const canSeeSafetyAssistant = isAdmin || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canSeeCyberCommandCenter = isAdmin || (user?.role === "EXECUTIVE" && user?.title === "IT_MANAGER");

  const pinnedItems = [
    user?.role === "EXECUTIVE"
      ? { to: "/", label: t("nav.executiveDashboard"), end: true }
      : { to: "/", label: t("nav.dashboard"), end: true },
    { to: "/alerts", label: t("nav.alerts") },
    { to: "/incidents", label: t("nav.incidents") },
  ];

  const sections: { key: string; label: string; items: { to: string; label: string }[] }[] = [
    {
      key: "operations",
      label: t("nav.sectionOperations"),
      items: [
        { to: "/sites", label: t("nav.sitesZones") },
        { to: "/sensors", label: t("nav.sensors") },
        { to: "/equipment", label: t("nav.equipment") },
        { to: "/maintenance", label: t("maintenance.nav") },
        { to: "/production", label: t("production.nav") },
        { to: "/geology", label: t("geology.nav") },
        { to: "/shift-handovers", label: t("shiftHandover.nav") },
        { to: "/downtime", label: t("downtime.nav") },
      ],
    },
    {
      key: "safety",
      label: t("nav.sectionSafety"),
      items: [
        { to: "/compliance", label: t("compliance.nav") },
        { to: "/safety-observations", label: t("safetyObservations.nav") },
        { to: "/environmental", label: t("environmental.nav") },
        { to: "/emergency", label: t("emergency.nav") },
        { to: "/permits", label: t("permits.nav") },
        { to: "/inspection", label: t("inspection.nav") },
        { to: "/ground-control", label: t("groundControl.nav") },
        { to: "/ventilation", label: t("ventilation.nav") },
        { to: "/mine-rescue", label: t("mineRescue.nav") },
        { to: "/resources", label: t("resources.nav") },
        { to: "/winders", label: t("winders.nav") },
        { to: "/toolbox-talks", label: t("toolboxTalks.nav") },
        { to: "/regulatory-submissions", label: t("regulatorySubmissions.nav") },
        ...(canSeeNarrativeScan ? [{ to: "/narrative-risk-scanner", label: t("narrativeRiskScanner.nav") }] : []),
        ...(canSeeSafetyAssistant ? [{ to: "/safety-assistant", label: t("safetyAssistant.nav") }] : []),
        { to: "/document-acknowledgements", label: t("documentAcknowledgements.nav") },
      ],
    },
    {
      key: "workforce",
      label: t("nav.sectionWorkforce"),
      items: [
        { to: "/workers", label: t("nav.workers") },
        { to: "/workforce", label: t("workforce.nav") },
        { to: "/payroll", label: t("payroll.nav") },
        { to: "/labour-relations", label: t("labourRelations.nav") },
        { to: "/skills-matrix", label: t("skillsMatrix.nav") },
      ],
    },
    {
      key: "logistics",
      label: t("nav.sectionLogistics"),
      items: [
        { to: "/trucks", label: t("trucks.nav") },
        { to: "/inventory", label: t("inventory.nav") },
      ],
    },
    {
      key: "commercial",
      label: t("nav.sectionCommercial"),
      items: [
        { to: "/contractors", label: t("contractors.nav") },
        { to: "/marketplace", label: t("marketplace.nav") },
        { to: "/tenders", label: t("tenders.nav") },
        { to: "/procurement", label: t("procurement.nav") },
        { to: "/invoices", label: t("invoices.nav") },
        { to: "/expenses", label: t("expenses.nav") },
        { to: "/budget-planning", label: t("budgetPlanning.nav") },
        { to: "/insurance", label: t("insurance.nav") },
        ...(canSeeFinancials ? [{ to: "/cash-flow-forecast", label: t("cashFlowForecast.nav") }] : []),
        ...(canSeeFinancials ? [{ to: "/approvals-inbox", label: t("approvalsInbox.nav") }] : []),
      ],
    },
    {
      key: "reports",
      label: t("nav.sectionReports"),
      items: [
        { to: "/reporting", label: t("reporting.nav") },
        ...(canSeeFinancials ? [{ to: "/financial", label: t("financial.nav") }] : []),
        ...(canSeeDailyBriefing ? [{ to: "/ai-daily-briefing", label: t("aiDailyBriefing.nav") }] : []),
        { to: "/documents", label: t("documents.nav") },
        { to: "/community", label: t("community.nav") },
      ],
    },
    {
      key: "siteOps",
      label: t("nav.sectionSiteOps"),
      items: canSeeExecutiveOps
        ? [
            { to: "/visitors", label: t("visitors.nav") },
            { to: "/permits-to-work", label: t("permitToWork.nav") },
          ]
        : [],
    },
    {
      key: "security",
      label: t("nav.sectionSecurity"),
      items: [
        { to: "/security", label: t("security.nav") },
        { to: "/vetting-records", label: t("vettingTracker.nav") },
      ],
    },
    {
      key: "tools",
      label: t("nav.sectionTools"),
      items: [
        ...(canUseScanner ? [{ to: "/scanner", label: t("scanner.nav") }] : []),
        { to: "/it-operations", label: t("itOperations.nav") },
        ...(canSeeCyberCommandCenter ? [{ to: "/cyber-command-center", label: t("cyber.nav") }] : []),
        ...(canMessage ? [{ to: "/messages", label: t("messages.nav") }] : []),
        ...(canMessage ? [{ to: "/executive-requests", label: t("executiveRequests.nav") }] : []),
      ],
    },
  ];

  const filteredPinned = pinnedItems.filter((item) => isModuleAllowed(user?.role, user?.title, item.to));
  const filteredSections = sections
    .map((s) => ({ ...s, items: s.items.filter((item) => isModuleAllowed(user?.role, user?.title, item.to)) }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="min-h-screen md:flex">
      {mobileOpen && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`w-64 md:w-60 shrink-0 bg-mine-900 border-r border-mine-800 shadow-lg shadow-black/10 flex flex-col print:hidden fixed inset-y-0 left-0 z-40 transform transition-transform md:translate-x-0 md:static ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 border-b border-mine-800 bg-mine-100">
          <div className="flex items-center gap-2">
            {mine?.hasLogo ? (
              <img
                src={`${API_URL}/api/mines/${mine.id}/logo`}
                alt={mine.name}
                className="w-7 h-7 rounded object-contain bg-white p-0.5 shrink-0"
              />
            ) : (
              <LogoMark size={22} dark />
            )}
            <div className="text-lg font-bold tracking-tight text-white truncate">{mine?.name || "Mine Guard"}</div>
          </div>
          <div className="text-xs text-mine-600 mt-0.5">Safety Monitoring</div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {filteredPinned.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block pl-3 pr-3 py-1.5 rounded-lg text-xs font-semibold border-l-[3px] transition-colors ${
                  isActive
                    ? "bg-mine-800 border-hazard-500 text-mine-50"
                    : "border-transparent text-mine-300 hover:bg-mine-800/60 hover:text-mine-50"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}

          {filteredSections.map((section) => (
            <div key={section.key} className="pt-2.5">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-mine-500">
                {section.label}
              </div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `block pl-3 pr-3 py-1.5 rounded-lg text-xs font-medium border-l-[3px] transition-colors ${
                      isActive
                        ? "bg-mine-800 border-hazard-500 text-mine-50"
                        : "border-transparent text-mine-300 hover:bg-mine-800/60 hover:text-mine-50"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}

          <div className="pt-2.5">
            <NavLink
              to="/settings"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block pl-3 pr-3 py-1.5 rounded-lg text-xs font-medium border-l-[3px] transition-colors ${
                  isActive
                    ? "bg-mine-800 border-hazard-500 text-mine-50"
                    : "border-transparent text-mine-300 hover:bg-mine-800/60 hover:text-mine-50"
                }`
              }
            >
              {t("settings.nav")}
            </NavLink>
          </div>
        </nav>
        <div className="px-4 py-4 border-t border-mine-800 space-y-3">
          <LanguageSwitcher className="w-full" />
          <div>
            <div className="text-sm font-medium">{user?.name}</div>
            <div className="text-xs text-mine-400">
              {user?.title ? t(`settings.invites.titles.${user.title}`) : user?.role ? t(`roles.${user.role}`) : ""}
            </div>
            <button
              onClick={logout}
              className="mt-3 w-full text-sm px-3 py-1.5 rounded-lg bg-mine-800 hover:bg-mine-700 border border-mine-700 transition-colors"
            >
              {t("nav.signOut")}
            </button>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className={`h-14 shrink-0 border-b flex items-center gap-3 px-4 md:px-6 lg:px-8 print:hidden ${
            isEvacuating ? "border-black animate-siren-bar text-white" : "border-mine-800 bg-mine-900/80 backdrop-blur"
          }`}
        >
          <button
            aria-label="Open menu"
            className={`md:hidden p-2 -ml-2 rounded-lg hover:bg-black/20 ${isEvacuating ? "text-white" : "text-mine-50 hover:bg-mine-800"}`}
            onClick={() => setMobileOpen(true)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>
          {isEvacuating ? (
            <div className="flex-1 min-w-0 flex items-center gap-2 font-extrabold text-xs sm:text-sm uppercase tracking-wide">
              <span className="text-lg shrink-0">🚨</span>
              <span className="truncate">
                {t("emergency.evacuationActiveTitle")}
                {" — "}
                {activeEvacuations.map((e) => `${e.site?.name ?? ""}: ${e.assemblyPoint}`).join(" · ")}
              </span>
            </div>
          ) : (
            <>
              <div className="md:hidden flex-1 font-semibold text-sm truncate">{mine?.name || "Mine Guard"}</div>
              <div className="hidden md:flex items-center gap-1.5 text-xs text-mine-400">
                <span>{t("nav.signedInAs")}</span>
                <span className="font-semibold text-mine-100">
                  {user?.title ? t(`settings.invites.titles.${user.title}`) : user?.role ? t(`roles.${user.role}`) : ""}
                </span>
              </div>
            </>
          )}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <EvacuationSystem />
            <ClockInOutWidget />
            {canMessage && <MessagesBell />}
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 bg-mine-950 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-5 sm:p-6 lg:p-8">
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <CallUI />
      <ToastContainer />
      <RequestNotificationListener />
    </div>
  );
}
