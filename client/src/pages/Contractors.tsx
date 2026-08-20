import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Contractor, ContractorDocumentType, ContractorStatus, Site } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import EntityDocumentsPanel from "../components/EntityDocumentsPanel";
import PasswordConfirmModal from "../components/PasswordConfirmModal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import LoadError from "../components/LoadError";

const contractorStatuses: ContractorStatus[] = ["ACTIVE", "EXPIRED", "SUSPENDED", "TERMINATED"];
const contractorDocTypes: ContractorDocumentType[] = [
  "INSURANCE_CERTIFICATE",
  "GOOD_STANDING_CERTIFICATE",
  "CONTRACT_AGREEMENT",
  "SAFETY_FILE",
  "OTHER",
];

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
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          <DateField value={contractStartDate} onChange={setContractStartDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("contractors.contractEndDate")}</label>
          <DateField value={contractEndDate} onChange={setContractEndDate} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("contractors.goodStandingExpiry")}</label>
          <DateField value={goodStandingExpiry} onChange={setGoodStandingExpiry} />
        </div>
        <div>
          <label className={labelClass}>{t("contractors.insuranceExpiry")}</label>
          <DateField value={insuranceExpiry} onChange={setInsuranceExpiry} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ContractorStatus)}>
            {contractorStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
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

function ContractorDocumentsModal({ contractor, canUpload, canDelete, onClose, onChanged }: {
  contractor: Contractor;
  canUpload: boolean;
  canDelete: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fileName: string } | null>(null);

  async function upload(file: File, docType: string) {
    const form = new FormData();
    form.append("file", file);
    form.append("docType", docType);
    await api.post(`/contractors/${contractor.id}/documents`, form, { headers: { "Content-Type": "multipart/form-data" } });
    await onChanged();
  }

  async function download(doc: { id: string; fileName: string }) {
    const res = await api.get(`/contractors/${contractor.id}/documents/${doc.id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  async function remove(password: string) {
    if (!deleteTarget) return;
    await api.delete(`/contractors/${contractor.id}/documents/${deleteTarget.id}`, { data: { password } });
    setDeleteTarget(null);
    await onChanged();
  }

  return (
    <>
      <Modal title={t("contractors.documentsTitle", { name: contractor.companyName })} onClose={onClose}>
        <EntityDocumentsPanel
          documents={contractor.documents}
          docTypeOptions={contractorDocTypes}
          docTypeI18nPrefix="documents.categoryLabels.CONTRACTOR"
          onUpload={upload}
          onDownload={download}
          onDelete={canDelete ? (doc) => setDeleteTarget(doc) : undefined}
          canUpload={canUpload}
        />
      </Modal>
      {deleteTarget && (
        <PasswordConfirmModal
          title={t("documents.vault.deleteTitle")}
          hint={t("documents.vault.deleteHint", { name: deleteTarget.fileName })}
          onConfirm={remove}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

export default function Contractors() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Operations Manager can view contractors but must not register, edit, or remove
  // them — that stays with whichever executive title actually owns vendor onboarding.
  const canEdit =
    user?.title !== "OPERATIONS_MANAGER" &&
    (user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE");
  const isAdmin = user?.role === "ADMIN";
  const [items, setItems] = useState<Contractor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [docsContractorId, setDocsContractorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | Contractor>(null);
  const [shareModal, setShareModal] = useState(false);
  const docsContractor = items.find((i) => i.id === docsContractorId) ?? null;

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [c, s] = await Promise.all([api.get<Contractor[]>("/contractors"), api.get<Site[]>("/sites")]);
      setItems(c.data);
      setSites(s.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
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

  async function setPassword(id: string) {
    const password = prompt(t("contractors.setPasswordPrompt") ?? "");
    if (password === null) return;
    if (password.length < 8) {
      alert(t("contractors.setPasswordTooShort"));
      return;
    }
    await api.post(`/contractors/${id}/set-password`, { password });
    alert(t("contractors.setPasswordSuccess"));
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("contractors.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
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
              <th className="text-left px-4 py-2">{t("contractors.colPortal")}</th>
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
                <td className="px-4 py-2 text-xs text-mine-300">
                  {item.hasPortalAccess ? (
                    <span className="text-success-500">{t("contractors.portalActive")}</span>
                  ) : (
                    <span className="text-mine-400">{t("contractors.portalNone")}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setDocsContractorId(item.id)}>
                      {t("contractors.documents", { count: item.documents.length })}
                    </button>
                    {canEdit && (
                      <>
                        <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setPassword(item.id)}>
                          {item.hasPortalAccess ? t("contractors.resetPassword") : t("contractors.setPassword")}
                        </button>
                        <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(item)}>{t("common.edit")}</button>
                        <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-mine-400">{t("contractors.noneYet")}</td></tr>
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

      {docsContractor && (
        <ContractorDocumentsModal
          contractor={docsContractor}
          canUpload={canEdit}
          canDelete={isAdmin}
          onClose={() => setDocsContractorId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
