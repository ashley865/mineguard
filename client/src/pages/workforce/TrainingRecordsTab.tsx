import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { TrainingRecord, TrainingType, Worker } from "../../api/types";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import LoadError from "../../components/LoadError";

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
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({t(`workers.categories.${w.category}`)})</option>)}
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
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | TrainingRecord>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<TrainingRecord[]>("/training-records");
      setItems(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
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
  if (loadError) return <LoadError onRetry={load} />;

  const expiredCount = items.filter((i) => i.expiryDate && new Date(i.expiryDate).getTime() < Date.now()).length;
  const expiringSoonCount = items.filter((i) => i.expiryDate && !((new Date(i.expiryDate).getTime() < Date.now())) && new Date(i.expiryDate).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 90).length;

  const columns: DataTableColumn<TrainingRecord>[] = [
    { key: "worker", header: t("workforce.training.colWorker"), render: (item) => <span className="font-medium">{item.worker?.name}</span>, sortValue: (item) => item.worker?.name ?? "" },
    { key: "course", header: t("workforce.training.colCourse"), render: (item) => item.courseName, sortValue: (item) => item.courseName },
    { key: "type", header: t("workforce.training.colType"), render: (item) => t(`workforce.training.types.${item.trainingType}`), sortValue: (item) => item.trainingType },
    { key: "completion", header: t("workforce.training.colCompletion"), render: (item) => new Date(item.completionDate).toLocaleDateString(), sortValue: (item) => item.completionDate },
    { key: "expiry", header: t("workforce.training.colExpiry"), render: (item) => (item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "—"), sortValue: (item) => item.expiryDate ?? "" },
  ];

  return (
    <div className="space-y-4">
      <SummaryCards
        cards={[
          { label: t("workforce.training.summaryExpiringSoon"), value: expiringSoonCount, tone: expiringSoonCount > 0 ? "hazard" : "default" },
          { label: t("workforce.training.summaryExpired"), value: expiredCount, tone: expiredCount > 0 ? "danger" : "default" },
        ]}
      />

      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("workforce.training.new")}</button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(item) => item.id}
        emptyMessage={t("workforce.training.noneYet")}
        searchValue={(item) => `${item.worker?.name ?? ""} ${item.courseName} ${item.trainingType}`}
        exportFilename="training-records"
        exportColumns={[
          { header: t("workforce.training.colWorker"), value: (item) => item.worker?.name ?? "" },
          { header: t("workforce.training.colCourse"), value: (item) => item.courseName },
          { header: t("workforce.training.colType"), value: (item) => item.trainingType },
          { header: t("workforce.training.colCompletion"), value: (item) => item.completionDate },
          { header: t("workforce.training.colExpiry"), value: (item) => item.expiryDate ?? "" },
        ]}
        actions={(item) => (
          canEdit ? (
            <div className="flex justify-end gap-2">
              <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(item)}>{t("common.edit")}</button>
              <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
            </div>
          ) : null
        )}
      />

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
