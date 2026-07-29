import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import LanguageSwitcher from "./LanguageSwitcher";

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
    { to: "/incidents", label: t("nav.incidents") },
    { to: "/equipment", label: t("nav.equipment") },
    { to: "/compliance", label: t("compliance.nav") },
    { to: "/permits", label: t("permits.nav") },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-mine-900 border-r border-mine-800 flex flex-col">
        <div className="px-5 py-5 border-b border-mine-800">
          <div className="text-lg font-bold tracking-tight">⛏ Mine Guard</div>
          <div className="text-xs text-mine-300 mt-0.5">Safety Monitoring</div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-mine-700 text-white"
                    : "text-mine-200 hover:bg-mine-800 hover:text-white"
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
              className="mt-3 w-full text-sm px-3 py-1.5 rounded-md bg-mine-800 hover:bg-mine-700 transition-colors"
            >
              {t("nav.signOut")}
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 bg-mine-950 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
