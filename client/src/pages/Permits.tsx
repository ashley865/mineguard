import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Permit, PermitStatus, PermitType, Site } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

const permitTypes: PermitType[] = [
  "MINING_RIGHT",
  "MINING_PERMIT",
  "PROSPECTING_RIGHT",
  "WATER_USE_LICENSE",
  "ENVIRONMENTAL_AUTHORISATION",
  "SOCIAL_LABOUR_PLAN",
  "EXPLOSIVES_LICENSE",
  "MINE_WORKS_PROGRAMME",
  "OTHER",
];
const permitStatuses: PermitStatus[] = ["ACTIVE", "PENDING_RENEWAL", "EXPIRED", "SUSPENDED", "WITHDRAWN"];

function PermitForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: Partial<Permit>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [permitNumber, setPermitNumber] = useState(initial?.permitNumber ?? "");
  const [type, setType] = useState<PermitType>(initial?.type ?? "MINING_RIGHT");
  const [issuingAuthority, setIssuingAuthority] = useState(initial?.issuingAuthority ?? "Department of Mineral Resources and Energy (DMRE)");
  const [holderName, setHolderName] = useState(initial?.holderName ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issueDate?.slice(0, 10) ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<PermitStatus>(initial?.status ?? "ACTIVE");
  const [conditions, setConditions] = useState(initial?.conditions ?? "");
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        permitNumber,
        type,
        issuingAuthority,
        holderName,
        issueDate,
        expiryDate,
        status,
        conditions: conditions || undefined,
        siteId,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("permits.permitNumber")}</label>
          <input className={inputClass} value={permitNumber} onChange={(e) => setPermitNumber(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("permits.type")}</label>
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as PermitType)}>
            {permitTypes.map((pt) => <option key={pt} value={pt}>{t(`permits.types.${pt}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("permits.issuingAuthority")}</label>
        <input className={inputClass} value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("permits.holderName")}</label>
        <input className={inputClass} value={holderName} onChange={(e) => setHolderName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("permits.issueDate")}</label>
          <input className={inputClass} type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("permits.expiryDate")}</label>
          <input className={inputClass} type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as PermitStatus)}>
            {permitStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={inputClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("permits.conditions")}</label>
        <textarea className={inputClass} value={conditions} onChange={(e) => setConditions(e.target.value)} rows={2} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function Permits() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<Permit[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | Permit>(null);

  async function load() {
    setLoading(true);
    const [p, s] = await Promise.all([api.get<Permit[]>("/permits"), api.get<Site[]>("/sites")]);
    setItems(p.data);
    setSites(s.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/permits", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/permits/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("permits.confirmDelete"))) return;
    await api.delete(`/permits/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("permits.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t("permits.title")}</h1>
          <p className="text-mine-300 text-sm">{t("permits.subtitle")}</p>
        </div>
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("permits.new")}</button>
        )}
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("permits.colNumber")}</th>
              <th className="text-left px-4 py-2">{t("permits.colType")}</th>
              <th className="text-left px-4 py-2">{t("permits.colSite")}</th>
              <th className="text-left px-4 py-2">{t("permits.colExpiry")}</th>
              <th className="text-left px-4 py-2">{t("permits.colStatus")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{item.permitNumber}</td>
                <td className="px-4 py-2 text-mine-300">{t(`permits.types.${item.type}`)}</td>
                <td className="px-4 py-2 text-mine-300">{item.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(item.expiryDate).toLocaleDateString()}</td>
                <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-white" onClick={() => setModal(item)}>{t("common.edit")}</button>
                      <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("permits.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("permits.newTitle") : t("permits.editTitle")} onClose={() => setModal(null)}>
          <PermitForm
            sites={sites}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
