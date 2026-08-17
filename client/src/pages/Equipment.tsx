import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AiEquipmentAnalysisResponse, Equipment as EquipmentItem, EquipmentStatus, EquipmentType, Site, Worker, Zone } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import LoadError from "../components/LoadError";

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
    </div>
  );
}
