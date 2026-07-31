import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Contractor, ContractorStatus, Site } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

const contractorStatuses: ContractorStatus[] = ["ACTIVE", "EXPIRED", "SUSPENDED", "TERMINATED"];

function ShareRegistrationModal({ sites, onClose }: { sites: Site[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = siteId ? `${window.location.origin}/contractor-register/${siteId}` : "";

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    QRCode.toDataURL(link, { width: 220, margin: 1 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  function copyLink() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal title={t("contractors.shareTitle")} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={inputClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {dataUrl && (
          <div className="flex flex-col items-center gap-2">
            <img src={dataUrl} alt="Contractor registration QR code" className="rounded-md border border-mine-800" />
          </div>
        )}
        <div className="flex gap-2">
          <input readOnly className={`${inputClass} font-mono text-xs`} value={link} onFocus={(e) => e.target.select()} />
          <button type="button" className={buttonSecondary} onClick={copyLink}>
            {copied ? t("registerMine.copied") : t("registerMine.copy")}
          </button>
        </div>
        <p className="text-xs text-mine-400">{t("contractors.shareHint")}</p>
      </div>
    </Modal>
  );
}

function ContractorForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: Contractor;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [companyName, setCompanyName] = useState(initial?.companyName ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(initial?.registrationNumber ?? "");
  const [scopeOfWork, setScopeOfWork] = useState(initial?.scopeOfWork ?? "");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [contractStartDate, setContractStartDate] = useState(initial?.contractStartDate?.slice(0, 10) ?? "");
  const [contractEndDate, setContractEndDate] = useState(initial?.contractEndDate?.slice(0, 10) ?? "");
  const [goodStandingExpiry, setGoodStandingExpiry] = useState(initial?.goodStandingExpiry?.slice(0, 10) ?? "");
  const [insuranceExpiry, setInsuranceExpiry] = useState(initial?.insuranceExpiry?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<ContractorStatus>(initial?.status ?? "ACTIVE");
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        companyName,
        registrationNumber: registrationNumber || undefined,
        scopeOfWork,
        contactName,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
        contractStartDate,
        contractEndDate,
        goodStandingExpiry: goodStandingExpiry || null,
        insuranceExpiry: insuranceExpiry || null,
        status,
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
          <label className={labelClass}>{t("contractors.companyName")}</label>
          <input className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("contractors.registrationNumber")}</label>
          <input className={inputClass} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("contractors.scopeOfWork")}</label>
        <textarea className={inputClass} value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)} rows={2} required />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("contractors.contactName")}</label>
          <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.phone")}</label>
          <input className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("contractors.contactEmail")}</label>
          <input className={inputClass} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("contractors.contractStartDate")}</label>
          <input className={inputClass} type="date" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("contractors.contractEndDate")}</label>
          <input className={inputClass} type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("contractors.goodStandingExpiry")}</label>
          <input className={inputClass} type="date" value={goodStandingExpiry} onChange={(e) => setGoodStandingExpiry(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("contractors.insuranceExpiry")}</label>
          <input className={inputClass} type="date" value={insuranceExpiry} onChange={(e) => setInsuranceExpiry(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ContractorStatus)}>
            {contractorStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={inputClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function Contractors() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<Contractor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | Contractor>(null);
  const [shareModal, setShareModal] = useState(false);

  async function load() {
    setLoading(true);
    const [c, s] = await Promise.all([api.get<Contractor[]>("/contractors"), api.get<Site[]>("/sites")]);
    setItems(c.data);
    setSites(s.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/contractors", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/contractors/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("contractors.confirmDelete"))) return;
    await api.delete(`/contractors/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("contractors.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t("contractors.title")}</h1>
          <p className="text-mine-300 text-sm">{t("contractors.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && sites.length > 0 && (
            <button className={buttonSecondary} onClick={() => setShareModal(true)}>{t("contractors.shareLink")}</button>
          )}
          {canEdit && sites.length > 0 && (
            <button className={buttonPrimary} onClick={() => setModal("create")}>{t("contractors.new")}</button>
          )}
        </div>
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("contractors.colCompany")}</th>
              <th className="text-left px-4 py-2">{t("contractors.colScope")}</th>
              <th className="text-left px-4 py-2">{t("contractors.colSite")}</th>
              <th className="text-left px-4 py-2">{t("contractors.colContractEnd")}</th>
              <th className="text-left px-4 py-2">{t("contractors.colStatus")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{item.companyName}</td>
                <td className="px-4 py-2 text-mine-300">{item.scopeOfWork}</td>
                <td className="px-4 py-2 text-mine-300">{item.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(item.contractEndDate).toLocaleDateString()}</td>
                <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(item)}>{t("common.edit")}</button>
                      <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("contractors.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("contractors.newTitle") : t("contractors.editTitle")} onClose={() => setModal(null)}>
          <ContractorForm
            sites={sites}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {shareModal && <ShareRegistrationModal sites={sites} onClose={() => setShareModal(false)} />}
    </div>
  );
}
