import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Site, ToolboxTalk } from "../api/types";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import LoadError from "../components/LoadError";

function TalkForm({ sites, onSubmit, onCancel }: {
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [talkDate, setTalkDate] = useState("");
  const [topic, setTopic] = useState("");
  const [presenter, setPresenter] = useState("");
  const [attendeeCount, setAttendeeCount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ siteId, talkDate, topic, presenter, attendeeCount: Number(attendeeCount), notes: notes || undefined });
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
          <label className={labelClass}>{t("toolboxTalks.talkDate")}</label>
          <DateField value={talkDate} onChange={setTalkDate} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("toolboxTalks.topic")}</label>
        <input className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("toolboxTalks.presenter")}</label>
          <input className={inputClass} value={presenter} onChange={(e) => setPresenter(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("toolboxTalks.attendeeCount")}</label>
          <input className={inputClass} type="number" min="0" value={attendeeCount} onChange={(e) => setAttendeeCount(e.target.value)} required />
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

export default function ToolboxTalks() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [talks, setTalks] = useState<ToolboxTalk[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [tks, s] = await Promise.all([
        api.get<ToolboxTalk[]>("/toolbox-talks"),
        api.get<Site[]>("/sites"),
      ]);
      setTalks(tks.data);
      setSites(s.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/toolbox-talks", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("toolboxTalks.confirmDelete"))) return;
    await api.delete(`/toolbox-talks/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("toolboxTalks.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("toolboxTalks.subtitle")}</p>
        </div>
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("toolboxTalks.new")}</button>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("toolboxTalks.talkDate")}</th>
              <th className="text-left px-4 py-2">{t("toolboxTalks.topic")}</th>
              <th className="text-left px-4 py-2">{t("toolboxTalks.presenter")}</th>
              <th className="text-left px-4 py-2">{t("toolboxTalks.attendeeCount")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {talks.map((tk) => (
              <tr key={tk.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{tk.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(tk.talkDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{tk.topic}</td>
                <td className="px-4 py-2 text-mine-300">{tk.presenter}</td>
                <td className="px-4 py-2 text-mine-300">{tk.attendeeCount}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(tk.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {talks.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("toolboxTalks.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={t("toolboxTalks.newTitle")} onClose={() => setModal(false)}>
          <TalkForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
