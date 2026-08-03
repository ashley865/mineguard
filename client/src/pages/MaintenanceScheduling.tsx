import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Equipment, MaintenanceSchedule, MaintenanceScheduleStatus, MaintenanceType } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

const maintenanceTypes: MaintenanceType[] = ["PREVENTIVE", "CORRECTIVE", "INSPECTION"];
const scheduleStatuses: MaintenanceScheduleStatus[] = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELLED"];

function ScheduleForm({ equipment, initial, onSubmit, onCancel }: {
  equipment: Equipment[];
  initial?: MaintenanceSchedule;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [equipmentId, setEquipmentId] = useState(initial?.equipmentId ?? equipment[0]?.id ?? "");
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType>(initial?.maintenanceType ?? "PREVENTIVE");
  const [scheduledDate, setScheduledDate] = useState(initial?.scheduledDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<MaintenanceScheduleStatus>(initial?.status ?? "SCHEDULED");
  const [performedBy, setPerformedBy] = useState(initial?.performedBy ?? "");
  const [findings, setFindings] = useState(initial?.findings ?? "");
  const [partsUsed, setPartsUsed] = useState(initial?.partsUsed ?? "");
  const [cost, setCost] = useState(initial?.cost?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        equipmentId,
        maintenanceType,
        scheduledDate,
        status,
        performedBy: performedBy || undefined,
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
        <select className={inputClass} value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
          {equipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name} ({eq.site?.name})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("maintenance.type")}</label>
          <select className={inputClass} value={maintenanceType} onChange={(e) => setMaintenanceType(e.target.value as MaintenanceType)}>
            {maintenanceTypes.map((mt) => <option key={mt} value={mt}>{t(`maintenance.types.${mt}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as MaintenanceScheduleStatus)}>
            {scheduleStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("maintenance.scheduledDate")}</label>
        <input className={inputClass} type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("maintenance.performedBy")}</label>
          <input className={inputClass} value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("maintenance.cost")}</label>
          <input className={inputClass} type="number" step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("maintenance.partsUsed")}</label>
        <input className={inputClass} value={partsUsed} onChange={(e) => setPartsUsed(e.target.value)} />
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

export default function MaintenanceScheduling() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | MaintenanceSchedule>(null);

  async function load() {
    setLoading(true);
    const [sc, eq] = await Promise.all([
      api.get<MaintenanceSchedule[]>("/maintenance"),
      api.get<Equipment[]>("/equipment"),
    ]);
    setSchedules(sc.data);
    setEquipment(eq.data);
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
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{s.equipment?.name}</td>
                <td className="px-4 py-2 text-mine-300">{t(`maintenance.types.${s.maintenanceType}`)}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(s.scheduledDate).toLocaleDateString()}</td>
                <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {canEdit && s.status !== "COMPLETED" && (
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => complete(s.id)}>{t("maintenance.markComplete")}</button>
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
              <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("maintenance.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("maintenance.newScheduleTitle") : t("maintenance.editScheduleTitle")} onClose={() => setModal(null)}>
          <ScheduleForm
            equipment={equipment}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
