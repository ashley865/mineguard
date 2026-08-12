import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { BlastLog, BlastLogStatus, ExplosivesMagazine, Site, Worker, Zone } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";

const blastStatuses: BlastLogStatus[] = ["PLANNED", "FIRED", "MISFIRE", "CANCELLED"];

function BlastLogForm({ sites, zones, workers, magazines, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  workers: Worker[];
  magazines: ExplosivesMagazine[];
  initial?: BlastLog;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [magazineId, setMagazineId] = useState(initial?.magazineId ?? "");
  const [shotFirerId, setShotFirerId] = useState(initial?.shotFirerId ?? "");
  const [blastDate, setBlastDate] = useState(initial?.blastDate?.slice(0, 10) ?? "");
  const [explosiveType, setExplosiveType] = useState(initial?.explosiveType ?? "");
  const [quantityUsed, setQuantityUsed] = useState(initial?.quantityUsed?.toString() ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "kg");
  const [numberOfHoles, setNumberOfHoles] = useState(initial?.numberOfHoles?.toString() ?? "");
  const [misfireOccurred, setMisfireOccurred] = useState(initial?.misfireOccurred ?? false);
  const [misfireResolution, setMisfireResolution] = useState(initial?.misfireResolution ?? "");
  const [sapsNotified, setSapsNotified] = useState(initial?.sapsNotified ?? false);
  const [status, setStatus] = useState<BlastLogStatus>(initial?.status ?? "PLANNED");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        zoneId: zoneId || null,
        magazineId: magazineId || null,
        shotFirerId: shotFirerId || null,
        blastDate,
        explosiveType,
        quantityUsed: Number(quantityUsed),
        unit,
        numberOfHoles: numberOfHoles ? Number(numberOfHoles) : null,
        misfireOccurred,
        misfireResolution: misfireResolution || undefined,
        sapsNotified,
        status,
        notes: notes || undefined,
      });
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("blastLogs.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">—</option>
            {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("blastLogs.shotFirer")}</label>
          <select className={selectClass} value={shotFirerId} onChange={(e) => setShotFirerId(e.target.value)}>
            <option value="">—</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <p className="text-xs text-mine-500 mt-1">{t("blastLogs.shotFirerHint")}</p>
        </div>
        <div>
          <label className={labelClass}>{t("blastLogs.magazine")}</label>
          <select className={selectClass} value={magazineId} onChange={(e) => setMagazineId(e.target.value)}>
            <option value="">—</option>
            {magazines.map((m) => <option key={m.id} value={m.id}>{m.magazineNumber}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("blastLogs.blastDate")}</label>
          <DateField value={blastDate} onChange={setBlastDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("explosives.explosiveType")}</label>
          <input className={inputClass} value={explosiveType} onChange={(e) => setExplosiveType(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("blastLogs.numberOfHoles")}</label>
          <input className={inputClass} type="number" value={numberOfHoles} onChange={(e) => setNumberOfHoles(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("blastLogs.quantityUsed")}</label>
          <input className={inputClass} type="number" step="any" value={quantityUsed} onChange={(e) => setQuantityUsed(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("inventory.unit")}</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as BlastLogStatus)}>
            {blastStatuses.map((s) => <option key={s} value={s}>{t(`blastLogs.statuses.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={misfireOccurred} onChange={(e) => setMisfireOccurred(e.target.checked)} />
        {t("blastLogs.misfireOccurred")}
      </label>
      {misfireOccurred && (
        <div>
          <label className={labelClass}>{t("blastLogs.misfireResolution")}</label>
          <textarea className={inputClass} rows={2} value={misfireResolution} onChange={(e) => setMisfireResolution(e.target.value)} />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={sapsNotified} onChange={(e) => setSapsNotified(e.target.checked)} />
        {t("blastLogs.sapsNotified")}
      </label>
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

export default function BlastLogsTab({ sites, zones, workers }: { sites: Site[]; zones: Zone[]; workers: Worker[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [logs, setLogs] = useState<BlastLog[]>([]);
  const [magazines, setMagazines] = useState<ExplosivesMagazine[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | BlastLog>(null);

  async function load() {
    setLoading(true);
    const [l, m] = await Promise.all([
      api.get<BlastLog[]>("/explosives/blast-logs"),
      api.get<ExplosivesMagazine[]>("/explosives/magazines"),
    ]);
    setLogs(l.data);
    setMagazines(m.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/explosives/blast-logs", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/explosives/blast-logs/${id}`, data);
    setModal(null);
    await load();
  }

  async function giveClearance(id: string) {
    await api.post(`/explosives/blast-logs/${id}/clearance`);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("blastLogs.confirmDelete"))) return;
    await api.delete(`/explosives/blast-logs/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("blastLogs.hint")}</p>
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("blastLogs.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("blastLogs.blastDate")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("blastLogs.shotFirer")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="text-left px-4 py-2">{t("blastLogs.clearance")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{new Date(l.blastDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{l.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{l.shotFirer?.name ?? "—"}</td>
                <td className="px-4 py-2"><StatusBadge status={l.status} /></td>
                <td className="px-4 py-2 text-mine-300">
                  {l.clearanceGivenBy ? (
                    <span>{t("blastLogs.clearedBy", { name: l.clearanceGivenBy.name })}</span>
                  ) : canEdit ? (
                    <button className="text-xs text-mine-300 hover:text-mine-50 underline" onClick={() => giveClearance(l.id)}>{t("blastLogs.giveClearance")}</button>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(l)}>{t("common.edit")}</button>
                      {canDelete && <button className={buttonDanger} onClick={() => remove(l.id)}>{t("common.delete")}</button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("blastLogs.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("blastLogs.newTitle") : t("blastLogs.editTitle")} onClose={() => setModal(null)}>
          <BlastLogForm
            sites={sites}
            zones={zones}
            workers={workers}
            magazines={magazines}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
