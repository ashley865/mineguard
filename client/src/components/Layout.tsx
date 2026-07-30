import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationBell from "./NotificationBell";

export default function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

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
    { to: "/incidents", label: t("nav.incidents") },
    { to: "/equipment", label: t("nav.equipment") },
    { to: "/compliance", label: t("compliance.nav") },
    { to: "/permits", label: t("permits.nav") },
    { to: "/documents", label: t("documents.nav") },
    { to: "/inspection", label: t("inspection.nav") },
    { to: "/reporting", label: t("reporting.nav") },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-mine-900 border-r border-mine-800 shadow-lg shadow-black/10 flex flex-col print:hidden">
        <div className="px-5 py-5 border-b border-mine-800">
          <div className="text-lg font-bold tracking-tight">⛏ Mine Guard</div>
          <div className="text-xs text-mine-300 mt-0.5">Safety Monitoring</div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block pl-3 pr-3 py-2 rounded-lg text-sm font-medium border-l-[3px] transition-colors ${
                  isActive
                    ? "bg-mine-800 border-mine-500 text-mine-50"
                    : "border-transparent text-mine-200 hover:bg-mine-800/60 hover:text-mine-50"
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
            <div className="text-xs text-mine-300">{user?.role}</div>
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
        <header className="h-14 shrink-0 border-b border-mine-800 bg-mine-900/60 backdrop-blur flex items-center justify-end px-6 print:hidden">
          <NotificationBell />
        </header>
        <main className="flex-1 bg-mine-950 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
