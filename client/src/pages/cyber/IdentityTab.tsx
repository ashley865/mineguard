import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { CyberIdentityOverview } from "../../api/types";
import { CyberTheme, StatusPill, cyberButtonSecondary } from "./cyberTheme";
import CyberTable, { CyberTableColumn } from "./CyberTable";

function StatBlock({ theme, label, value, tone }: { theme: CyberTheme; label: string; value: string | number; tone?: string }) {
  return (
    <div className={`${theme.panel} px-3 py-2.5`}>
      <div className={`text-[10px] uppercase tracking-wide ${theme.mutedText}`}>{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${tone ?? theme.text}`}>{value}</div>
    </div>
  );
}

export default function IdentityTab({ theme, canEdit }: { theme: CyberTheme; canEdit: boolean }) {
  const { t } = useTranslation();
  const [data, setData] = useState<CyberIdentityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<CyberIdentityOverview>("/cyber-identity/overview");
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleMfa(id: string, mfaEnabled: boolean) {
    setBusyId(id);
    try {
      await api.put(`/cyber-identity/users/${id}/mfa`, { mfaEnabled });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !data) return <div className={theme.subtext}>{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatBlock theme={theme} label={t("cyber.identity.totalUsers")} value={data.totalUsers} />
        <StatBlock theme={theme} label={t("cyber.identity.privilegedAccounts")} value={data.privilegedAccounts.length} />
        <StatBlock theme={theme} label={t("cyber.identity.dormantUsers")} value={data.dormantUsers.length} tone={data.dormantUsers.length > 0 ? "text-amber-500" : undefined} />
        <StatBlock theme={theme} label={t("cyber.identity.mfaGap")} value={data.mfaGapCount} tone={data.mfaGapCount > 0 ? "text-red-500" : undefined} />
      </div>

      <p className={`text-[10px] ${theme.mutedText}`}>{t("cyber.identity.mfaDisclaimer")}</p>

      <div className="space-y-2">
        <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.identity.tabPrivileged")}</h3>
        <CyberTable
          theme={theme}
          columns={
            [
              { key: "name", header: t("cyber.identity.name"), render: (u) => <span className={theme.text}>{u.name}</span>, sortValue: (u) => u.name },
              { key: "email", header: t("cyber.identity.email"), render: (u) => u.email },
              { key: "role", header: t("common.role"), render: (u) => t(`roles.${u.role}`) },
              { key: "mfa", header: t("cyber.identity.mfaStatus"), render: (u) => <StatusPill status={u.mfaEnabled ? "PROTECTED" : "MISSING"} /> },
            ] as CyberTableColumn<(typeof data.privilegedAccounts)[number]>[]
          }
          rows={data.privilegedAccounts}
          rowKey={(u) => u.id}
          emptyMessage={t("cyber.identity.noPrivilegedAccounts")}
          actions={
            canEdit
              ? (u) => (
                  <button className={cyberButtonSecondary(theme)} disabled={busyId === u.id} onClick={() => toggleMfa(u.id, !u.mfaEnabled)}>
                    {u.mfaEnabled ? t("cyber.identity.markMfaDisabled") : t("cyber.identity.markMfaEnabled")}
                  </button>
                )
              : undefined
          }
        />
      </div>

      <div className="space-y-2">
        <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.identity.tabDormant")}</h3>
        <CyberTable
          theme={theme}
          columns={
            [
              { key: "name", header: t("cyber.identity.name"), render: (u) => <span className={theme.text}>{u.name}</span>, sortValue: (u) => u.name },
              { key: "email", header: t("cyber.identity.email"), render: (u) => u.email },
              { key: "lastLogin", header: t("cyber.identity.lastLoginAt"), render: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : t("cyber.identity.never")) },
            ] as CyberTableColumn<(typeof data.dormantUsers)[number]>[]
          }
          rows={data.dormantUsers}
          rowKey={(u) => u.id}
          emptyMessage={t("cyber.identity.noDormantUsers")}
        />
      </div>

      <div className="space-y-2">
        <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.identity.tabActivity")}</h3>
        <CyberTable
          theme={theme}
          columns={
            [
              { key: "user", header: t("cyber.identity.name"), render: (e) => e.user?.name ?? "—" },
              { key: "type", header: t("cyber.identity.eventType"), render: (e) => <StatusPill status={e.eventType === "LOGIN_SUCCESS" ? "PROTECTED" : "MISSING"} /> },
              { key: "ip", header: t("cyber.identity.ipAddress"), render: (e) => e.ipAddress ?? "—" },
              { key: "occurred", header: t("cyber.identity.occurredAt"), render: (e) => new Date(e.occurredAt).toLocaleString() },
              { key: "flagged", header: t("cyber.identity.flagged"), render: (e) => (e.flagged ? <StatusPill status="WARNING" /> : "—") },
            ] as CyberTableColumn<(typeof data.recentEvents)[number]>[]
          }
          rows={data.recentEvents}
          rowKey={(e) => e.id}
          emptyMessage={t("cyber.identity.noActivity")}
        />
      </div>
    </div>
  );
}
