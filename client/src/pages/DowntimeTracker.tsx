import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { DowntimeCategory, DowntimeEvent, Site } from "../api/types";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import LoadError from "../components/LoadError";

const categories: DowntimeCategory[] = [
  "EQUIPMENT_BREAKDOWN",
  "POWER_OUTAGE",
  "WEATHER",
  "SAFETY_STOPPAGE",
  "MATERIAL_SHORTAGE",
  "LABOUR_SHORTAGE",
  "PLANNED_MAINTENANCE",
  "OTHER",
];

function toLocalInput(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DowntimeForm({ sites, onSubmit, onCancel }: {
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [category, setCategory] = useState<DowntimeCategory>("EQUIPMENT_BREAKDOWN");
  const [description, setDescription] = useState("");
  const [affectedArea, setAffectedArea] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId, category, description, affectedArea: affectedArea || undefined,
        startedAt, endedAt: endedAt || undefined,
      });
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
          <label className={labelClass}>{t("downtime.category")}</label>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as DowntimeCategory)}>
            {categories.map((c) => <option key={c} value={c}>{t(`downtime.categories.${c}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("downtime.affectedArea")}</label>
        <input className={inputClass} value={affectedArea} onChange={(e) => setAffectedArea(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("downtime.startedAt")}</label>
          <input className={inputClass} type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("downtime.endedAt")}</label>
          <input className={inputClass} type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function DowntimeTracker() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [events, setEvents] = useState<DowntimeEvent[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [e, s] = await Promise.all([
        api.get<DowntimeEvent[]>("/downtime-events"),
        api.get<Site[]>("/sites"),
      ]);
      setEvents(e.data);
      setSites(s.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/downtime-events", data);
    setModal(false);
    await load();
  }

  async function markEnded(id: string) {
    await api.put(`/downtime-events/${id}`, { endedAt: new Date().toISOString() });
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("downtime.confirmDelete"))) return;
    await api.delete(`/downtime-events/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const totalDowntimeHours = events.reduce((sum, e) => {
    const end = e.endedAt ? new Date(e.endedAt).getTime() : Date.now();
    return sum + (end - new Date(e.startedAt).getTime()) / 3_600_000;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("downtime.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("downtime.subtitle")}</p>
        </div>
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("downtime.new")}</button>
        )}
      </div>

      <div className={`${cardClass} p-4 flex items-center gap-2`}>
        <span className="text-mine-400 text-xs uppercase">{t("downtime.totalHours")}</span>
        <span className="text-lg font-bold">{totalDowntimeHours.toFixed(1)}</span>
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("downtime.category")}</th>
              <th className="text-left px-4 py-2">{t("common.description")}</th>
              <th className="text-left px-4 py-2">{t("downtime.startedAt")}</th>
              <th className="text-left px-4 py-2">{t("downtime.endedAt")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{e.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{t(`downtime.categories.${e.category}`)}</td>
                <td className="px-4 py-2 text-mine-300">{e.description}</td>
                <td className="px-4 py-2 text-mine-300">{toLocalInput(e.startedAt).replace("T", " ")}</td>
                <td className="px-4 py-2 text-mine-300">{e.endedAt ? toLocalInput(e.endedAt).replace("T", " ") : "—"}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {canEdit && !e.endedAt && (
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => markEnded(e.id)}>{t("downtime.markEnded")}</button>
                    )}
                    {canDelete && (
                      <button className={buttonDanger} onClick={() => remove(e.id)}>{t("common.delete")}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("downtime.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={t("downtime.newTitle")} onClose={() => setModal(false)}>
          <DowntimeForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
