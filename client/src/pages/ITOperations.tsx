import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  ITAsset, ITAssetStatus, ITAssetType, ITTicket, ITTicketPriority, ITTicketStatus,
  ITSoftwareLicense, ITBillingCycle, ITLicenseStatus,
  ITBackupRecord, ITBackupRunStatus, ITDrTestResult,
  ITSecurityIncident, ITIncidentType, ITIncidentSeverity, ITIncidentStatus,
  ITChangeRequest, ITChangeType, ITChangeRisk, ITChangeStatus,
  ITVendorContract, ITVendorContractStatus,
  ITAccessRequest, ITAccessRequestType, ITAccessRequestStatus,
} from "../api/types";
import { StatusBadge, SeverityBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import LoadError from "../components/LoadError";
import DataTable, { DataTableColumn } from "../components/DataTable";
import SummaryCards from "../components/SummaryCards";
import { AuditHistoryButton } from "../components/AuditHistoryPanel";

const assetTypes: ITAssetType[] = ["COMPUTER", "SERVER", "NETWORK_DEVICE", "MOBILE_DEVICE", "SOFTWARE_LICENSE", "PERIPHERAL", "OTHER"];
const assetStatuses: ITAssetStatus[] = ["ACTIVE", "IN_REPAIR", "RETIRED", "LOST"];
const ticketPriorities: ITTicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const PRIORITY_COLORS: Record<ITTicketPriority, string> = {
  LOW: "bg-mine-600 text-mine-100",
  MEDIUM: "bg-hazard-500 text-white",
  HIGH: "bg-danger-400 text-white",
  URGENT: "bg-danger-600 text-white animate-pulse",
};

function AssetForm({ onSubmit, onCancel }: { onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [assetTag, setAssetTag] = useState("");
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<ITAssetType>("COMPUTER");
  const [status, setStatus] = useState<ITAssetStatus>("ACTIVE");
  const [assignedToName, setAssignedToName] = useState("");
  const [location, setLocation] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        assetTag, name, assetType, status,
        assignedToName: assignedToName || undefined,
        location: location || undefined,
        warrantyExpiry: warrantyExpiry || undefined,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.assetTag")}</label>
          <input className={inputClass} value={assetTag} onChange={(e) => setAssetTag(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.assetName")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.assetType")}</label>
          <select className={selectClass} value={assetType} onChange={(e) => setAssetType(e.target.value as ITAssetType)}>
            {assetTypes.map((tp) => <option key={tp} value={tp}>{t(`itOperations.assetTypes.${tp}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ITAssetStatus)}>
            {assetStatuses.map((s) => <option key={s} value={s}>{t(`itOperations.assetStatuses.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.assignedToName")}</label>
          <input className={inputClass} value={assignedToName} onChange={(e) => setAssignedToName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.location")}</label>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("itOperations.warrantyExpiry")}</label>
        <DateField value={warrantyExpiry} onChange={setWarrantyExpiry} />
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function TicketForm({ onSubmit, onCancel }: { onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ITTicketPriority>("MEDIUM");
  const [reportedByName, setReportedByName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ subject, description, priority, reportedByName: reportedByName || undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("itOperations.ticketSubject")}</label>
        <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.priority")}</label>
          <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value as ITTicketPriority)}>
            {ticketPriorities.map((p) => <option key={p} value={p}>{t(`itOperations.priorities.${p}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.reportedByName")}</label>
          <input className={inputClass} value={reportedByName} onChange={(e) => setReportedByName(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function AssetsTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<ITAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ITAsset[]>("/it-assets");
      setAssets(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/it-assets", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("itOperations.confirmDeleteAsset"))) return;
    await api.delete(`/it-assets/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("itOperations.newAsset")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("itOperations.assetTag")}</th>
              <th className="text-left px-4 py-2">{t("itOperations.assetName")}</th>
              <th className="text-left px-4 py-2">{t("itOperations.assetType")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="text-left px-4 py-2">{t("itOperations.assignedToName")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{a.assetTag}</td>
                <td className="px-4 py-2 text-mine-300">{a.name}</td>
                <td className="px-4 py-2 text-mine-300">{t(`itOperations.assetTypes.${a.assetType}`)}</td>
                <td className="px-4 py-2"><StatusBadge status={a.status} /></td>
                <td className="px-4 py-2 text-mine-300">{a.assignedToName ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(a.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {assets.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("itOperations.noneYetAssets")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("itOperations.newAssetTitle")} onClose={() => setModal(false)}>
          <AssetForm onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function TicketsTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<ITTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ITTicket[]>("/it-tickets");
      setTickets(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/it-tickets", data);
    setModal(false);
    await load();
  }

  async function updateStatus(id: string, status: ITTicketStatus) {
    await api.put(`/it-tickets/${id}`, { status });
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("itOperations.confirmDeleteTicket"))) return;
    await api.delete(`/it-tickets/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("itOperations.newTicket")}</button>
        </div>
      )}
      <div className="space-y-3">
        {tickets.map((tk) => (
          <div key={tk.id} className={`${cardClass} p-4 space-y-2`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${PRIORITY_COLORS[tk.priority]}`}>
                    {t(`itOperations.priorities.${tk.priority}`)}
                  </span>
                  <StatusBadge status={tk.status} />
                </div>
                <div className="text-sm font-semibold">{tk.subject}</div>
                {tk.reportedByName && <div className="text-xs text-mine-400 mt-0.5">{t("itOperations.reportedByName")}: {tk.reportedByName}</div>}
              </div>
              {canDelete && <button className={buttonDanger} onClick={() => remove(tk.id)}>{t("common.delete")}</button>}
            </div>
            <p className="text-sm text-mine-200 whitespace-pre-line">{tk.description}</p>
            {canEdit && tk.status !== "CLOSED" && (
              <div className="flex gap-2 border-t border-mine-800 pt-2">
                {tk.status === "OPEN" && (
                  <button className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => updateStatus(tk.id, "IN_PROGRESS")}>{t("itOperations.startProgress")}</button>
                )}
                {tk.status !== "RESOLVED" && (
                  <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => updateStatus(tk.id, "RESOLVED")}>{t("itOperations.markResolved")}</button>
                )}
                <button className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => updateStatus(tk.id, "CLOSED")}>{t("itOperations.markClosed")}</button>
              </div>
            )}
          </div>
        ))}
        {tickets.length === 0 && (
          <div className={`${cardClass} p-6 text-center text-mine-400`}>{t("itOperations.noneYetTickets")}</div>
        )}
      </div>
      {modal && (
        <Modal title={t("itOperations.newTicketTitle")} onClose={() => setModal(false)}>
          <TicketForm onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

const EXPIRY_WINDOW_MS = 1000 * 60 * 60 * 24 * 90;

const billingCycles: ITBillingCycle[] = ["MONTHLY", "ANNUAL", "ONE_TIME", "OTHER"];
const licenseStatuses: ITLicenseStatus[] = ["ACTIVE", "EXPIRED", "CANCELLED"];

function LicenseForm({ initial, onSubmit, onCancel }: { initial?: ITSoftwareLicense; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [productName, setProductName] = useState(initial?.productName ?? "");
  const [vendor, setVendor] = useState(initial?.vendor ?? "");
  const [seatsTotal, setSeatsTotal] = useState(initial?.seatsTotal?.toString() ?? "1");
  const [seatsUsed, setSeatsUsed] = useState(initial?.seatsUsed?.toString() ?? "0");
  const [cost, setCost] = useState(initial?.cost?.toString() ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "ZAR");
  const [billingCycle, setBillingCycle] = useState<ITBillingCycle>(initial?.billingCycle ?? "ANNUAL");
  const [status, setStatus] = useState<ITLicenseStatus>(initial?.status ?? "ACTIVE");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate?.slice(0, 10) ?? "");
  const [renewalDate, setRenewalDate] = useState(initial?.renewalDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        productName, vendor: vendor || undefined,
        seatsTotal: Number(seatsTotal), seatsUsed: Number(seatsUsed),
        cost: cost ? Number(cost) : undefined, currency, billingCycle, status,
        purchaseDate: purchaseDate || undefined, renewalDate: renewalDate || undefined,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.licenses.productName")}</label>
          <input className={inputClass} value={productName} onChange={(e) => setProductName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.licenses.vendor")}</label>
          <input className={inputClass} value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.licenses.seatsTotal")}</label>
          <input className={inputClass} type="number" min="1" value={seatsTotal} onChange={(e) => setSeatsTotal(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.licenses.seatsUsed")}</label>
          <input className={inputClass} type="number" min="0" value={seatsUsed} onChange={(e) => setSeatsUsed(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.licenses.cost")}</label>
          <input className={inputClass} type="number" step="any" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.licenses.billingCycle")}</label>
          <select className={selectClass} value={billingCycle} onChange={(e) => setBillingCycle(e.target.value as ITBillingCycle)}>
            {billingCycles.map((c) => <option key={c} value={c}>{t(`itOperations.licenses.billingCycles.${c}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.licenses.purchaseDate")}</label>
          <DateField value={purchaseDate} onChange={setPurchaseDate} />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.licenses.renewalDate")}</label>
          <DateField value={renewalDate} onChange={setRenewalDate} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ITLicenseStatus)}>
          {licenseStatuses.map((s) => <option key={s} value={s}>{t(`itOperations.licenses.statuses.${s}`)}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function LicensesTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [licenses, setLicenses] = useState<ITSoftwareLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | ITSoftwareLicense>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ITSoftwareLicense[]>("/it-software-licenses");
      setLicenses(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/it-software-licenses", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/it-software-licenses/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("itOperations.licenses.confirmDelete"))) return;
    await api.delete(`/it-software-licenses/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const expiringSoonCount = licenses.filter(
    (l) => l.status === "ACTIVE" && l.renewalDate && new Date(l.renewalDate).getTime() - Date.now() < EXPIRY_WINDOW_MS
  ).length;

  return (
    <div className="space-y-4">
      <SummaryCards cards={[{ label: t("itOperations.licenses.summaryExpiringSoon"), value: expiringSoonCount, tone: expiringSoonCount > 0 ? "hazard" : "default" }]} />
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("itOperations.licenses.new")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "productName", header: t("itOperations.licenses.productName"), render: (l) => l.productName, sortValue: (l) => l.productName },
            { key: "vendor", header: t("itOperations.licenses.vendor"), render: (l) => l.vendor ?? "—" },
            { key: "seats", header: t("itOperations.licenses.seats"), render: (l) => `${l.seatsUsed} / ${l.seatsTotal}`, sortValue: (l) => l.seatsUsed / Math.max(l.seatsTotal, 1) },
            { key: "cost", header: t("itOperations.licenses.cost"), render: (l) => (l.cost != null ? `${l.currency} ${l.cost.toLocaleString()}` : "—"), sortValue: (l) => l.cost ?? 0 },
            { key: "status", header: t("common.status"), render: (l) => <StatusBadge status={l.status} />, sortValue: (l) => l.status },
            { key: "renewal", header: t("itOperations.licenses.renewalDate"), render: (l) => (l.renewalDate ? new Date(l.renewalDate).toLocaleDateString() : "—"), sortValue: (l) => l.renewalDate ?? "" },
          ] as DataTableColumn<ITSoftwareLicense>[]
        }
        rows={licenses}
        rowKey={(l) => l.id}
        emptyMessage={t("itOperations.licenses.noneYet")}
        searchValue={(l) => `${l.productName} ${l.vendor ?? ""}`}
        exportFilename="software-licenses"
        exportColumns={[
          { header: t("itOperations.licenses.productName"), value: (l) => l.productName },
          { header: t("itOperations.licenses.vendor"), value: (l) => l.vendor ?? "" },
          { header: t("itOperations.licenses.seats"), value: (l) => `${l.seatsUsed}/${l.seatsTotal}` },
          { header: t("itOperations.licenses.cost"), value: (l) => l.cost ?? "" },
          { header: t("common.status"), value: (l) => l.status },
          { header: t("itOperations.licenses.renewalDate"), value: (l) => l.renewalDate ?? "" },
        ]}
        actions={(l) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="ITSoftwareLicense" entityId={l.id} />
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(l)}>{t("common.edit")}</button>}
            {canDelete && <button className={buttonDanger} onClick={() => remove(l.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={modal === "create" ? t("itOperations.licenses.newTitle") : t("itOperations.licenses.editTitle")} onClose={() => setModal(null)}>
          <LicenseForm
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

const backupRunStatuses: ITBackupRunStatus[] = ["SUCCESS", "FAILED", "PARTIAL", "NOT_RUN"];
const drTestResults: ITDrTestResult[] = ["PASSED", "FAILED", "NOT_TESTED"];

function BackupForm({ initial, onSubmit, onCancel }: { initial?: ITBackupRecord; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [systemName, setSystemName] = useState(initial?.systemName ?? "");
  const [schedule, setSchedule] = useState(initial?.schedule ?? "");
  const [retentionDays, setRetentionDays] = useState(initial?.retentionDays?.toString() ?? "");
  const [lastRunAt, setLastRunAt] = useState(initial?.lastRunAt?.slice(0, 10) ?? "");
  const [lastRunStatus, setLastRunStatus] = useState<ITBackupRunStatus>(initial?.lastRunStatus ?? "NOT_RUN");
  const [lastDrTestDate, setLastDrTestDate] = useState(initial?.lastDrTestDate?.slice(0, 10) ?? "");
  const [lastDrTestResult, setLastDrTestResult] = useState<ITDrTestResult>(initial?.lastDrTestResult ?? "NOT_TESTED");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        systemName, schedule: schedule || undefined,
        retentionDays: retentionDays ? Number(retentionDays) : undefined,
        lastRunAt: lastRunAt || undefined, lastRunStatus,
        lastDrTestDate: lastDrTestDate || undefined, lastDrTestResult,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.backups.systemName")}</label>
          <input className={inputClass} value={systemName} onChange={(e) => setSystemName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.backups.schedule")}</label>
          <input className={inputClass} value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder={t("itOperations.backups.schedulePlaceholder") ?? ""} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("itOperations.backups.retentionDays")}</label>
        <input className={inputClass} type="number" min="1" value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.backups.lastRunAt")}</label>
          <DateField value={lastRunAt} onChange={setLastRunAt} />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.backups.lastRunStatus")}</label>
          <select className={selectClass} value={lastRunStatus} onChange={(e) => setLastRunStatus(e.target.value as ITBackupRunStatus)}>
            {backupRunStatuses.map((s) => <option key={s} value={s}>{t(`itOperations.backups.runStatuses.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.backups.lastDrTestDate")}</label>
          <DateField value={lastDrTestDate} onChange={setLastDrTestDate} />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.backups.lastDrTestResult")}</label>
          <select className={selectClass} value={lastDrTestResult} onChange={(e) => setLastDrTestResult(e.target.value as ITDrTestResult)}>
            {drTestResults.map((r) => <option key={r} value={r}>{t(`itOperations.backups.drTestResults.${r}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function BackupsTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<ITBackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | ITBackupRecord>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ITBackupRecord[]>("/it-backup-records");
      setRecords(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/it-backup-records", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/it-backup-records/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("itOperations.backups.confirmDelete"))) return;
    await api.delete(`/it-backup-records/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const failedCount = records.filter((r) => r.lastRunStatus === "FAILED").length;
  const notTestedCount = records.filter((r) => r.lastDrTestResult === "NOT_TESTED").length;

  return (
    <div className="space-y-4">
      <SummaryCards
        cards={[
          { label: t("itOperations.backups.summaryFailed"), value: failedCount, tone: failedCount > 0 ? "danger" : "default" },
          { label: t("itOperations.backups.summaryNotTested"), value: notTestedCount, tone: notTestedCount > 0 ? "hazard" : "default" },
        ]}
      />
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("itOperations.backups.new")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "systemName", header: t("itOperations.backups.systemName"), render: (r) => r.systemName, sortValue: (r) => r.systemName },
            { key: "schedule", header: t("itOperations.backups.schedule"), render: (r) => r.schedule ?? "—" },
            { key: "lastRunAt", header: t("itOperations.backups.lastRunAt"), render: (r) => (r.lastRunAt ? new Date(r.lastRunAt).toLocaleDateString() : "—"), sortValue: (r) => r.lastRunAt ?? "" },
            { key: "lastRunStatus", header: t("itOperations.backups.lastRunStatus"), render: (r) => <StatusBadge status={r.lastRunStatus} />, sortValue: (r) => r.lastRunStatus },
            { key: "lastDrTestDate", header: t("itOperations.backups.lastDrTestDate"), render: (r) => (r.lastDrTestDate ? new Date(r.lastDrTestDate).toLocaleDateString() : "—") },
            { key: "lastDrTestResult", header: t("itOperations.backups.lastDrTestResult"), render: (r) => <StatusBadge status={r.lastDrTestResult} />, sortValue: (r) => r.lastDrTestResult },
          ] as DataTableColumn<ITBackupRecord>[]
        }
        rows={records}
        rowKey={(r) => r.id}
        emptyMessage={t("itOperations.backups.noneYet")}
        searchValue={(r) => r.systemName}
        actions={(r) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="ITBackupRecord" entityId={r.id} />
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(r)}>{t("common.edit")}</button>}
            {canDelete && <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={modal === "create" ? t("itOperations.backups.newTitle") : t("itOperations.backups.editTitle")} onClose={() => setModal(null)}>
          <BackupForm
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

const incidentTypes: ITIncidentType[] = ["PHISHING", "MALWARE", "UNAUTHORIZED_ACCESS", "DATA_BREACH", "DENIAL_OF_SERVICE", "VULNERABILITY", "OTHER"];
const incidentSeverities: ITIncidentSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const incidentStatuses: ITIncidentStatus[] = ["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED"];

function IncidentForm({ initial, onSubmit, onCancel }: { initial?: ITSecurityIncident; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [incidentType, setIncidentType] = useState<ITIncidentType>(initial?.incidentType ?? "OTHER");
  const [severity, setSeverity] = useState<ITIncidentSeverity>(initial?.severity ?? "MEDIUM");
  const [status, setStatus] = useState<ITIncidentStatus>(initial?.status ?? "OPEN");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [affectedSystems, setAffectedSystems] = useState(initial?.affectedSystems ?? "");
  const [detectedAt, setDetectedAt] = useState(initial?.detectedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [remediation, setRemediation] = useState(initial?.remediation ?? "");
  const [reportedByName, setReportedByName] = useState(initial?.reportedByName ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        title, incidentType, severity, status, description,
        affectedSystems: affectedSystems || undefined,
        detectedAt: detectedAt || undefined,
        remediation: remediation || undefined,
        reportedByName: reportedByName || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("itOperations.incidents.title")}</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.incidents.incidentType")}</label>
          <select className={selectClass} value={incidentType} onChange={(e) => setIncidentType(e.target.value as ITIncidentType)}>
            {incidentTypes.map((tp) => <option key={tp} value={tp}>{t(`itOperations.incidents.incidentTypes.${tp}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.incidents.severity")}</label>
          <select className={selectClass} value={severity} onChange={(e) => setSeverity(e.target.value as ITIncidentSeverity)}>
            {incidentSeverities.map((s) => <option key={s} value={s}>{t(`badges.severity.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.incidents.affectedSystems")}</label>
          <input className={inputClass} value={affectedSystems} onChange={(e) => setAffectedSystems(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.incidents.detectedAt")}</label>
          <DateField value={detectedAt} onChange={setDetectedAt} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ITIncidentStatus)}>
            {incidentStatuses.map((s) => <option key={s} value={s}>{t(`itOperations.incidents.statuses.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.incidents.reportedByName")}</label>
          <input className={inputClass} value={reportedByName} onChange={(e) => setReportedByName(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("itOperations.incidents.remediation")}</label>
        <textarea className={inputClass} rows={2} value={remediation} onChange={(e) => setRemediation(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function IncidentsTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [incidents, setIncidents] = useState<ITSecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | ITSecurityIncident>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ITSecurityIncident[]>("/it-security-incidents");
      setIncidents(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/it-security-incidents", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/it-security-incidents/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("itOperations.incidents.confirmDelete"))) return;
    await api.delete(`/it-security-incidents/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const openCount = incidents.filter((i) => i.status === "OPEN" || i.status === "INVESTIGATING").length;
  const criticalCount = incidents.filter((i) => i.severity === "CRITICAL" && i.status !== "RESOLVED").length;

  return (
    <div className="space-y-4">
      <SummaryCards
        cards={[
          { label: t("itOperations.incidents.summaryOpen"), value: openCount, tone: openCount > 0 ? "hazard" : "default" },
          { label: t("itOperations.incidents.summaryCritical"), value: criticalCount, tone: criticalCount > 0 ? "danger" : "default" },
        ]}
      />
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("itOperations.incidents.new")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "title", header: t("itOperations.incidents.title"), render: (i) => i.title, sortValue: (i) => i.title },
            { key: "type", header: t("itOperations.incidents.incidentType"), render: (i) => t(`itOperations.incidents.incidentTypes.${i.incidentType}`), sortValue: (i) => i.incidentType },
            { key: "severity", header: t("itOperations.incidents.severity"), render: (i) => <SeverityBadge severity={i.severity} />, sortValue: (i) => i.severity },
            { key: "status", header: t("common.status"), render: (i) => <StatusBadge status={i.status} />, sortValue: (i) => i.status },
            { key: "detectedAt", header: t("itOperations.incidents.detectedAt"), render: (i) => new Date(i.detectedAt).toLocaleDateString(), sortValue: (i) => i.detectedAt },
          ] as DataTableColumn<ITSecurityIncident>[]
        }
        rows={incidents}
        rowKey={(i) => i.id}
        emptyMessage={t("itOperations.incidents.noneYet")}
        searchValue={(i) => `${i.title} ${i.description}`}
        actions={(i) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="ITSecurityIncident" entityId={i.id} />
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(i)}>{t("common.edit")}</button>}
            {canDelete && <button className={buttonDanger} onClick={() => remove(i.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={modal === "create" ? t("itOperations.incidents.newTitle") : t("itOperations.incidents.editTitle")} onClose={() => setModal(null)}>
          <IncidentForm
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

const changeTypes: ITChangeType[] = ["STANDARD", "NORMAL", "EMERGENCY"];
const changeRisks: ITChangeRisk[] = ["LOW", "MEDIUM", "HIGH"];
const changeStatuses: ITChangeStatus[] = ["PLANNED", "APPROVED", "IN_PROGRESS", "COMPLETED", "ROLLED_BACK", "CANCELLED"];

function ChangeForm({ initial, onSubmit, onCancel }: { initial?: ITChangeRequest; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [changeType, setChangeType] = useState<ITChangeType>(initial?.changeType ?? "STANDARD");
  const [systemAffected, setSystemAffected] = useState(initial?.systemAffected ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [riskLevel, setRiskLevel] = useState<ITChangeRisk>(initial?.riskLevel ?? "LOW");
  const [status, setStatus] = useState<ITChangeStatus>(initial?.status ?? "PLANNED");
  const [scheduledDate, setScheduledDate] = useState(initial?.scheduledDate?.slice(0, 10) ?? "");
  const [implementedDate, setImplementedDate] = useState(initial?.implementedDate?.slice(0, 10) ?? "");
  const [rollbackPlan, setRollbackPlan] = useState(initial?.rollbackPlan ?? "");
  const [outcome, setOutcome] = useState(initial?.outcome ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        title, changeType, systemAffected: systemAffected || undefined, description,
        riskLevel, status,
        scheduledDate: scheduledDate || undefined, implementedDate: implementedDate || undefined,
        rollbackPlan: rollbackPlan || undefined, outcome: outcome || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("itOperations.changes.title")}</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.changes.changeType")}</label>
          <select className={selectClass} value={changeType} onChange={(e) => setChangeType(e.target.value as ITChangeType)}>
            {changeTypes.map((ct) => <option key={ct} value={ct}>{t(`itOperations.changes.changeTypes.${ct}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.changes.systemAffected")}</label>
          <input className={inputClass} value={systemAffected} onChange={(e) => setSystemAffected(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.changes.riskLevel")}</label>
          <select className={selectClass} value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as ITChangeRisk)}>
            {changeRisks.map((r) => <option key={r} value={r}>{t(`badges.severity.${r}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ITChangeStatus)}>
            {changeStatuses.map((s) => <option key={s} value={s}>{t(`itOperations.changes.statuses.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.changes.scheduledDate")}</label>
          <DateField value={scheduledDate} onChange={setScheduledDate} />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.changes.implementedDate")}</label>
          <DateField value={implementedDate} onChange={setImplementedDate} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("itOperations.changes.rollbackPlan")}</label>
        <textarea className={inputClass} rows={2} value={rollbackPlan} onChange={(e) => setRollbackPlan(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("itOperations.changes.outcome")}</label>
        <textarea className={inputClass} rows={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function ChangesTab({ canEdit, canApprove, canDelete }: { canEdit: boolean; canApprove: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [changes, setChanges] = useState<ITChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | ITChangeRequest>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ITChangeRequest[]>("/it-change-requests");
      setChanges(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/it-change-requests", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/it-change-requests/${id}`, data);
    setModal(null);
    await load();
  }

  async function approve(id: string) {
    await api.post(`/it-change-requests/${id}/approve`);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("itOperations.changes.confirmDelete"))) return;
    await api.delete(`/it-change-requests/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const plannedCount = changes.filter((c) => c.status === "PLANNED").length;
  const highRiskCount = changes.filter((c) => c.riskLevel === "HIGH" && c.status !== "COMPLETED" && c.status !== "CANCELLED").length;

  return (
    <div className="space-y-4">
      <SummaryCards
        cards={[
          { label: t("itOperations.changes.summaryPlanned"), value: plannedCount, tone: "default" },
          { label: t("itOperations.changes.summaryHighRisk"), value: highRiskCount, tone: highRiskCount > 0 ? "hazard" : "default" },
        ]}
      />
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("itOperations.changes.new")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "title", header: t("itOperations.changes.title"), render: (c) => c.title, sortValue: (c) => c.title },
            { key: "type", header: t("itOperations.changes.changeType"), render: (c) => t(`itOperations.changes.changeTypes.${c.changeType}`), sortValue: (c) => c.changeType },
            { key: "risk", header: t("itOperations.changes.riskLevel"), render: (c) => <SeverityBadge severity={c.riskLevel} />, sortValue: (c) => c.riskLevel },
            { key: "status", header: t("common.status"), render: (c) => <StatusBadge status={c.status} />, sortValue: (c) => c.status },
            { key: "scheduled", header: t("itOperations.changes.scheduledDate"), render: (c) => (c.scheduledDate ? new Date(c.scheduledDate).toLocaleDateString() : "—"), sortValue: (c) => c.scheduledDate ?? "" },
          ] as DataTableColumn<ITChangeRequest>[]
        }
        rows={changes}
        rowKey={(c) => c.id}
        emptyMessage={t("itOperations.changes.noneYet")}
        searchValue={(c) => `${c.title} ${c.systemAffected ?? ""}`}
        actions={(c) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="ITChangeRequest" entityId={c.id} />
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(c)}>{t("common.edit")}</button>}
            {canApprove && c.status === "PLANNED" && (
              <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => approve(c.id)}>{t("common.approve")}</button>
            )}
            {canDelete && <button className={buttonDanger} onClick={() => remove(c.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={modal === "create" ? t("itOperations.changes.newTitle") : t("itOperations.changes.editTitle")} onClose={() => setModal(null)}>
          <ChangeForm
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

const vendorContractStatuses: ITVendorContractStatus[] = ["ACTIVE", "EXPIRED", "CANCELLED"];

function VendorForm({ initial, onSubmit, onCancel }: { initial?: ITVendorContract; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [vendorName, setVendorName] = useState(initial?.vendorName ?? "");
  const [serviceDescription, setServiceDescription] = useState(initial?.serviceDescription ?? "");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [annualCost, setAnnualCost] = useState(initial?.annualCost?.toString() ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "ZAR");
  const [status, setStatus] = useState<ITVendorContractStatus>(initial?.status ?? "ACTIVE");
  const [startDate, setStartDate] = useState(initial?.startDate?.slice(0, 10) ?? "");
  const [renewalDate, setRenewalDate] = useState(initial?.renewalDate?.slice(0, 10) ?? "");
  const [ownerName, setOwnerName] = useState(initial?.ownerName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        vendorName, serviceDescription,
        contactName: contactName || undefined, contactEmail: contactEmail || undefined,
        annualCost: annualCost ? Number(annualCost) : undefined, currency, status,
        startDate: startDate || undefined, renewalDate: renewalDate || undefined,
        ownerName: ownerName || undefined, notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.vendors.vendorName")}</label>
          <input className={inputClass} value={vendorName} onChange={(e) => setVendorName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.vendors.ownerName")}</label>
          <input className={inputClass} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("itOperations.vendors.serviceDescription")}</label>
        <textarea className={inputClass} rows={2} value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.vendors.contactName")}</label>
          <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.vendors.contactEmail")}</label>
          <input className={inputClass} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.vendors.annualCost")}</label>
          <input className={inputClass} type="number" step="any" min="0" value={annualCost} onChange={(e) => setAnnualCost(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ITVendorContractStatus)}>
            {vendorContractStatuses.map((s) => <option key={s} value={s}>{t(`itOperations.vendors.statuses.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.vendors.startDate")}</label>
          <DateField value={startDate} onChange={setStartDate} />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.vendors.renewalDate")}</label>
          <DateField value={renewalDate} onChange={setRenewalDate} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function VendorsTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState<ITVendorContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | ITVendorContract>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ITVendorContract[]>("/it-vendor-contracts");
      setVendors(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/it-vendor-contracts", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/it-vendor-contracts/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("itOperations.vendors.confirmDelete"))) return;
    await api.delete(`/it-vendor-contracts/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const expiringSoonCount = vendors.filter(
    (v) => v.status === "ACTIVE" && v.renewalDate && new Date(v.renewalDate).getTime() - Date.now() < EXPIRY_WINDOW_MS
  ).length;
  const totalAnnualCost = vendors.filter((v) => v.status === "ACTIVE").reduce((sum, v) => sum + (v.annualCost ?? 0), 0);

  return (
    <div className="space-y-4">
      <SummaryCards
        cards={[
          { label: t("itOperations.vendors.summaryExpiringSoon"), value: expiringSoonCount, tone: expiringSoonCount > 0 ? "hazard" : "default" },
          { label: t("itOperations.vendors.summaryTotalAnnualCost"), value: `ZAR ${Math.round(totalAnnualCost).toLocaleString()}`, tone: "default" },
        ]}
      />
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("itOperations.vendors.new")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "vendorName", header: t("itOperations.vendors.vendorName"), render: (v) => v.vendorName, sortValue: (v) => v.vendorName },
            { key: "service", header: t("itOperations.vendors.serviceDescription"), render: (v) => v.serviceDescription },
            { key: "cost", header: t("itOperations.vendors.annualCost"), render: (v) => (v.annualCost != null ? `${v.currency} ${v.annualCost.toLocaleString()}` : "—"), sortValue: (v) => v.annualCost ?? 0 },
            { key: "status", header: t("common.status"), render: (v) => <StatusBadge status={v.status} />, sortValue: (v) => v.status },
            { key: "renewal", header: t("itOperations.vendors.renewalDate"), render: (v) => (v.renewalDate ? new Date(v.renewalDate).toLocaleDateString() : "—"), sortValue: (v) => v.renewalDate ?? "" },
            { key: "owner", header: t("itOperations.vendors.ownerName"), render: (v) => v.ownerName ?? "—" },
          ] as DataTableColumn<ITVendorContract>[]
        }
        rows={vendors}
        rowKey={(v) => v.id}
        emptyMessage={t("itOperations.vendors.noneYet")}
        searchValue={(v) => `${v.vendorName} ${v.serviceDescription}`}
        exportFilename="it-vendor-contracts"
        exportColumns={[
          { header: t("itOperations.vendors.vendorName"), value: (v) => v.vendorName },
          { header: t("itOperations.vendors.serviceDescription"), value: (v) => v.serviceDescription },
          { header: t("itOperations.vendors.annualCost"), value: (v) => v.annualCost ?? "" },
          { header: t("common.status"), value: (v) => v.status },
          { header: t("itOperations.vendors.renewalDate"), value: (v) => v.renewalDate ?? "" },
        ]}
        actions={(v) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="ITVendorContract" entityId={v.id} />
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(v)}>{t("common.edit")}</button>}
            {canDelete && <button className={buttonDanger} onClick={() => remove(v.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={modal === "create" ? t("itOperations.vendors.newTitle") : t("itOperations.vendors.editTitle")} onClose={() => setModal(null)}>
          <VendorForm
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

const accessRequestTypes: ITAccessRequestType[] = ["GRANT", "MODIFY", "REVOKE"];
const accessRequestStatuses: ITAccessRequestStatus[] = ["REQUESTED", "APPROVED", "PROVISIONED", "DENIED", "REVOKED"];

function AccessRequestForm({ initial, onSubmit, onCancel }: { initial?: ITAccessRequest; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [subjectName, setSubjectName] = useState(initial?.subjectName ?? "");
  const [systemName, setSystemName] = useState(initial?.systemName ?? "");
  const [accessLevel, setAccessLevel] = useState(initial?.accessLevel ?? "");
  const [requestType, setRequestType] = useState<ITAccessRequestType>(initial?.requestType ?? "GRANT");
  const [status, setStatus] = useState<ITAccessRequestStatus>(initial?.status ?? "REQUESTED");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ subjectName, systemName, accessLevel: accessLevel || undefined, requestType, status, notes: notes || undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.access.subjectName")}</label>
          <input className={inputClass} value={subjectName} onChange={(e) => setSubjectName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.access.systemName")}</label>
          <input className={inputClass} value={systemName} onChange={(e) => setSystemName(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("itOperations.access.accessLevel")}</label>
          <input className={inputClass} value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("itOperations.access.requestType")}</label>
          <select className={selectClass} value={requestType} onChange={(e) => setRequestType(e.target.value as ITAccessRequestType)}>
            {accessRequestTypes.map((rt) => <option key={rt} value={rt}>{t(`itOperations.access.requestTypes.${rt}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ITAccessRequestStatus)}>
          {accessRequestStatuses.map((s) => <option key={s} value={s}>{t(`itOperations.access.statuses.${s}`)}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function AccessRequestsTab({ canEdit, canApprove, canDelete }: { canEdit: boolean; canApprove: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<ITAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | ITAccessRequest>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ITAccessRequest[]>("/it-access-requests");
      setRequests(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/it-access-requests", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/it-access-requests/${id}`, data);
    setModal(null);
    await load();
  }

  async function setStatus(id: string, status: ITAccessRequestStatus) {
    await api.put(`/it-access-requests/${id}`, { status });
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("itOperations.access.confirmDelete"))) return;
    await api.delete(`/it-access-requests/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const pendingCount = requests.filter((r) => r.status === "REQUESTED").length;

  return (
    <div className="space-y-4">
      <SummaryCards cards={[{ label: t("itOperations.access.summaryPending"), value: pendingCount, tone: pendingCount > 0 ? "hazard" : "default" }]} />
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("itOperations.access.new")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "subjectName", header: t("itOperations.access.subjectName"), render: (r) => r.subjectName, sortValue: (r) => r.subjectName },
            { key: "systemName", header: t("itOperations.access.systemName"), render: (r) => r.systemName, sortValue: (r) => r.systemName },
            { key: "requestType", header: t("itOperations.access.requestType"), render: (r) => t(`itOperations.access.requestTypes.${r.requestType}`), sortValue: (r) => r.requestType },
            { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} />, sortValue: (r) => r.status },
            { key: "requestedDate", header: t("itOperations.access.requestedDate"), render: (r) => new Date(r.requestedDate).toLocaleDateString(), sortValue: (r) => r.requestedDate },
          ] as DataTableColumn<ITAccessRequest>[]
        }
        rows={requests}
        rowKey={(r) => r.id}
        emptyMessage={t("itOperations.access.noneYet")}
        searchValue={(r) => `${r.subjectName} ${r.systemName}`}
        actions={(r) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="ITAccessRequest" entityId={r.id} />
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(r)}>{t("common.edit")}</button>}
            {canApprove && r.status === "REQUESTED" && (
              <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => setStatus(r.id, "APPROVED")}>{t("common.approve")}</button>
            )}
            {canDelete && <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={modal === "create" ? t("itOperations.access.newTitle") : t("itOperations.access.editTitle")} onClose={() => setModal(null)}>
          <AccessRequestForm
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

type ITOperationsTab = "assets" | "tickets" | "licenses" | "backups" | "incidents" | "changes" | "vendors" | "access";

export default function ITOperations() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canApprove = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<ITOperationsTab>("assets");

  const tabs: { key: ITOperationsTab; label: string }[] = [
    { key: "assets", label: t("itOperations.tabAssets") },
    { key: "tickets", label: t("itOperations.tabTickets") },
    { key: "licenses", label: t("itOperations.tabLicenses") },
    { key: "backups", label: t("itOperations.tabBackups") },
    { key: "incidents", label: t("itOperations.tabIncidents") },
    { key: "changes", label: t("itOperations.tabChanges") },
    { key: "vendors", label: t("itOperations.tabVendors") },
    { key: "access", label: t("itOperations.tabAccess") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("itOperations.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("itOperations.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((tb) => (
          <button key={tb.key} className={tab === tb.key ? buttonPrimary : buttonSecondary} onClick={() => setTab(tb.key)}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "assets" && <AssetsTab canEdit={canEdit} canDelete={canDelete} />}
      {tab === "tickets" && <TicketsTab canEdit={canEdit} canDelete={canDelete} />}
      {tab === "licenses" && <LicensesTab canEdit={canEdit} canDelete={canDelete} />}
      {tab === "backups" && <BackupsTab canEdit={canEdit} canDelete={canDelete} />}
      {tab === "incidents" && <IncidentsTab canEdit={canEdit} canDelete={canDelete} />}
      {tab === "changes" && <ChangesTab canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} />}
      {tab === "vendors" && <VendorsTab canEdit={canEdit} canDelete={canDelete} />}
      {tab === "access" && <AccessRequestsTab canEdit={canEdit} canApprove={canApprove} canDelete={canDelete} />}
    </div>
  );
}
