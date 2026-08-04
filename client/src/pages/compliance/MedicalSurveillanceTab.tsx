import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ExamType, FitnessResult, MedicalSurveillance, Worker } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";

const examTypes: ExamType[] = ["PRE_EMPLOYMENT", "PERIODICAL", "EXIT", "RETURN_TO_WORK"];
const results: FitnessResult[] = ["FIT", "FIT_WITH_RESTRICTION", "TEMPORARILY_UNFIT", "UNFIT"];

function MedicalForm({ workers, initial, onSubmit, onCancel }: {
  workers: Worker[];
  initial?: Partial<MedicalSurveillance>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(initial?.workerId ?? workers[0]?.id ?? "");
  const [examType, setExamType] = useState<ExamType>(initial?.examType ?? "PERIODICAL");
  const [examDate, setExamDate] = useState(initial?.examDate?.slice(0, 10) ?? "");
  const [result, setResult] = useState<FitnessResult>(initial?.result ?? "FIT");
  const [restrictions, setRestrictions] = useState(initial?.restrictions ?? "");
  const [nextExamDue, setNextExamDue] = useState(initial?.nextExamDue?.slice(0, 10) ?? "");
  const [practitioner, setPractitioner] = useState(initial?.practitioner ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        workerId,
        examType,
        examDate,
        result,
        restrictions: restrictions || undefined,
        nextExamDue,
        practitioner,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("compliance.medical.worker")}</label>
        <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)} required>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.employeeId})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.medical.examType")}</label>
          <select className={selectClass} value={examType} onChange={(e) => setExamType(e.target.value as ExamType)}>
            {examTypes.map((et) => <option key={et} value={et}>{t(`compliance.medical.examTypes.${et}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("compliance.medical.examDate")}</label>
          <DateField value={examDate} onChange={setExamDate} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.medical.result")}</label>
          <select className={selectClass} value={result} onChange={(e) => setResult(e.target.value as FitnessResult)}>
            {results.map((r) => <option key={r} value={r}>{t(`badges.status.${r}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("compliance.medical.nextExamDue")}</label>
          <DateField value={nextExamDue} onChange={setNextExamDue} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("compliance.medical.restrictions")}</label>
        <input className={inputClass} value={restrictions} onChange={(e) => setRestrictions(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("compliance.medical.practitioner")}</label>
        <input className={inputClass} value={practitioner} onChange={(e) => setPractitioner(e.target.value)} required />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function MedicalSurveillanceTab({ workers }: { workers: Worker[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<MedicalSurveillance[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | MedicalSurveillance>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<MedicalSurveillance[]>("/medical-surveillance");
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/medical-surveillance", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/medical-surveillance/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("compliance.medical.confirmDelete"))) return;
    await api.delete(`/medical-surveillance/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("compliance.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("compliance.medical.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("compliance.medical.colWorker")}</th>
              <th className="text-left px-4 py-2">{t("compliance.medical.colExamType")}</th>
              <th className="text-left px-4 py-2">{t("compliance.medical.colExamDate")}</th>
              <th className="text-left px-4 py-2">{t("compliance.medical.colResult")}</th>
              <th className="text-left px-4 py-2">{t("compliance.medical.colNextDue")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{item.worker?.name}</td>
                <td className="px-4 py-2 text-mine-300">{t(`compliance.medical.examTypes.${item.examType}`)}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(item.examDate).toLocaleDateString()}</td>
                <td className="px-4 py-2"><StatusBadge status={item.result} /></td>
                <td className="px-4 py-2 text-mine-300">{new Date(item.nextExamDue).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(item)}>{t("common.edit")}</button>
                      <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("compliance.medical.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("compliance.medical.newTitle") : t("compliance.medical.editTitle")} onClose={() => setModal(null)}>
          <MedicalForm
            workers={workers}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
