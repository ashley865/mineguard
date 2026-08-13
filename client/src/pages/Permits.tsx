import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Permit, PermitDocumentType, PermitStatus, PermitType, Site } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import EntityDocumentsPanel from "../components/EntityDocumentsPanel";
import PasswordConfirmModal from "../components/PasswordConfirmModal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import DataTable, { DataTableColumn } from "../components/DataTable";
import SummaryCards from "../components/SummaryCards";
import { AuditHistoryButton } from "../components/AuditHistoryPanel";

const permitDocTypes: PermitDocumentType[] = [
  "PERMIT_CERTIFICATE",
  "RENEWAL_APPROVAL",
  "INSPECTION_REPORT",
  "CORRESPONDENCE",
  "OTHER",
];

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
          <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as PermitType)}>
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
          <DateField value={issueDate} onChange={setIssueDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("permits.expiryDate")}</label>
          <DateField value={expiryDate} onChange={setExpiryDate} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as PermitStatus)}>
            {permitStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
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

function PermitDocumentsModal({ permit, canUpload, canDelete, onClose, onChanged }: {
  permit: Permit;
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
    await api.post(`/permits/${permit.id}/documents`, form, { headers: { "Content-Type": "multipart/form-data" } });
    await onChanged();
  }

  async function download(doc: { id: string; fileName: string }) {
    const res = await api.get(`/permits/${permit.id}/documents/${doc.id}/download`, { responseType: "blob" });
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
    await api.delete(`/permits/${permit.id}/documents/${deleteTarget.id}`, { data: { password } });
    setDeleteTarget(null);
    await onChanged();
  }

  return (
    <>
      <Modal title={t("permits.documentsTitle", { number: permit.permitNumber })} onClose={onClose}>
        <EntityDocumentsPanel
          documents={permit.documents}
          docTypeOptions={permitDocTypes}
          docTypeI18nPrefix="documents.categoryLabels.PERMIT"
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

export default function Permits() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const isAdmin = user?.role === "ADMIN";
  const [items, setItems] = useState<Permit[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | Permit>(null);
  const [docsPermitId, setDocsPermitId] = useState<string | null>(null);
  const docsPermit = items.find((i) => i.id === docsPermitId) ?? null;

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

  const activeCount = items.filter((i) => i.status === "ACTIVE").length;
  const expiringSoonCount = items.filter((i) => i.status === "ACTIVE" && new Date(i.expiryDate).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 90).length;
  const expiredCount = items.filter((i) => i.status === "EXPIRED" || i.status === "SUSPENDED").length;

  const columns: DataTableColumn<Permit>[] = [
    { key: "number", header: t("permits.colNumber"), render: (item) => <span className="font-medium">{item.permitNumber}</span>, sortValue: (item) => item.permitNumber },
    { key: "type", header: t("permits.colType"), render: (item) => t(`permits.types.${item.type}`), sortValue: (item) => item.type },
    { key: "site", header: t("permits.colSite"), render: (item) => item.site?.name ?? "—", sortValue: (item) => item.site?.name ?? "" },
    { key: "expiry", header: t("permits.colExpiry"), render: (item) => new Date(item.expiryDate).toLocaleDateString(), sortValue: (item) => item.expiryDate },
    { key: "status", header: t("permits.colStatus"), render: (item) => <StatusBadge status={item.status} />, sortValue: (item) => item.status },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("permits.title")}</h1>
          <p className="text-mine-300 text-sm">{t("permits.subtitle")}</p>
        </div>
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("permits.new")}</button>
        )}
      </div>

      <SummaryCards
        cards={[
          { label: t("permits.summaryActive"), value: activeCount, tone: "success" },
          { label: t("permits.summaryExpiringSoon"), value: expiringSoonCount, tone: expiringSoonCount > 0 ? "hazard" : "default" },
          { label: t("permits.summaryExpired"), value: expiredCount, tone: expiredCount > 0 ? "danger" : "default" },
        ]}
      />

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(item) => item.id}
        emptyMessage={t("permits.noneYet")}
        searchValue={(item) => `${item.permitNumber} ${item.type} ${item.site?.name ?? ""}`}
        exportFilename="permits"
        exportColumns={[
          { header: t("permits.colNumber"), value: (item) => item.permitNumber },
          { header: t("permits.colType"), value: (item) => item.type },
          { header: t("permits.colSite"), value: (item) => item.site?.name ?? "" },
          { header: t("permits.colExpiry"), value: (item) => item.expiryDate },
          { header: t("permits.colStatus"), value: (item) => item.status },
        ]}
        actions={(item) => (
          <div className="flex justify-end gap-2">
            <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setDocsPermitId(item.id)}>
              {t("permits.documents", { count: item.documents.length })}
            </button>
            <AuditHistoryButton entityType="Permit" entityId={item.id} />
            {canEdit && (
              <>
                <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(item)}>{t("common.edit")}</button>
                <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
              </>
            )}
          </div>
        )}
      />

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

      {docsPermit && (
        <PermitDocumentsModal
          permit={docsPermit}
          canUpload={canEdit}
          canDelete={isAdmin}
          onClose={() => setDocsPermitId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
