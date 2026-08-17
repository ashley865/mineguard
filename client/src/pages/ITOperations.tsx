import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ITAsset, ITAssetStatus, ITAssetType, ITTicket, ITTicketPriority, ITTicketStatus } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import LoadError from "../components/LoadError";

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

export default function ITOperations() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"assets" | "tickets">("assets");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("itOperations.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("itOperations.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className={tab === "assets" ? buttonPrimary : buttonSecondary} onClick={() => setTab("assets")}>
          {t("itOperations.tabAssets")}
        </button>
        <button className={tab === "tickets" ? buttonPrimary : buttonSecondary} onClick={() => setTab("tickets")}>
          {t("itOperations.tabTickets")}
        </button>
      </div>

      {tab === "assets" && <AssetsTab canEdit={canEdit} canDelete={canDelete} />}
      {tab === "tickets" && <TicketsTab canEdit={canEdit} canDelete={canDelete} />}
    </div>
  );
}
