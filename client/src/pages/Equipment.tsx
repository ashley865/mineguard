import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AiEquipmentAnalysisResponse, ConsumablePartStatus, ConsumablePartType, Equipment as EquipmentItem, EquipmentConsumablePart, EquipmentStatus, EquipmentType, Site, Worker, Zone } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DataTable, { DataTableColumn } from "../components/DataTable";
import LoadError from "../components/LoadError";

// Only the mobile equipment types that actually consume tyres/GET wear parts.
const TYRE_GET_APPLICABLE_TYPES: EquipmentType[] = ["EXCAVATOR", "HAUL_TRUCK", "LOADER", "DOZER", "GRADER"];
const consumablePartTypes: ConsumablePartType[] = ["TYRE", "GET_BUCKET_TOOTH", "GET_CUTTING_EDGE", "GET_BLADE", "OTHER"];
const consumablePartStatuses: ConsumablePartStatus[] = ["IN_SERVICE", "REMOVED", "SCRAPPED"];

function ConsumablePartForm({ initial, onSubmit, onCancel }: {
  initial?: EquipmentConsumablePart;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [partType, setPartType] = useState<ConsumablePartType>(initial?.partType ?? "TYRE");
  const [position, setPosition] = useState(initial?.position ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [installDate, setInstallDate] = useState(initial?.installDate?.slice(0, 10) ?? "");
  const [cost, setCost] = useState(initial?.cost?.toString() ?? "");
  const [initialMeasurement, setInitialMeasurement] = useState(initial?.initialMeasurement?.toString() ?? "");
  const [currentMeasurement, setCurrentMeasurement] = useState(initial?.currentMeasurement?.toString() ?? "");
  const [measurementUnit, setMeasurementUnit] = useState(initial?.measurementUnit ?? "mm");
  const [status, setStatus] = useState<ConsumablePartStatus>(initial?.status ?? "IN_SERVICE");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        partType,
        position: position || undefined,
        brand: brand || undefined,
        installDate: installDate || null,
        cost: cost ? Number(cost) : null,
        initialMeasurement: initialMeasurement ? Number(initialMeasurement) : null,
        currentMeasurement: currentMeasurement ? Number(currentMeasurement) : null,
        measurementUnit: measurementUnit || undefined,
        status,
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
          <label className={labelClass}>{t("equipment.consumableParts.partType")}</label>
          <select className={selectClass} value={partType} onChange={(e) => setPartType(e.target.value as ConsumablePartType)}>
            {consumablePartTypes.map((pt) => <option key={pt} value={pt}>{t(`equipment.consumableParts.partTypes.${pt}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("equipment.consumableParts.position")}</label>
          <input className={inputClass} value={position} onChange={(e) => setPosition(e.target.value)} placeholder={t("equipment.consumableParts.positionPlaceholder")} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("equipment.consumableParts.brand")}</label>
          <input className={inputClass} value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("equipment.consumableParts.installDate")}</label>
          <input className={inputClass} type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("equipment.consumableParts.initialMeasurement")}</label>
          <input className={inputClass} type="number" step="0.01" value={initialMeasurement} onChange={(e) => setInitialMeasurement(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("equipment.consumableParts.currentMeasurement")}</label>
          <input className={inputClass} type="number" step="0.01" value={currentMeasurement} onChange={(e) => setCurrentMeasurement(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("equipment.consumableParts.measurementUnit")}</label>
          <input className={inputClass} value={measurementUnit} onChange={(e) => setMeasurementUnit(e.target.value)} placeholder="mm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("equipment.consumableParts.cost")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ConsumablePartStatus)}>
            {consumablePartStatuses.map((s) => <option key={s} value={s}>{t(`equipment.consumableParts.statuses.${s}`)}</option>)}
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

function TyreGetModal({ equipment, canEdit, onClose }: { equipment: EquipmentItem; canEdit: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [parts, setParts] = useState<EquipmentConsumablePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formModal, setFormModal] = useState<null | "create" | EquipmentConsumablePart>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<EquipmentConsumablePart[]>(`/equipment/${equipment.id}/consumable-parts`);
      setParts(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(data: any) {
    await api.post(`/equipment/${equipment.id}/consumable-parts`, data);
    setFormModal(null);
    await load();
  }
  async function update(id: string, data: any) {
    await api.put(`/equipment/${equipment.id}/consumable-parts/${id}`, data);
    setFormModal(null);
    await load();
  }
  async function remove(id: string) {
    if (!confirm(t("equipment.consumableParts.confirmDelete"))) return;
    await api.delete(`/equipment/${equipment.id}/consumable-parts/${id}`);
    await load();
  }

  const columns: DataTableColumn<EquipmentConsumablePart>[] = [
    { key: "partType", header: t("equipment.consumableParts.partType"), render: (p) => t(`equipment.consumableParts.partTypes.${p.partType}`), sortValue: (p) => p.partType },
    { key: "position", header: t("equipment.consumableParts.position"), render: (p) => p.position ?? "—", sortValue: (p) => p.position ?? "" },
    { key: "measurement", header: t("equipment.consumableParts.wear"), render: (p) => (p.currentMeasurement != null ? `${p.currentMeasurement}${p.initialMeasurement != null ? ` / ${p.initialMeasurement}` : ""} ${p.measurementUnit ?? ""}` : "—"), sortValue: (p) => p.currentMeasurement ?? 0 },
    { key: "status", header: t("common.status"), render: (p) => <StatusBadge status={p.status} />, sortValue: (p) => p.status },
  ];

  return (
    <Modal title={t("equipment.consumableParts.title", { name: equipment.name })} onClose={onClose}>
      {loading && <div className="text-mine-300">{t("common.loading")}</div>}
      {loadError && <LoadError onRetry={load} />}
      {!loading && !loadError && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {canEdit && <button className={buttonPrimary} onClick={() => setFormModal("create")}>{t("equipment.consumableParts.newPart")}</button>}
          </div>
          <DataTable
            columns={columns}
            rows={parts}
            rowKey={(p) => p.id}
            emptyMessage={t("equipment.consumableParts.noneYet")}
            searchValue={(p) => `${p.partType} ${p.position ?? ""}`}
            actions={(p) => (
              <div className="flex justify-end gap-2">
                {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setFormModal(p)}>{t("common.edit")}</button>}
                {canEdit && <button className={buttonDanger} onClick={() => remove(p.id)}>{t("common.delete")}</button>}
              </div>
            )}
          />
        </div>
      )}
      {formModal && (
        <Modal title={formModal === "create" ? t("equipment.consumableParts.newPartTitle") : t("equipment.consumableParts.editPartTitle")} onClose={() => setFormModal(null)}>
          <ConsumablePartForm
            initial={formModal === "create" ? undefined : formModal}
            onSubmit={(data) => (formModal === "create" ? create(data) : update(formModal.id, data))}
            onCancel={() => setFormModal(null)}
          />
        </Modal>
      )}
    </Modal>
  );
}

function EquipmentAnalysisModal({ equipmentId, onClose }: { equipmentId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [data, setData] = useState<AiEquipmentAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.post<AiEquipmentAnalysisResponse>(`/ai/equipment-analysis/${equipmentId}`);
      setData(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title={t("equipment.aiAnalysis.title")} onClose={onClose}>
      {loading && <div className="text-mine-300">{t("common.loading")}</div>}
      {loadError && <LoadError onRetry={load} />}
      {!loading && data && !data.configured && (
        <div className="text-xs font-medium text-mine-300 bg-mine-800/60 border border-mine-700 rounded-md p-3">
          {t("ai.notConfigured")}
        </div>
      )}
      {!loading && data?.configured && data.noHistory && (
        <div className="text-xs font-medium text-mine-300 bg-mine-800/60 border border-mine-700 rounded-md p-3">
          {t("equipment.aiAnalysis.noHistory")}
        </div>
      )}
      {!loading && data?.configured && !data.noHistory && data.result && (
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-mine-300 mb-2">{t("equipment.aiAnalysis.patterns")}</h3>
            <ul className="space-y-2">
              {data.result.patterns.map((p, i) => (
                <li key={i} className="text-sm">
                  <span className="font-semibold">{p.pattern}</span>
                  <p className="text-xs text-mine-300 mt-0.5">{p.detail}</p>
                </li>
              ))}
              {data.result.patterns.length === 0 && <li className="text-xs text-mine-400">{t("equipment.aiAnalysis.none")}</li>}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-mine-300 mb-2">{t("equipment.aiAnalysis.whatToMonitor")}</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-mine-200">
              {data.result.whatToMonitor.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
          <p className="text-[10px] text-mine-500 border-t border-mine-800 pt-2">{data.disclaimer}</p>
        </div>
      )}
    </Modal>
  );
}

const equipmentTypes: EquipmentType[] = [
  "EXCAVATOR",
  "HAUL_TRUCK",
  "DRILL_RIG",
  "LOADER",
  "DOZER",
  "GRADER",
  "CRUSHER",
  "CONVEYOR",
  "GENERATOR",
  "PUMP",
  "VENTILATION_FAN",
  "COMPRESSOR",
  "WINCH",
  "CRANE",
  "OTHER",
];

function EquipmentForm({ sites, zones, workers, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  workers: Worker[];
  initial?: Partial<EquipmentItem>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<EquipmentType>(initial?.type ?? "EXCAVATOR");
  const [status, setStatus] = useState<EquipmentStatus>(initial?.status ?? "OPERATIONAL");
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [assignedOperatorId, setAssignedOperatorId] = useState(initial?.assignedOperatorId ?? "");
  const [saving, setSaving] = useState(false);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);
  const workersForSite = workers.filter((w) => w.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ name, type, status, siteId, zoneId: zoneId || null, assignedOperatorId: assignedOperatorId || null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.name")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.type")}</label>
          <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as EquipmentType)}>
            {equipmentTypes.map((et) => <option key={et} value={et}>{t(`equipment.types.${et}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); setAssignedOperatorId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">{t("common.unassigned")}</option>
            {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as EquipmentStatus)}>
            <option value="OPERATIONAL">{t("equipment.operational")}</option>
            <option value="MAINTENANCE">{t("equipment.maintenance")}</option>
            <option value="DOWN">{t("equipment.down")}</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("equipment.assignedOperator")}</label>
          <select className={selectClass} value={assignedOperatorId} onChange={(e) => setAssignedOperatorId(e.target.value)}>
            <option value="">{t("common.unassigned")}</option>
            {workersForSite.map((w) => <option key={w.id} value={w.id}>{w.name} ({t(`workers.categories.${w.category}`)})</option>)}
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

export default function Equipment() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | EquipmentItem>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [tyreGetEquipment, setTyreGetEquipment] = useState<EquipmentItem | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [e, s, z, w] = await Promise.all([
        api.get<EquipmentItem[]>("/equipment"),
        api.get<Site[]>("/sites"),
        api.get<Zone[]>("/zones"),
        api.get<Worker[]>("/workers"),
      ]);
      setEquipment(e.data);
      setSites(s.data);
      setZones(z.data);
      setWorkers(w.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createEquipment(data: any) {
    await api.post("/equipment", data);
    setModal(null);
    await load();
  }

  async function updateEquipment(id: string, data: any) {
    await api.put(`/equipment/${id}`, data);
    setModal(null);
    await load();
  }

  async function deleteEquipment(id: string) {
    if (!confirm(t("equipment.confirmDelete"))) return;
    await api.delete(`/equipment/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("equipment.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("equipment.title")}</h1>
          <p className="text-mine-300 text-sm">{t("equipment.subtitle")}</p>
        </div>
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("equipment.newEquipment")}</button>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("equipment.colName")}</th>
              <th className="text-left px-4 py-2">{t("equipment.colType")}</th>
              <th className="text-left px-4 py-2">{t("equipment.colSiteZone")}</th>
              <th className="text-left px-4 py-2">{t("equipment.assignedOperator")}</th>
              <th className="text-left px-4 py-2">{t("equipment.colStatus")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((eq) => (
              <tr key={eq.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{eq.name}</td>
                <td className="px-4 py-2 text-mine-300">{t(`equipment.types.${eq.type}`)}</td>
                <td className="px-4 py-2 text-mine-300">
                  {eq.site?.name}{eq.zone?.name ? ` · ${eq.zone.name}` : ""}
                </td>
                <td className="px-4 py-2 text-mine-300">{eq.assignedOperator?.name ?? t("common.unassigned")}</td>
                <td className="px-4 py-2"><StatusBadge status={eq.status} /></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="text-xs font-bold text-hazard-600 hover:text-hazard-500" onClick={() => setAnalyzingId(eq.id)}>
                      {t("equipment.aiAnalysis.button")}
                    </button>
                    {TYRE_GET_APPLICABLE_TYPES.includes(eq.type) && (
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setTyreGetEquipment(eq)}>
                        {t("equipment.consumableParts.button")}
                      </button>
                    )}
                    {canEdit && (
                      <>
                        <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(eq)}>{t("common.edit")}</button>
                        <button className={buttonDanger} onClick={() => deleteEquipment(eq.id)}>{t("common.delete")}</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {equipment.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("equipment.noEquipmentYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("equipment.newEquipmentTitle") : t("equipment.editEquipmentTitle")} onClose={() => setModal(null)}>
          <EquipmentForm
            sites={sites}
            zones={zones}
            workers={workers}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? createEquipment(data) : updateEquipment(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {analyzingId && (
        <EquipmentAnalysisModal equipmentId={analyzingId} onClose={() => setAnalyzingId(null)} />
      )}

      {tyreGetEquipment && (
        <TyreGetModal equipment={tyreGetEquipment} canEdit={canEdit} onClose={() => setTyreGetEquipment(null)} />
      )}
    </div>
  );
}
