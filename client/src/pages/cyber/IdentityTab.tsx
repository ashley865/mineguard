import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { CyberAccessThreats, CyberBlockedIp, CyberBuyerThreats, CyberDevice, CyberGlobalBlockedIp, CyberIdentityOverview, CyberPhysicalAccessAlert } from "../../api/types";
import { CyberTheme, StatusPill, cyberButtonDanger, cyberButtonPrimary, cyberButtonSecondary } from "./cyberTheme";
import CyberTable, { CyberTableColumn } from "./CyberTable";
import CyberModal from "./CyberModal";

function StatBlock({ theme, label, value, tone }: { theme: CyberTheme; label: string; value: string | number; tone?: string }) {
  return (
    <div className={`${theme.panel} px-3 py-2.5`}>
      <div className={`text-[10px] uppercase tracking-wide ${theme.mutedText}`}>{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${tone ?? theme.text}`}>{value}</div>
    </div>
  );
}

function BlockIpForm({ theme, onSubmit, onCancel }: { theme: CyberTheme; onSubmit: (data: { ipOrCidr: string; reason?: string }) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [ipOrCidr, setIpOrCidr] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = `block text-xs font-semibold mb-1 ${theme.subtext}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ipOrCidr, reason: reason || undefined });
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("cyber.identity.blockError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className={label}>{t("cyber.identity.ipOrCidr")}</label>
        <input className={theme.input} value={ipOrCidr} onChange={(e) => setIpOrCidr(e.target.value)} placeholder="41.0.0.0/8" required />
        <p className={`text-[10px] mt-1 ${theme.mutedText}`}>{t("cyber.identity.ipOrCidrHint")}</p>
      </div>
      <div>
        <label className={label}>{t("cyber.identity.blockReason")}</label>
        <input className={theme.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("cyber.identity.blockReasonPlaceholder") ?? ""} />
      </div>
      {error && <div className="text-xs text-red-500">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={cyberButtonSecondary(theme)} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={cyberButtonDanger} disabled={saving}>{saving ? t("common.saving") : t("cyber.identity.blockAction")}</button>
      </div>
    </form>
  );
}

export default function IdentityTab({ theme, canEdit }: { theme: CyberTheme; canEdit: boolean }) {
  const { t } = useTranslation();
  const [data, setData] = useState<CyberIdentityOverview | null>(null);
  const [devices, setDevices] = useState<CyberDevice[]>([]);
  const [threats, setThreats] = useState<CyberAccessThreats | null>(null);
  const [blocklist, setBlocklist] = useState<CyberBlockedIp[]>([]);
  const [buyerThreats, setBuyerThreats] = useState<CyberBuyerThreats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [blockModal, setBlockModal] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [overview, deviceList, threatData, blocked, buyerThreatData] = await Promise.all([
        api.get<CyberIdentityOverview>("/cyber-identity/overview"),
        api.get<CyberDevice[]>("/cyber-access-control/devices"),
        api.get<CyberAccessThreats>("/cyber-access-control/threats"),
        api.get<CyberBlockedIp[]>("/cyber-access-control/blocklist"),
        api.get<CyberBuyerThreats>("/cyber-access-control/buyer-threats"),
      ]);
      setData(overview.data);
      setDevices(deviceList.data);
      setThreats(threatData.data);
      setBlocklist(blocked.data);
      setBuyerThreats(buyerThreatData.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function resetMfa(id: string) {
    if (!confirm(t("cyber.identity.confirmMfaReset"))) return;
    setBusyId(id);
    try {
      await api.post(`/cyber-identity/users/${id}/mfa-reset`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function blockIp(data: { ipOrCidr: string; reason?: string }) {
    await api.post("/cyber-access-control/blocklist", data);
    setBlockModal(false);
    await load();
  }

  async function unblockIp(id: string) {
    if (!confirm(t("cyber.identity.confirmUnblock"))) return;
    await api.delete(`/cyber-access-control/blocklist/${id}`);
    await load();
  }

  async function unblockGlobalIp(id: string) {
    if (!confirm(t("cyber.identity.confirmUnblock"))) return;
    await api.delete(`/cyber-access-control/buyer-threats/blocklist/${id}`);
    await load();
  }

  if (loading || !data || !threats || !buyerThreats) return <div className={theme.subtext}>{t("common.loading")}</div>;

  const threatCount =
    threats.bruteForceIps.length + threats.multiAccountIps.length + data.physicalAccessAlerts.length + buyerThreats.bruteForceIps.length;

  const physicalAlertColumns: CyberTableColumn<CyberPhysicalAccessAlert>[] = [
    { key: "person", header: t("cyber.identity.name"), render: (a) => <>{a.personName}{a.company ? <div className={`text-[10px] ${theme.mutedText}`}>{a.company}</div> : null}</>, sortValue: (a) => a.personName },
    { key: "reason", header: t("cyber.identity.blockReason"), render: (a) => a.matchedReason ?? "—" },
    { key: "site", header: t("common.site"), render: (a) => a.site?.name ?? "—" },
    { key: "gate", header: t("accessControl.gateName"), render: (a) => a.gateName ?? "—" },
    { key: "direction", header: t("accessControl.direction"), render: (a) => t(`accessControl.directions.${a.direction}`) },
    { key: "loggedAt", header: t("cyber.identity.occurredAt"), render: (a) => new Date(a.loggedAt).toLocaleString(), sortValue: (a) => a.loggedAt },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <StatBlock theme={theme} label={t("cyber.identity.devicesUsingSoftware")} value={devices.length} />
        <StatBlock theme={theme} label={t("cyber.identity.blockedIps")} value={blocklist.length} />
        <StatBlock theme={theme} label={t("cyber.identity.accessThreats")} value={threatCount} tone={threatCount > 0 ? "text-red-500" : undefined} />
        <StatBlock theme={theme} label={t("cyber.identity.mfaGap")} value={data.mfaGapCount} tone={data.mfaGapCount > 0 ? "text-red-500" : undefined} />
        <StatBlock
          theme={theme}
          label={t("cyber.identity.physicalAlerts")}
          value={data.physicalAccessAlerts.length}
          tone={data.physicalAccessAlerts.length > 0 ? "text-red-500" : undefined}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatBlock theme={theme} label={t("cyber.identity.staffCount")} value={data.totalUsers} />
        <StatBlock theme={theme} label={t("cyber.identity.tabBuyers")} value={data.totalBuyers} />
        <StatBlock theme={theme} label={t("cyber.identity.tabContractors")} value={data.totalContractors} />
        <StatBlock theme={theme} label={t("cyber.identity.tabVisitors")} value={data.totalVisitors} />
      </div>

      <div className="space-y-2">
        <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.identity.tabDevices")}</h3>
        <p className={`text-xs ${theme.mutedText}`}>{t("cyber.identity.devicesHint", { days: 90 })}</p>
        <CyberTable
          theme={theme}
          columns={
            [
              { key: "user", header: t("cyber.identity.name"), render: (d) => <span className={theme.text}>{d.userName}</span>, sortValue: (d) => d.userName },
              { key: "ip", header: t("cyber.identity.ipAddress"), render: (d) => d.ipAddress ?? "—" },
              { key: "device", header: t("cyber.identity.device"), render: (d) => d.deviceLabel },
              { key: "logins", header: t("cyber.identity.loginCount"), render: (d) => d.loginCount, sortValue: (d) => d.loginCount },
              { key: "lastSeen", header: t("cyber.identity.lastSeenAt"), render: (d) => (d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "—"), sortValue: (d) => d.lastSeenAt ?? "" },
              { key: "status", header: t("common.status"), render: (d) => (d.isBlocked ? <StatusPill status="BLOCKED" /> : <StatusPill status="SECURE" />) },
            ] as CyberTableColumn<CyberDevice>[]
          }
          rows={devices}
          rowKey={(d) => `${d.userId ?? "unknown"}-${d.ipAddress ?? "noip"}-${d.deviceLabel}`}
          emptyMessage={t("cyber.identity.noDevices")}
          searchValue={(d) => `${d.userName} ${d.ipAddress ?? ""} ${d.deviceLabel}`}
        />
      </div>

      <div className="space-y-2">
        <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.identity.tabThreats")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className={`${theme.panel} p-3`}>
            <div className={`text-xs font-semibold mb-2 ${theme.text}`}>{t("cyber.identity.bruteForceTitle")}</div>
            {threats.bruteForceIps.length === 0 ? (
              <div className={`text-xs ${theme.mutedText}`}>{t("cyber.identity.noBruteForce")}</div>
            ) : (
              <div className="space-y-1.5">
                {threats.bruteForceIps.map((b) => (
                  <div key={b.ipAddress} className={`flex items-center justify-between text-xs border-t ${theme.rowBorder} pt-1.5 first:border-t-0 first:pt-0`}>
                    <span className={theme.text}>{b.ipAddress}</span>
                    <span className="text-red-500 font-semibold">{t("cyber.identity.failedAttempts", { count: b.failedAttempts })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={`${theme.panel} p-3`}>
            <div className={`text-xs font-semibold mb-2 ${theme.text}`}>{t("cyber.identity.multiAccountTitle")}</div>
            {threats.multiAccountIps.length === 0 ? (
              <div className={`text-xs ${theme.mutedText}`}>{t("cyber.identity.noMultiAccount")}</div>
            ) : (
              <div className="space-y-1.5">
                {threats.multiAccountIps.map((m) => (
                  <div key={m.ipAddress} className={`flex items-center justify-between text-xs border-t ${theme.rowBorder} pt-1.5 first:border-t-0 first:pt-0`}>
                    <span className={theme.text}>{m.ipAddress}</span>
                    <span className="text-amber-500 font-semibold">{t("cyber.identity.distinctAccounts", { count: m.distinctAccounts })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <div className={`text-xs font-semibold ${theme.text}`}>{t("cyber.identity.physicalAlertsTitle")}</div>
          <p className={`text-[11px] ${theme.mutedText}`}>{t("cyber.identity.physicalAlertsHint")}</p>
          <CyberTable
            theme={theme}
            columns={physicalAlertColumns}
            rows={data.physicalAccessAlerts}
            rowKey={(a) => a.id}
            emptyMessage={t("cyber.identity.noPhysicalAlerts")}
            searchValue={(a) => `${a.personName} ${a.company ?? ""} ${a.site?.name ?? ""}`}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.identity.tabBlocklist")}</h3>
          {canEdit && <button className={cyberButtonPrimary} onClick={() => setBlockModal(true)}>{t("cyber.identity.blockNew")}</button>}
        </div>
        <p className={`text-xs ${theme.mutedText}`}>{t("cyber.identity.blocklistHint")}</p>
        <CyberTable
          theme={theme}
          columns={
            [
              { key: "ip", header: t("cyber.identity.ipOrCidr"), render: (b) => <span className={theme.text}>{b.ipOrCidr}</span>, sortValue: (b) => b.ipOrCidr },
              { key: "reason", header: t("cyber.identity.blockReason"), render: (b) => b.reason ?? "—" },
              {
                key: "blockedBy",
                header: t("cyber.identity.blockedBy"),
                render: (b) =>
                  b.autoBlocked ? (
                    <span className="text-amber-500 font-semibold">{t("cyber.identity.autoBlocked")}</span>
                  ) : (
                    b.blockedBy?.name ?? "—"
                  ),
              },
              { key: "createdAt", header: t("cyber.createdAt"), render: (b) => new Date(b.createdAt).toLocaleDateString(), sortValue: (b) => b.createdAt },
            ] as CyberTableColumn<CyberBlockedIp>[]
          }
          rows={blocklist}
          rowKey={(b) => b.id}
          emptyMessage={t("cyber.identity.noneBlocked")}
          actions={canEdit ? (b) => <button className={cyberButtonDanger} onClick={() => unblockIp(b.id)}>{t("cyber.identity.unblock")}</button> : undefined}
        />
      </div>

      <div className="space-y-1">
        <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.identity.tabMarketplaceSecurity")}</h3>
        <p className={`text-xs ${theme.mutedText}`}>{t("cyber.identity.marketplaceSecurityHint")}</p>
      </div>

      <div className="space-y-2">
        <div className={`${theme.panel} p-3`}>
          <div className={`text-xs font-semibold mb-2 ${theme.text}`}>{t("cyber.identity.bruteForceTitle")}</div>
          {buyerThreats.bruteForceIps.length === 0 ? (
            <div className={`text-xs ${theme.mutedText}`}>{t("cyber.identity.noBruteForce")}</div>
          ) : (
            <div className="space-y-1.5">
              {buyerThreats.bruteForceIps.map((b) => (
                <div key={b.ipAddress} className={`flex items-center justify-between text-xs border-t ${theme.rowBorder} pt-1.5 first:border-t-0 first:pt-0`}>
                  <span className={theme.text}>{b.ipAddress}</span>
                  <span className="text-red-500 font-semibold">{t("cyber.identity.failedAttempts", { count: b.failedAttempts })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <CyberTable
          theme={theme}
          columns={
            [
              { key: "ip", header: t("cyber.identity.ipOrCidr"), render: (b) => <span className={theme.text}>{b.ipOrCidr}</span>, sortValue: (b) => b.ipOrCidr },
              { key: "reason", header: t("cyber.identity.blockReason"), render: (b) => b.reason ?? "—" },
              {
                key: "auto",
                header: t("cyber.identity.blockedBy"),
                render: (b) => (b.autoBlocked ? <span className="text-amber-500 font-semibold">{t("cyber.identity.autoBlocked")}</span> : "—"),
              },
              { key: "createdAt", header: t("cyber.createdAt"), render: (b) => new Date(b.createdAt).toLocaleDateString(), sortValue: (b) => b.createdAt },
            ] as CyberTableColumn<CyberGlobalBlockedIp>[]
          }
          rows={buyerThreats.globalBlocklist}
          rowKey={(b) => b.id}
          emptyMessage={t("cyber.identity.noneBlocked")}
          actions={canEdit ? (b) => <button className={cyberButtonDanger} onClick={() => unblockGlobalIp(b.id)}>{t("cyber.identity.unblock")}</button> : undefined}
        />
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
              ? (u) =>
                  u.mfaEnabled ? (
                    <button className={cyberButtonSecondary(theme)} disabled={busyId === u.id} onClick={() => resetMfa(u.id)}>
                      {t("cyber.identity.resetMfa")}
                    </button>
                  ) : (
                    <span className={`text-[10px] ${theme.mutedText}`}>{t("cyber.identity.mfaNotEnrolled")}</span>
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

      <div className="space-y-1">
        <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.identity.tabExternal")}</h3>
        <p className={`text-xs ${theme.mutedText}`}>{t("cyber.identity.externalHint")}</p>
      </div>

      <div className="space-y-2">
        <h4 className={`text-xs font-semibold uppercase tracking-wide ${theme.subtext}`}>{t("cyber.identity.tabBuyers")}</h4>
        <CyberTable
          theme={theme}
          columns={
            [
              { key: "name", header: t("cyber.identity.name"), render: (b) => <span className={theme.text}>{b.legalName}</span>, sortValue: (b) => b.legalName },
              { key: "email", header: t("cyber.identity.email"), render: (b) => b.contactEmail },
              { key: "status", header: t("common.status"), render: (b) => <StatusPill status={b.status} /> },
              { key: "portal", header: t("cyber.identity.portalAccess"), render: (b) => <StatusPill status={b.hasPortalAccess ? "PROTECTED" : "MISSING"} /> },
              { key: "bids", header: t("cyber.identity.bidCount"), render: (b) => b.bidCount, sortValue: (b) => b.bidCount },
              { key: "lastLogin", header: t("cyber.identity.lastLoginAt"), render: (b) => (b.lastLoginAt ? new Date(b.lastLoginAt).toLocaleString() : t("cyber.identity.never")) },
            ] as CyberTableColumn<(typeof data.buyers)[number]>[]
          }
          rows={data.buyers}
          rowKey={(b) => b.id}
          emptyMessage={t("cyber.identity.noBuyers")}
          searchValue={(b) => `${b.legalName} ${b.contactEmail}`}
        />
      </div>

      <div className="space-y-2">
        <h4 className={`text-xs font-semibold uppercase tracking-wide ${theme.subtext}`}>{t("cyber.identity.tabContractors")}</h4>
        <CyberTable
          theme={theme}
          columns={
            [
              { key: "name", header: t("cyber.identity.name"), render: (c) => <span className={theme.text}>{c.companyName}</span>, sortValue: (c) => c.companyName },
              { key: "email", header: t("cyber.identity.email"), render: (c) => c.contactEmail ?? "—" },
              { key: "status", header: t("common.status"), render: (c) => <StatusPill status={c.status} /> },
              { key: "portal", header: t("cyber.identity.portalAccess"), render: (c) => <StatusPill status={c.hasPortalAccess ? "PROTECTED" : "MISSING"} /> },
              { key: "permits", header: t("cyber.identity.permitCount"), render: (c) => c.permitCount, sortValue: (c) => c.permitCount },
              { key: "lastLogin", header: t("cyber.identity.lastLoginAt"), render: (c) => (c.lastLoginAt ? new Date(c.lastLoginAt).toLocaleString() : t("cyber.identity.never")) },
            ] as CyberTableColumn<(typeof data.contractors)[number]>[]
          }
          rows={data.contractors}
          rowKey={(c) => c.id}
          emptyMessage={t("cyber.identity.noContractors")}
          searchValue={(c) => `${c.companyName} ${c.contactEmail ?? ""}`}
        />
      </div>

      <div className="space-y-2">
        <h4 className={`text-xs font-semibold uppercase tracking-wide ${theme.subtext}`}>{t("cyber.identity.tabVisitors")}</h4>
        <CyberTable
          theme={theme}
          columns={
            [
              { key: "name", header: t("cyber.identity.name"), render: (v) => <span className={theme.text}>{v.fullName}</span>, sortValue: (v) => v.fullName },
              { key: "company", header: t("cyber.identity.company"), render: (v) => v.company ?? "—" },
              { key: "host", header: t("cyber.identity.host"), render: (v) => v.hostName },
              { key: "site", header: t("common.site"), render: (v) => v.site?.name ?? "—" },
              { key: "status", header: t("common.status"), render: (v) => <StatusPill status={v.status} /> },
              { key: "scheduled", header: t("cyber.identity.scheduledFor"), render: (v) => new Date(v.scheduledFor).toLocaleString(), sortValue: (v) => v.scheduledFor },
            ] as CyberTableColumn<(typeof data.visitors)[number]>[]
          }
          rows={data.visitors}
          rowKey={(v) => v.id}
          emptyMessage={t("cyber.identity.noVisitors")}
          searchValue={(v) => `${v.fullName} ${v.company ?? ""} ${v.hostName}`}
        />
      </div>

      <div className="space-y-2">
        <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.identity.tabActivity")}</h3>
        <CyberTable
          theme={theme}
          columns={
            [
              {
                key: "user",
                header: t("cyber.identity.name"),
                render: (e) => e.user?.name ?? (e.contractor ? `${e.contractor.companyName} (${t("cyber.identity.contractorLabel")})` : "—"),
              },
              { key: "type", header: t("cyber.identity.eventType"), render: (e) => <StatusPill status={e.eventType === "LOGIN_SUCCESS" ? "PROTECTED" : e.eventType === "BLOCKED" ? "BLOCKED" : "MISSING"} /> },
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

      {blockModal && (
        <CyberModal theme={theme} title={t("cyber.identity.blockNewTitle")} onClose={() => setBlockModal(false)}>
          <BlockIpForm theme={theme} onSubmit={blockIp} onCancel={() => setBlockModal(false)} />
        </CyberModal>
      )}
    </div>
  );
}
