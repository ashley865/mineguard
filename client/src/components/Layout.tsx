import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useAssignedSiteIds } from "../hooks/useAssignedSiteIds";
import { api, API_URL } from "../api/client";
import { Mine } from "../api/types";
import { isModuleAllowed } from "../lib/executiveAccess";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationBell from "./NotificationBell";
import MessagesBell from "./MessagesBell";

export default function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { siteIds: assignedSiteIds } = useAssignedSiteIds();
  const [mine, setMine] = useState<Mine | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const navItems = [
    ...(user?.role === "EXECUTIVE"
      ? [{ to: "/", label: t("nav.executiveDashboard"), end: true }]
      : [{ to: "/", label: t("nav.dashboard"), end: true }]),
    { to: "/sites", label: t("nav.sitesZones") },
    { to: "/sensors", label: t("nav.sensors") },
    { to: "/alerts", label: t("nav.alerts") },
    { to: "/workers", label: t("nav.workers") },
    { to: "/workforce", label: t("workforce.nav") },
    { to: "/contractors", label: t("contractors.nav") },
    { to: "/trucks", label: t("trucks.nav") },
    { to: "/incidents", label: t("nav.incidents") },
    { to: "/equipment", label: t("nav.equipment") },
    { to: "/compliance", label: t("compliance.nav") },
    { to: "/permits", label: t("permits.nav") },
    { to: "/documents", label: t("documents.nav") },
    { to: "/inspection", label: t("inspection.nav") },
    { to: "/reporting", label: t("reporting.nav") },
    { to: "/marketplace", label: t("marketplace.nav") },
    ...(canSeeExecutiveOps
      ? [
          { to: "/visitors", label: t("visitors.nav") },
          { to: "/permits-to-work", label: t("permitToWork.nav") },
        ]
      : []),
    ...(canUseScanner ? [{ to: "/scanner", label: t("scanner.nav") }] : []),
    ...(canMessage ? [{ to: "/messages", label: t("messages.nav") }] : []),
    { to: "/settings", label: t("settings.nav") },
  ].filter((item) => isModuleAllowed(user?.role, user?.title, item.to));

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
              <span className="text-lg">⛏</span>
            )}
            <div className="text-lg font-bold tracking-tight text-white truncate">{mine?.name || "Mine Guard"}</div>
          </div>
          <div className="text-xs text-mine-600 mt-0.5">Safety Monitoring</div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block pl-3 pr-3 py-2 rounded-lg text-sm font-medium border-l-[3px] transition-colors ${
                  isActive
                    ? "bg-mine-800 border-hazard-500 text-mine-50"
                    : "border-transparent text-mine-300 hover:bg-mine-800/60 hover:text-mine-50"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-mine-800 space-y-3">
          <LanguageSwitcher className="w-full" />
          <div>
            <div className="text-sm font-medium">{user?.name}</div>
            <div className="text-xs text-mine-400">
              {user?.title ? t(`settings.invites.titles.${user.title}`) : user?.role}
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
        <header className="h-14 shrink-0 border-b border-mine-800 bg-mine-900/80 backdrop-blur flex items-center gap-3 px-4 md:px-6 print:hidden">
          <button
            aria-label="Open menu"
            className="md:hidden p-2 -ml-2 rounded-lg text-mine-50 hover:bg-mine-800"
            onClick={() => setMobileOpen(true)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>
          <div className="md:hidden flex-1 font-semibold text-sm truncate">{mine?.name || "Mine Guard"}</div>
          <div className="hidden md:flex items-center gap-1.5 text-xs text-mine-400">
            <span>{t("nav.signedInAs")}</span>
            <span className="font-semibold text-mine-100">
              {user?.title ? t(`settings.invites.titles.${user.title}`) : user?.role}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {canMessage && <MessagesBell />}
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 bg-mine-950 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
