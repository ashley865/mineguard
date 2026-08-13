import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { ExecutiveInvite, ExecutiveTitle } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";

const executiveTitles: ExecutiveTitle[] = [
  "GENERAL_MANAGER",
  "CFO",
  "COO",
  "HR_MANAGER",
  "SECURITY_MANAGER",
  "SAFETY_MANAGER",
  "OPERATIONS_MANAGER",
  "COMPLIANCE_OFFICER",
  "IT_MANAGER",
];

export default function InvitesTab() {
  const { t } = useTranslation();
  const [invites, setInvites] = useState<ExecutiveInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState<ExecutiveTitle>("GENERAL_MANAGER");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ invite: ExecutiveInvite; key: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<ExecutiveInvite[]>("/executive-invites");
    setInvites(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await api.post<{ invite: ExecutiveInvite; key: string }>("/executive-invites", { name, email, title });
      setResult(res.data);
      setName("");
      setEmail("");
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("settings.invites.createError"));
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm(t("settings.invites.confirmRevoke"))) return;
    await api.post(`/executive-invites/${id}/revoke`);
    await load();
  }

  function inviteLink(inviteId: string, key: string) {
    return `${window.location.origin}/join-executive/${inviteId}?key=${key}`;
  }

  function copyLink() {
    if (!result) return;
    navigator.clipboard.writeText(inviteLink(result.invite.id, result.key));
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function copyKey() {
    if (!result) return;
    navigator.clipboard.writeText(result.key);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className={`${cardClass} p-5 space-y-4 max-w-lg`}>
        <h2 className="text-sm font-semibold">{t("settings.invites.newTitle")}</h2>
        <p className="text-xs text-mine-400">{t("settings.invites.newHint")}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t("settings.invites.name")}</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>{t("settings.invites.email")}</label>
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className={labelClass}>{t("settings.invites.titleField")}</label>
          <select className={selectClass} value={title} onChange={(e) => setTitle(e.target.value as ExecutiveTitle)}>
            {executiveTitles.map((ti) => (
              <option key={ti} value={ti}>{t(`settings.invites.titles.${ti}`)}</option>
            ))}
          </select>
        </div>
        {error && <div className="text-danger-500 text-xs">{error}</div>}
        <button type="submit" className={buttonPrimary} disabled={creating}>
          {creating ? t("common.saving") : t("settings.invites.create")}
        </button>
      </form>

      {result && (
        <div className={`${cardClass} p-5 space-y-3 max-w-lg border-success-500/40`}>
          <h2 className="text-sm font-semibold text-success-500">{t("settings.invites.createdTitle", { name: result.invite.name })}</h2>
          <div>
            <label className={labelClass}>{t("settings.invites.linkLabel")}</label>
            <div className="flex gap-2">
              <input readOnly className={`${inputClass} font-mono text-xs`} value={inviteLink(result.invite.id, result.key)} onFocus={(e) => e.target.select()} />
              <button type="button" className={buttonSecondary} onClick={copyLink}>
                {linkCopied ? t("registerMine.copied") : t("registerMine.copy")}
              </button>
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("settings.invites.keyLabel")}</label>
            <div className="flex gap-2">
              <input readOnly className={`${inputClass} font-mono text-xs`} value={result.key} onFocus={(e) => e.target.select()} />
              <button type="button" className={buttonSecondary} onClick={copyKey}>
                {keyCopied ? t("registerMine.copied") : t("registerMine.copy")}
              </button>
            </div>
          </div>
          <div className="text-xs text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-md p-3">
            {t("settings.invites.keyWarning")}
          </div>
        </div>
      )}

      {!loading && (
        <>
          <SummaryCards
            cards={[
              { label: t("settings.invites.summaryPending"), value: invites.filter((i) => i.status === "PENDING").length },
              { label: t("settings.invites.summaryAccepted"), value: invites.filter((i) => i.status === "ACCEPTED").length, tone: "success" },
            ]}
          />
          <DataTable
            columns={
              [
                { key: "name", header: t("settings.invites.name"), render: (inv) => <span className="font-medium">{inv.name}</span>, sortValue: (inv) => inv.name },
                { key: "email", header: t("settings.invites.email"), render: (inv) => inv.email, sortValue: (inv) => inv.email },
                { key: "title", header: t("settings.invites.titleField"), render: (inv) => t(`settings.invites.titles.${inv.title}`), sortValue: (inv) => inv.title },
                { key: "status", header: t("common.status"), render: (inv) => <StatusBadge status={inv.status} />, sortValue: (inv) => inv.status },
                { key: "invitedBy", header: t("settings.invites.invitedBy"), render: (inv) => inv.invitedBy?.name ?? "—", sortValue: (inv) => inv.invitedBy?.name ?? "" },
              ] as DataTableColumn<ExecutiveInvite>[]
            }
            rows={invites}
            rowKey={(inv) => inv.id}
            emptyMessage={t("settings.invites.noneYet")}
            searchValue={(inv) => `${inv.name} ${inv.email}`}
            actions={(inv) => (
              <div className="flex justify-end gap-2">
                <AuditHistoryButton entityType="ExecutiveInvite" entityId={inv.id} />
                {inv.status === "PENDING" && (
                  <button className={buttonDanger} onClick={() => revoke(inv.id)}>
                    {t("settings.invites.revoke")}
                  </button>
                )}
              </div>
            )}
          />
        </>
      )}
    </div>
  );
}
