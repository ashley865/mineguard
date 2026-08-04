import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { TrainingRecord, TrainingType, Worker } from "../../api/types";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";

const trainingTypes: TrainingType[] = [
  "INDUCTION",
  "REFRESHER",
  "FIRST_AID",
  "FIRE_FIGHTING",
  "SELF_RESCUE",
  "HAZARD_SPECIFIC",
  "SKILLS_DEVELOPMENT",
  "OTHER",
];

function TrainingForm({ workers, initial, onSubmit, onCancel }: {
  workers: Worker[];
  initial?: Partial<TrainingRecord>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(initial?.workerId ?? workers[0]?.id ?? "");
  const [courseName, setCourseName] = useState(initial?.courseName ?? "");
  const [trainingType, setTrainingType] = useState<TrainingType>(initial?.trainingType ?? "INDUCTION");
  const [completionDate, setCompletionDate] = useState(initial?.completionDate?.slice(0, 10) ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate?.slice(0, 10) ?? "");
  const [provider, setProvider] = useState(initial?.provider ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        workerId,
        courseName,
        trainingType,
        completionDate,
        expiryDate: expiryDate || null,
        provider,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("workforce.training.worker")}</label>
        <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)} required>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.employeeId})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("workforce.training.courseName")}</label>
          <input className={inputClass} value={courseName} onChange={(e) => setCourseName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("workforce.training.trainingType")}</label>
          <select className={selectClass} value={trainingType} onChange={(e) => setTrainingType(e.target.value as TrainingType)}>
            {trainingTypes.map((tt) => <option key={tt} value={tt}>{t(`workforce.training.types.${tt}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("workforce.training.completionDate")}</label>
          <DateField value={completionDate} onChange={setCompletionDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("workforce.training.expiryDate")}</label>
          <DateField value={expiryDate} onChange={setExpiryDate} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("workforce.training.provider")}</label>
        <input className={inputClass} value={provider} onChange={(e) => setProvider(e.target.value)} required />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function TrainingRecordsTab({ workers }: { workers: Worker[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | TrainingRecord>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<TrainingRecord[]>("/training-records");
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/training-records", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/training-records/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("workforce.training.confirmDelete"))) return;
    await api.delete(`/training-records/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("workforce.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("workforce.training.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("workforce.training.colWorker")}</th>
              <th className="text-left px-4 py-2">{t("workforce.training.colCourse")}</th>
              <th className="text-left px-4 py-2">{t("workforce.training.colType")}</th>
              <th className="text-left px-4 py-2">{t("workforce.training.colCompletion")}</th>
              <th className="text-left px-4 py-2">{t("workforce.training.colExpiry")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{item.worker?.name}</td>
                <td className="px-4 py-2 text-mine-300">{item.courseName}</td>
                <td className="px-4 py-2 text-mine-300">{t(`workforce.training.types.${item.trainingType}`)}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(item.completionDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">
                  {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "—"}
                </td>
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
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("workforce.training.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("workforce.training.newTitle") : t("workforce.training.editTitle")} onClose={() => setModal(null)}>
          <TrainingForm
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
