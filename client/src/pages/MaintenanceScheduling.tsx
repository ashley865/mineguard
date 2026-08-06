import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Equipment, InventoryItem, MaintenanceSchedule, MaintenanceScheduleStatus, MaintenanceType } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";

const maintenanceTypes: MaintenanceType[] = ["PLANNED", "PREVENTIVE", "CORRECTIVE", "EMERGENCY", "INSPECTION"];
const scheduleStatuses: MaintenanceScheduleStatus[] = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELLED"];
const DOWNTIME_TYPES: MaintenanceType[] = ["CORRECTIVE", "EMERGENCY"];

interface Technician {
  id: string;
  name: string;
}

function ScheduleForm({ equipment, technicians, initial, onSubmit, onCancel }: {
  equipment: Equipment[];
  technicians: Technician[];
  initial?: MaintenanceSchedule;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [equipmentId, setEquipmentId] = useState(initial?.equipmentId ?? equipment[0]?.id ?? "");
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType>(initial?.maintenanceType ?? "PREVENTIVE");
  const [scheduledDate, setScheduledDate] = useState(initial?.scheduledDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<MaintenanceScheduleStatus>(initial?.status ?? "SCHEDULED");
  const [assignedToId, setAssignedToId] = useState(initial?.assignedToId ?? "");
  const [downtimeMinutes, setDowntimeMinutes] = useState(initial?.downtimeMinutes?.toString() ?? "");
  const [downtimeReason, setDowntimeReason] = useState(initial?.downtimeReason ?? "");
  const [findings, setFindings] = useState(initial?.findings ?? "");
  const [partsUsed, setPartsUsed] = useState(initial?.partsUsed ?? "");
  const [cost, setCost] = useState(initial?.cost?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const isDowntimeType = DOWNTIME_TYPES.includes(maintenanceType);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        equipmentId,
        maintenanceType,
        scheduledDate,
        status,
        assignedToId: assignedToId || null,
        downtimeMinutes: downtimeMinutes ? Number(downtimeMinutes) : null,
        downtimeReason: downtimeReason || null,
        findings: findings || undefined,
        partsUsed: partsUsed || undefined,
        cost: cost ? Number(cost) : null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("nav.equipment")}</label>
        <select className={selectClass} value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
          {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name} ({eq.site?.name})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("maintenance.type")}</label>
          <select className={selectClass} value={maintenanceType} onChange={(e) => setMaintenanceType(e.target.value as MaintenanceType)}>
            {maintenanceTypes.map((mt) => <option key={mt} value={mt}>{t(`maintenance.types.${mt}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as MaintenanceScheduleStatus)}>
            {scheduleStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("maintenance.scheduledDate")}</label>
        <DateField value={scheduledDate} onChange={setScheduledDate} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("maintenance.assignedTo")}</label>
          <select className={selectClass} value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
            <option value="">{t("common.unassigned")}</option>
            {technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("maintenance.cost")}</label>
          <input className={inputClass} type="number" step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
      </div>
      {isDowntimeType && (
        <div className="space-y-4 border border-mine-800 rounded-md p-3 bg-mine-900/40">
          <div>
            <label className={labelClass}>{t("maintenance.downtimeMinutes")}</label>
            <input className={inputClass} type="number" step="any" value={downtimeMinutes} onChange={(e) => setDowntimeMinutes(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("maintenance.downtimeReason")}</label>
            <textarea className={inputClass} rows={2} value={downtimeReason} onChange={(e) => setDowntimeReason(e.target.value)} placeholder={t("maintenance.downtimeReasonPlaceholder") ?? ""} />
          </div>
        </div>
      )}
      <div>
        <label className={labelClass}>{t("maintenance.partsUsed")}</label>
        <input className={inputClass} value={partsUsed} onChange={(e) => setPartsUsed(e.target.value)} placeholder={t("maintenance.partsUsedPlaceholder") ?? ""} />
      </div>
      <div>
        <label className={labelClass}>{t("maintenance.findings")}</label>
        <textarea className={inputClass} rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function PartsUsedModal({ schedule, inventoryItems, onClose, onChanged }: {
  schedule: MaintenanceSchedule;
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [itemId, setItemId] = useState(inventoryItems[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addPart(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post(`/maintenance/${schedule.id}/parts`, { inventoryItemId: itemId, quantity });
      setQuantity("");
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("maintenance.partError"));
    } finally {
      setSaving(false);
    }
  }

  async function removePart(partId: string) {
    await api.delete(`/maintenance/${schedule.id}/parts/${partId}`);
    onChanged();
  }

  return (
    <Modal title={t("maintenance.partsFor", { name: schedule.equipment?.name ?? "" })} onClose={onClose}>
      <div className="space-y-4">
        {inventoryItems.length > 0 ? (
          <form onSubmit={addPart} className="flex gap-2 items-end flex-wrap border border-mine-800 rounded-md p-3">
            <div className="flex-1 min-w-[160px]">
              <label className={labelClass}>{t("maintenance.selectPart")}</label>
              <select className={selectClass} value={itemId} onChange={(e) => setItemId(e.target.value)}>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.quantityOnHand} {t(`inventory.units.${item.unit}`)} {t("maintenance.inStock")})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("inventory.quantity")}</label>
              <input className={`${inputClass} w-24`} type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.add")}</button>
          </form>
        ) : (
          <div className="text-mine-400 text-xs">{t("maintenance.noInventoryItems")}</div>
        )}
        {error && <div className="text-danger-500 text-xs">{error}</div>}

        {(schedule.partsConsumed ?? []).length === 0 && <div className="text-mine-400 text-sm">{t("maintenance.noPartsYet")}</div>}
        <div className="space-y-1.5">
          {(schedule.partsConsumed ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1.5">
              <span>{p.inventoryItem?.name}</span>
              <span className="text-mine-300">{p.quantity} {p.inventoryItem?.unit ? t(`inventory.units.${p.inventoryItem.unit}`) : ""}</span>
              <button className={buttonDanger} onClick={() => removePart(p.id)}>{t("common.delete")}</button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default function MaintenanceScheduling() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | MaintenanceSchedule>(null);
  const [partsModal, setPartsModal] = useState<MaintenanceSchedule | null>(null);

  async function load() {
    setLoading(true);
    const [sc, eq, tech, inv] = await Promise.all([
      api.get<MaintenanceSchedule[]>("/maintenance"),
      api.get<Equipment[]>("/equipment"),
      api.get<Technician[]>("/maintenance/technicians"),
      api.get<InventoryItem[]>("/inventory/items"),
    ]);
    setSchedules(sc.data);
    setEquipment(eq.data);
    setTechnicians(tech.data);
    setInventoryItems(inv.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/maintenance", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/maintenance/${id}`, data);
    setModal(null);
    await load();
  }

  async function complete(id: string) {
    await api.post(`/maintenance/${id}/complete`);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("maintenance.confirmDelete"))) return;
    await api.delete(`/maintenance/${id}`);
    await load();
  }

  const activePartsSchedule = partsModal ? schedules.find((s) => s.id === partsModal.id) ?? partsModal : null;

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("maintenance.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("maintenance.subtitle")}</p>
        </div>
        {canEdit && equipment.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("maintenance.newSchedule")}</button>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("nav.equipment")}</th>
              <th className="text-left px-4 py-2">{t("maintenance.type")}</th>
              <th className="text-left px-4 py-2">{t("maintenance.scheduledDate")}</th>
              <th className="text-left px-4 py-2">{t("maintenance.assignedTo")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{s.equipment?.name}</td>
                <td className="px-4 py-2 text-mine-300">
                  {t(`maintenance.types.${s.maintenanceType}`)}
                  {s.downtimeMinutes != null && (
                    <div className="text-[10px] text-danger-500">{t("maintenance.downtimeMinutesValue", { count: s.downtimeMinutes })}</div>
                  )}
                </td>
                <td className="px-4 py-2 text-mine-300">{new Date(s.scheduledDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{s.assignedTo?.name ?? t("common.unassigned")}</td>
                <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {canEdit && s.status !== "COMPLETED" && (
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => complete(s.id)}>{t("maintenance.markComplete")}</button>
                    )}
                    {canEdit && (
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setPartsModal(s)}>{t("maintenance.parts")}</button>
                    )}
                    {canEdit && (
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(s)}>{t("common.edit")}</button>
                    )}
                    {canDelete && (
                      <button className={buttonDanger} onClick={() => remove(s.id)}>{t("common.delete")}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("maintenance.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("maintenance.newScheduleTitle") : t("maintenance.editScheduleTitle")} onClose={() => setModal(null)}>
          <ScheduleForm
            equipment={equipment}
            technicians={technicians}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {activePartsSchedule && (
        <PartsUsedModal
          schedule={activePartsSchedule}
          inventoryItems={inventoryItems}
          onClose={() => setPartsModal(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
