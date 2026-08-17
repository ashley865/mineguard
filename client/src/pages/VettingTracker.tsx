import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { VettingCheckType, VettingRecord, VettingStatus, VettingSubjectType } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import LoadError from "../components/LoadError";

const subjectTypes: VettingSubjectType[] = ["CONTRACTOR", "VISITOR", "WORKER", "OTHER"];
const checkTypes: VettingCheckType[] = ["CRIMINAL_RECORD", "ID_VERIFICATION", "REFERENCE_CHECK", "COMPETENCY_VERIFICATION", "OTHER"];
const statuses: VettingStatus[] = ["PENDING", "PASSED", "FAILED", "EXPIRED"];

function VettingForm({ onSubmit, onCancel }: { onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [subjectType, setSubjectType] = useState<VettingSubjectType>("CONTRACTOR");
  const [subjectName, setSubjectName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [checkType, setCheckType] = useState<VettingCheckType>("ID_VERIFICATION");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ subjectType, subjectName, idNumber: idNumber || undefined, checkType, expiryDate: expiryDate || undefined, notes: notes || undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("vettingTracker.subjectType")}</label>
          <select className={selectClass} value={subjectType} onChange={(e) => setSubjectType(e.target.value as VettingSubjectType)}>
            {subjectTypes.map((s) => <option key={s} value={s}>{t(`vettingTracker.subjectTypes.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("vettingTracker.checkType")}</label>
          <select className={selectClass} value={checkType} onChange={(e) => setCheckType(e.target.value as VettingCheckType)}>
            {checkTypes.map((c) => <option key={c} value={c}>{t(`vettingTracker.checkTypes.${c}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("vettingTracker.subjectName")}</label>
          <input className={inputClass} value={subjectName} onChange={(e) => setSubjectName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("vettingTracker.idNumber")}</label>
          <input className={inputClass} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("vettingTracker.expiryDate")}</label>
        <DateField value={expiryDate} onChange={setExpiryDate} />
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

export default function VettingTracker() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [records, setRecords] = useState<VettingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<VettingRecord[]>("/vetting-records");
      setRecords(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/vetting-records", data);
    setModal(false);
    await load();
  }

  async function updateStatus(id: string, status: VettingStatus) {
    await api.put(`/vetting-records/${id}`, { status, checkedDate: new Date().toISOString() });
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("vettingTracker.confirmDelete"))) return;
    await api.delete(`/vetting-records/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("vettingTracker.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("vettingTracker.subtitle")}</p>
        </div>
        {canEdit && (
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("vettingTracker.new")}</button>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("vettingTracker.subjectName")}</th>
              <th className="text-left px-4 py-2">{t("vettingTracker.subjectType")}</th>
              <th className="text-left px-4 py-2">{t("vettingTracker.checkType")}</th>
              <th className="text-left px-4 py-2">{t("vettingTracker.expiryDate")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{r.subjectName}</td>
                <td className="px-4 py-2 text-mine-300">{t(`vettingTracker.subjectTypes.${r.subjectType}`)}</td>
                <td className="px-4 py-2 text-mine-300">{t(`vettingTracker.checkTypes.${r.checkType}`)}</td>
                <td className="px-4 py-2 text-mine-300">{r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    {canEdit && r.status === "PENDING" && (
                      <>
                        <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => updateStatus(r.id, "PASSED")}>{t("vettingTracker.markPassed")}</button>
                        <button className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => updateStatus(r.id, "FAILED")}>{t("vettingTracker.markFailed")}</button>
                      </>
                    )}
                    {canEdit && <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>}
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("vettingTracker.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={t("vettingTracker.newTitle")} onClose={() => setModal(false)}>
          <VettingForm onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
