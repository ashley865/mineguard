import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ShiftRoster, ShiftType, Site, Worker } from "../api/types";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";

const shiftTypes: ShiftType[] = ["DAY", "AFTERNOON", "NIGHT"];

function RosterForm({ sites, onSubmit, onCancel }: {
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [shiftDate, setShiftDate] = useState("");
  const [shiftType, setShiftType] = useState<ShiftType>("DAY");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ siteId, shiftDate, shiftType, notes: notes || undefined });
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("roster.createError"));
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
          <label className={labelClass}>{t("roster.shiftType")}</label>
          <select className={selectClass} value={shiftType} onChange={(e) => setShiftType(e.target.value as ShiftType)}>
            {shiftTypes.map((s) => <option key={s} value={s}>{t(`production.shifts.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("roster.shiftDate")}</label>
        <DateField value={shiftDate} onChange={setShiftDate} required />
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
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

function AssignmentsModal({ roster, workers, onClose, onChanged }: {
  roster: ShiftRoster;
  workers: Worker[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [position, setPosition] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const assignedIds = new Set(roster.assignments.map((a) => a.worker.id));
  const availableWorkers = workers.filter((w) => !assignedIds.has(w.id));

  async function addWorker(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post(`/roster/${roster.id}/assignments`, { workerId, position: position || undefined });
      setPosition("");
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("roster.assignError"));
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(id: string) {
    await api.delete(`/roster/assignments/${id}`);
    onChanged();
  }

  return (
    <Modal title={t("roster.assignmentsFor", { site: roster.site?.name, date: new Date(roster.shiftDate).toLocaleDateString() })} onClose={onClose}>
      <div className="space-y-4">
        {availableWorkers.length > 0 && (
          <form onSubmit={addWorker} className="flex gap-2 items-end flex-wrap border border-mine-800 rounded-md p-3">
            <div className="flex-1 min-w-[160px]">
              <label className={labelClass}>{t("workers.title")}</label>
              <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
                {availableWorkers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("roster.position")}</label>
              <input className={`${inputClass} w-32`} value={position} onChange={(e) => setPosition(e.target.value)} />
            </div>
            <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("roster.addWorker")}</button>
          </form>
        )}
        {error && <div className="text-danger-500 text-xs">{error}</div>}

        <div className="space-y-1">
          {roster.assignments.length === 0 && <div className="text-mine-400 text-sm">{t("roster.noAssignments")}</div>}
          {roster.assignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm border-t border-mine-800 pt-1.5">
              <div>
                <span className="font-medium">{a.worker.name}</span>
                <span className="text-mine-400 text-xs ml-2">{a.position || a.worker.role}</span>
              </div>
              <button className={buttonDanger} onClick={() => removeAssignment(a.id)}>{t("common.delete")}</button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default function ShiftRostering() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [rosters, setRosters] = useState<ShiftRoster[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [assignmentsRoster, setAssignmentsRoster] = useState<ShiftRoster | null>(null);

  async function load() {
    setLoading(true);
    const [r, s, w] = await Promise.all([
      api.get<ShiftRoster[]>("/roster"),
      api.get<Site[]>("/sites"),
      api.get<Worker[]>("/workers"),
    ]);
    setRosters(r.data);
    setSites(s.data);
    setWorkers(w.data);
    setLoading(false);
    if (assignmentsRoster) {
      const refreshed = r.data.find((ro) => ro.id === assignmentsRoster.id);
      setAssignmentsRoster(refreshed ?? null);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(data: any) {
    await api.post("/roster", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("roster.confirmDelete"))) return;
    await api.delete(`/roster/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end flex-wrap gap-3">
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("roster.newRoster")}</button>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("roster.shiftDate")}</th>
              <th className="text-left px-4 py-2">{t("roster.shiftType")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("roster.assignedWorkers")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rosters.map((r) => (
              <tr key={r.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{new Date(r.shiftDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{t(`production.shifts.${r.shiftType}`)}</td>
                <td className="px-4 py-2 text-mine-300">{r.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{r.assignments.length}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setAssignmentsRoster(r)}>{t("roster.manage")}</button>
                    {canDelete && (
                      <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rosters.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("roster.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={t("roster.newRosterTitle")} onClose={() => setModal(false)}>
          <RosterForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}

      {assignmentsRoster && (
        <AssignmentsModal
          roster={assignmentsRoster}
          workers={workers.filter((w) => w.siteId === assignmentsRoster.siteId)}
          onClose={() => setAssignmentsRoster(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
