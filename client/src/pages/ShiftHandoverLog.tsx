import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ProductionShift, ShiftHandover, Site } from "../api/types";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import LoadError from "../components/LoadError";

const shifts: ProductionShift[] = ["DAY", "AFTERNOON", "NIGHT"];

function HandoverForm({ sites, onSubmit, onCancel }: {
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [shiftDate, setShiftDate] = useState("");
  const [shift, setShift] = useState<ProductionShift>("DAY");
  const [outgoingSupervisor, setOutgoingSupervisor] = useState("");
  const [summary, setSummary] = useState("");
  const [issues, setIssues] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ siteId, shiftDate, shift, outgoingSupervisor, summary, issues: issues || undefined, actionItems: actionItems || undefined });
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
          <label className={labelClass}>{t("production.shift")}</label>
          <select className={selectClass} value={shift} onChange={(e) => setShift(e.target.value as ProductionShift)}>
            {shifts.map((s) => <option key={s} value={s}>{t(`production.shifts.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("production.shiftDate")}</label>
          <DateField value={shiftDate} onChange={setShiftDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("shiftHandover.outgoingSupervisor")}</label>
          <input className={inputClass} value={outgoingSupervisor} onChange={(e) => setOutgoingSupervisor(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("shiftHandover.summary")}</label>
        <textarea className={inputClass} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("shiftHandover.issues")}</label>
        <textarea className={inputClass} rows={2} value={issues} onChange={(e) => setIssues(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("shiftHandover.actionItems")}</label>
        <textarea className={inputClass} rows={2} value={actionItems} onChange={(e) => setActionItems(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function ShiftHandoverLog() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [handovers, setHandovers] = useState<ShiftHandover[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [h, s] = await Promise.all([
        api.get<ShiftHandover[]>("/shift-handovers"),
        api.get<Site[]>("/sites"),
      ]);
      setHandovers(h.data);
      setSites(s.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/shift-handovers", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("shiftHandover.confirmDelete"))) return;
    await api.delete(`/shift-handovers/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("shiftHandover.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("shiftHandover.subtitle")}</p>
        </div>
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("shiftHandover.new")}</button>
        )}
      </div>

      <div className="space-y-3">
        {handovers.map((h) => (
          <div key={h.id} className={`${cardClass} p-4 space-y-2`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold">
                  {h.site?.name} · {new Date(h.shiftDate).toLocaleDateString()} · {t(`production.shifts.${h.shift}`)}
                </div>
                <div className="text-xs text-mine-400 mt-0.5">
                  {t("shiftHandover.outgoingSupervisor")}: {h.outgoingSupervisor}
                </div>
              </div>
              {canDelete && (
                <button className={buttonDanger} onClick={() => remove(h.id)}>{t("common.delete")}</button>
              )}
            </div>
            <p className="text-sm text-mine-200 whitespace-pre-line">{h.summary}</p>
            {h.issues && (
              <div className="text-xs text-hazard-500 border-t border-mine-800 pt-2">
                <span className="font-semibold">{t("shiftHandover.issues")}:</span> {h.issues}
              </div>
            )}
            {h.actionItems && (
              <div className="text-xs text-mine-300">
                <span className="font-semibold">{t("shiftHandover.actionItems")}:</span> {h.actionItems}
              </div>
            )}
          </div>
        ))}
        {handovers.length === 0 && (
          <div className={`${cardClass} p-6 text-center text-mine-400`}>{t("shiftHandover.noneYet")}</div>
        )}
      </div>

      {modal && (
        <Modal title={t("shiftHandover.newTitle")} onClose={() => setModal(false)}>
          <HandoverForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
