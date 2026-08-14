import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { SecurityAsset, SecurityAssetAssignmentLog, SecurityAssetCondition, SecurityAssetType, Site, Worker } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import DateField from "../../components/DateField";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";

const assetTypes: SecurityAssetType[] = [
  "RADIO", "BATON", "FIREARM", "ALARM_PANEL", "BARRIER", "METAL_DETECTOR", "BODY_CAMERA", "TORCH", "HANDCUFFS", "VEHICLE", "OTHER",
];
const conditions: SecurityAssetCondition[] = ["GOOD", "FAIR", "DAMAGED", "OUT_OF_SERVICE"];

function AssetForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: Partial<SecurityAsset>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [assetTag, setAssetTag] = useState(initial?.assetTag ?? "");
  const [type, setType] = useState<SecurityAssetType>(initial?.type ?? "RADIO");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [serialNumber, setSerialNumber] = useState(initial?.serialNumber ?? "");
  const [nextMaintenanceDue, setNextMaintenanceDue] = useState(initial?.nextMaintenanceDue?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        siteId, assetTag, type, description,
        serialNumber: serialNumber || null,
        nextMaintenanceDue: nextMaintenanceDue || null,
        notes: notes || null,
      });
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("securityAssets.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("securityAssets.assetType")}</label>
          <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as SecurityAssetType)}>
            {assetTypes.map((a) => <option key={a} value={a}>{t(`securityAssets.assetTypes.${a}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("securityAssets.assetTag")}</label>
          <input className={inputClass} value={assetTag} onChange={(e) => setAssetTag(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className={labelClass}>{t("securityAssets.serialNumber")}</label>
          <input className={inputClass} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("securityAssets.nextMaintenanceDue")}</label>
        <DateField value={nextMaintenanceDue} onChange={setNextMaintenanceDue} />
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function AssignForm({ workers, onSubmit, onCancel }: {
  workers: Worker[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ workerId, notes: notes || undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("securityAssets.selectWorker")}</label>
        <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.employeeId})</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("securityAssets.assign")}</button>
      </div>
    </form>
  );
}

function ReturnFromMaintenanceForm({ onSubmit, onCancel }: {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [condition, setCondition] = useState<SecurityAssetCondition>("GOOD");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ condition, notes: notes || undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("securityAssets.condition")}</label>
        <select className={selectClass} value={condition} onChange={(e) => setCondition(e.target.value as SecurityAssetCondition)}>
          {conditions.map((c) => <option key={c} value={c}>{t(`badges.status.${c}`)}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("securityAssets.returnFromMaintenance")}</button>
      </div>
    </form>
  );
}

function LogModal({ asset, onClose }: { asset: SecurityAsset; onClose: () => void }) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<SecurityAssetAssignmentLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<SecurityAssetAssignmentLog[]>(`/security-assets/${asset.id}/logs`).then((res) => {
      setLogs(res.data);
      setLoading(false);
    });
  }, [asset.id]);

  return (
    <Modal title={t("securityAssets.historyTitle", { tag: asset.assetTag })} onClose={onClose}>
      {loading ? (
        <div className="text-mine-300 text-sm">{t("common.loading")}</div>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className={`${cardClass} p-3`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t(`securityAssets.events.${l.eventType}`)}</span>
                <span className="text-[10px] text-mine-400">{new Date(l.eventAt).toLocaleString()}</span>
              </div>
              {l.worker && <p className="text-xs text-mine-300 mt-1">{l.worker.name}</p>}
              {l.notes && <p className="text-xs text-mine-400 mt-1">{l.notes}</p>}
              <p className="text-[10px] text-mine-500 mt-1">{t("securityAssets.colLoggedBy")}: {l.loggedBy?.name ?? "—"}</p>
            </div>
          ))}
          {logs.length === 0 && <p className="text-xs text-mine-400">{t("securityAssets.noHistory")}</p>}
        </div>
      )}
    </Modal>
  );
}

export default function SecurityAssetsTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [assets, setAssets] = useState<SecurityAsset[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState<null | "create" | SecurityAsset>(null);
  const [assignModal, setAssignModal] = useState<SecurityAsset | null>(null);
  const [maintenanceModal, setMaintenanceModal] = useState<SecurityAsset | null>(null);
  const [historyModal, setHistoryModal] = useState<SecurityAsset | null>(null);

  async function load() {
    setLoading(true);
    const [a, w] = await Promise.all([
      api.get<SecurityAsset[]>("/security-assets"),
      api.get<Worker[]>("/workers"),
    ]);
    setAssets(a.data);
    setWorkers(w.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/security-assets", data);
    setCreateModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/security-assets/${id}`, data);
    setCreateModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("securityAssets.confirmDelete"))) return;
    await api.delete(`/security-assets/${id}`);
    await load();
  }

  async function assign(data: any) {
    if (!assignModal) return;
    await api.post(`/security-assets/${assignModal.id}/assign`, data);
    setAssignModal(null);
    await load();
  }

  async function returnAsset(asset: SecurityAsset) {
    if (!confirm(t("securityAssets.confirmReturn"))) return;
    await api.post(`/security-assets/${asset.id}/return`, {});
    await load();
  }

  async function sendForMaintenance(asset: SecurityAsset) {
    if (!confirm(t("securityAssets.confirmSendForMaintenance"))) return;
    await api.post(`/security-assets/${asset.id}/send-for-maintenance`, {});
    await load();
  }

  async function returnFromMaintenance(data: any) {
    if (!maintenanceModal) return;
    await api.post(`/security-assets/${maintenanceModal.id}/return-from-maintenance`, data);
    setMaintenanceModal(null);
    await load();
  }

  async function decommission(asset: SecurityAsset) {
    if (!confirm(t("securityAssets.confirmDecommission"))) return;
    await api.post(`/security-assets/${asset.id}/decommission`, {});
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  const inStoreCount = assets.filter((a) => a.status === "IN_STORE").length;
  const assignedCount = assets.filter((a) => a.status === "ASSIGNED").length;
  const maintenanceCount = assets.filter((a) => a.status === "IN_MAINTENANCE").length;
  const overdueMaintenanceCount = assets.filter((a) => a.nextMaintenanceDue && new Date(a.nextMaintenanceDue) < new Date() && a.status !== "DECOMMISSIONED").length;

  const columns: DataTableColumn<SecurityAsset>[] = [
    { key: "assetTag", header: t("securityAssets.assetTag"), render: (a) => <span className="font-medium">{a.assetTag}</span>, sortValue: (a) => a.assetTag },
    { key: "type", header: t("securityAssets.assetType"), render: (a) => <>{t(`securityAssets.assetTypes.${a.type}`)}<div className="text-[10px] text-mine-400">{a.description}</div></>, sortValue: (a) => a.type },
    { key: "site", header: t("common.site"), render: (a) => a.site?.name ?? "—", sortValue: (a) => a.site?.name ?? "" },
    { key: "holder", header: t("securityAssets.assignedTo"), render: (a) => a.assignedWorker?.name ?? "—" },
    { key: "condition", header: t("securityAssets.condition"), render: (a) => <StatusBadge status={a.condition} /> },
    {
      key: "nextMaintenance",
      header: t("securityAssets.nextMaintenanceDue"),
      render: (a) => a.nextMaintenanceDue ? (
        <span className={new Date(a.nextMaintenanceDue) < new Date() ? "text-danger-500" : ""}>{new Date(a.nextMaintenanceDue).toLocaleDateString()}</span>
      ) : "—",
      sortValue: (a) => a.nextMaintenanceDue ?? "",
    },
    { key: "status", header: t("common.status"), render: (a) => <StatusBadge status={a.status} />, sortValue: (a) => a.status },
  ];

  return (
    <div className="space-y-4">
      <p className="text-mine-300 text-sm">{t("securityAssets.subtitle")}</p>

      <SummaryCards
        cards={[
          { label: t("securityAssets.summaryInStore"), value: inStoreCount },
          { label: t("securityAssets.summaryAssigned"), value: assignedCount, tone: assignedCount > 0 ? "hazard" : "default" },
          { label: t("securityAssets.summaryInMaintenance"), value: maintenanceCount },
          { label: t("securityAssets.summaryOverdueMaintenance"), value: overdueMaintenanceCount, tone: overdueMaintenanceCount > 0 ? "danger" : "default" },
        ]}
      />

      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setCreateModal("create")}>{t("securityAssets.newAsset")}</button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={assets}
        rowKey={(a) => a.id}
        emptyMessage={t("securityAssets.noneYet")}
        searchValue={(a) => `${a.assetTag} ${a.description} ${a.serialNumber ?? ""}`}
        actions={(a) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="SecurityAsset" entityId={a.id} />
            <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setHistoryModal(a)}>{t("securityAssets.history")}</button>
            {canEdit && (
              <>
                <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setCreateModal(a)}>{t("common.edit")}</button>
                {a.status === "IN_STORE" && (
                  <>
                    <button className="text-xs text-hazard-500 hover:text-hazard-400" onClick={() => setAssignModal(a)}>{t("securityAssets.assign")}</button>
                    <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => sendForMaintenance(a)}>{t("securityAssets.sendForMaintenance")}</button>
                  </>
                )}
                {a.status === "ASSIGNED" && (
                  <button className="text-xs text-success-500 hover:text-success-400" onClick={() => returnAsset(a)}>{t("securityAssets.return")}</button>
                )}
                {a.status === "IN_MAINTENANCE" && (
                  <button className="text-xs text-success-500 hover:text-success-400" onClick={() => setMaintenanceModal(a)}>{t("securityAssets.returnFromMaintenance")}</button>
                )}
                {a.status !== "DECOMMISSIONED" && (
                  <button className="text-xs text-danger-500 hover:text-danger-400" onClick={() => decommission(a)}>{t("securityAssets.decommission")}</button>
                )}
                <button className={buttonDanger} onClick={() => remove(a.id)}>{t("common.delete")}</button>
              </>
            )}
          </div>
        )}
      />

      {createModal && (
        <Modal title={createModal === "create" ? t("securityAssets.newAssetTitle") : t("securityAssets.editAssetTitle")} onClose={() => setCreateModal(null)} size="lg">
          <AssetForm
            sites={sites}
            initial={createModal === "create" ? undefined : createModal}
            onSubmit={(data) => (createModal === "create" ? create(data) : update(createModal.id, data))}
            onCancel={() => setCreateModal(null)}
          />
        </Modal>
      )}

      {assignModal && (
        <Modal title={t("securityAssets.assignTitle", { tag: assignModal.assetTag })} onClose={() => setAssignModal(null)}>
          <AssignForm workers={workers} onSubmit={assign} onCancel={() => setAssignModal(null)} />
        </Modal>
      )}

      {maintenanceModal && (
        <Modal title={t("securityAssets.returnFromMaintenanceTitle", { tag: maintenanceModal.assetTag })} onClose={() => setMaintenanceModal(null)}>
          <ReturnFromMaintenanceForm onSubmit={returnFromMaintenance} onCancel={() => setMaintenanceModal(null)} />
        </Modal>
      )}

      {historyModal && <LogModal asset={historyModal} onClose={() => setHistoryModal(null)} />}
    </div>
  );
}
