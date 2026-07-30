import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useAssignedSiteIds } from "../hooks/useAssignedSiteIds";
import { api, API_URL } from "../api/client";
import { Mine } from "../api/types";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationBell from "./NotificationBell";

export default function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { siteIds: assignedSiteIds } = useAssignedSiteIds();
  const [mine, setMine] = useState<Mine | null>(null);

  useEffect(() => {
    api
      .get<Mine>("/mines/mine")
      .then((res) => setMine(res.data))
      .catch(() => {});
  }, []);

  const isAdmin = user?.role === "ADMIN";
  const isExecutiveWithSites = user?.role === "EXECUTIVE" && (assignedSiteIds?.length ?? 0) > 0;
  const canSeeExecutiveOps = isAdmin || isExecutiveWithSites;

  const dotColors = [
    "bg-sky-500",
    "bg-violet-500",
    "bg-rose-500",
    "bg-teal-500",
    "bg-amber-500",
    "bg-fuchsia-500",
    "bg-lime-500",
    "bg-cyan-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-emerald-500",
    "bg-indigo-500",
    "bg-red-500",
    "bg-purple-500",
    "bg-blue-500",
  ];

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
    ...(canSeeExecutiveOps
      ? [
          { to: "/visitors", label: t("visitors.nav") },
          { to: "/permits-to-work", label: t("permitToWork.nav") },
        ]
      : []),
    { to: "/settings", label: t("settings.nav") },
  ].map((item, i) => ({ ...item, dot: dotColors[i % dotColors.length] }));

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-mine-900 border-r border-mine-800 shadow-lg shadow-black/10 flex flex-col print:hidden">
        <div className="px-5 py-5 border-b border-mine-800 bg-gradient-to-r from-brand-600 via-violet-600 to-fuchsia-600">
          <div className="flex items-center gap-2">
            {mine?.hasLogo ? (
              <img
                src={`${API_URL}/api/mines/${mine.id}/logo`}
                alt={mine.name}
                className="w-7 h-7 rounded object-contain bg-white/90 p-0.5 shrink-0"
              />
            ) : (
              <span className="text-lg">⛏</span>
            )}
            <div className="text-lg font-bold tracking-tight text-white truncate">{mine?.name || "Mine Guard"}</div>
          </div>
          <div className="text-xs text-white/80 mt-0.5">Safety Monitoring</div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-lg text-sm font-medium border-l-[3px] transition-colors ${
                  isActive
                    ? "bg-mine-800 border-brand-500 text-mine-50"
                    : "border-transparent text-mine-200 hover:bg-mine-800/60 hover:text-mine-50"
                }`
              }
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dot}`} />
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
