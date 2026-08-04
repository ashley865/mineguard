import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import ProfileTab from "./settings/ProfileTab";
import MineDetailsTab from "./settings/MineDetailsTab";
import ExecutiveAccessTab from "./settings/ExecutiveAccessTab";
import InvitesTab from "./settings/InvitesTab";
import TeamTab from "./settings/TeamTab";
import { buttonPrimary, buttonSecondary } from "../components/ui";

type TabKey = "profile" | "mine" | "access" | "invites" | "team";

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const isAdminOrExec = isAdmin || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<TabKey>("profile");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "profile", label: t("settings.tabProfile") },
    ...(isAdmin
      ? [
          { key: "mine" as TabKey, label: t("settings.tabMine") },
          { key: "access" as TabKey, label: t("settings.tabAccess") },
          { key: "invites" as TabKey, label: t("settings.tabInvites") },
        ]
      : []),
    ...(isAdminOrExec ? [{ key: "team" as TabKey, label: t("settings.tabTeam") }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("settings.title")}</h1>
        <p className="text-mine-300 text-sm">{t("settings.subtitle")}</p>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              className={tab === tb.key ? buttonPrimary : buttonSecondary}
              onClick={() => setTab(tb.key)}
            >
              {tb.label}
            </button>
          ))}
        </div>
      )}

      {tab === "profile" && <ProfileTab />}
      {tab === "mine" && isAdmin && <MineDetailsTab />}
      {tab === "access" && isAdmin && <ExecutiveAccessTab />}
      {tab === "invites" && isAdmin && <InvitesTab />}
      {tab === "team" && isAdminOrExec && <TeamTab />}
    </div>
  );
}
