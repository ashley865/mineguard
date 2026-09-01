import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { FatigueAssessment, FatigueAssessmentOutcome, FatigueTestResult, Worker } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import LoadError from "../../components/LoadError";

const testResults: FatigueTestResult[] = ["PASS", "BORDERLINE", "FAIL"];
const outcomes: FatigueAssessmentOutcome[] = ["CLEARED", "RESTRICTED_DUTY", "STOOD_DOWN"];

function AssessmentForm({ workers, initial, onSubmit, onCancel }: {
  workers: Worker[];
  initial?: FatigueAssessment;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(initial?.workerId ?? workers[0]?.id ?? "");
  const [assessedAt, setAssessedAt] = useState(initial?.assessedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [hoursWorkedLast24h, setHoursWorkedLast24h] = useState(initial?.hoursWorkedLast24h?.toString() ?? "");
  const [hoursRestLast24h, setHoursRestLast24h] = useState(initial?.hoursRestLast24h?.toString() ?? "");
  const [consecutiveShifts, setConsecutiveShifts] = useState(initial?.consecutiveShifts?.toString() ?? "");
  const [testResult, setTestResult] = useState<FatigueTestResult>(initial?.testResult ?? "PASS");
  const [outcome, setOutcome] = useState<FatigueAssessmentOutcome>(initial?.outcome ?? "CLEARED");
  const [assessedByName, setAssessedByName] = useState(initial?.assessedByName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        workerId,
        assessedAt,
        hoursWorkedLast24h: hoursWorkedLast24h ? Number(hoursWorkedLast24h) : null,
        hoursRestLast24h: hoursRestLast24h ? Number(hoursRestLast24h) : null,
        consecutiveShifts: consecutiveShifts ? Number(consecutiveShifts) : null,
        testResult,
        outcome,
        assessedByName: assessedByName || undefined,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("fatigueManagement.worker")}</label>
          <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("fatigueManagement.assessedAt")}</label>
          <DateField value={assessedAt} onChange={setAssessedAt} required />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("fatigueManagement.hoursWorkedLast24h")}</label>
          <input className={inputClass} type="number" min={0} step="0.5" value={hoursWorkedLast24h} onChange={(e) => setHoursWorkedLast24h(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("fatigueManagement.hoursRestLast24h")}</label>
          <input className={inputClass} type="number" min={0} step="0.5" value={hoursRestLast24h} onChange={(e) => setHoursRestLast24h(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("fatigueManagement.consecutiveShifts")}</label>
          <input className={inputClass} type="number" min={0} value={consecutiveShifts} onChange={(e) => setConsecutiveShifts(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("fatigueManagement.testResult")}</label>
          <select className={selectClass} value={testResult} onChange={(e) => setTestResult(e.target.value as FatigueTestResult)}>
            {testResults.map((r) => <option key={r} value={r}>{t(`fatigueManagement.testResults.${r}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("fatigueManagement.outcome")}</label>
          <select className={selectClass} value={outcome} onChange={(e) => setOutcome(e.target.value as FatigueAssessmentOutcome)}>
            {outcomes.map((o) => <option key={o} value={o}>{t(`fatigueManagement.outcomes.${o}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("fatigueManagement.assessedByName")}</label>
        <input className={inputClass} value={assessedByName} onChange={(e) => setAssessedByName(e.target.value)} />
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

export default function FatigueManagementTab({ workers }: { workers: Worker[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [assessments, setAssessments] = useState<FatigueAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | FatigueAssessment>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<FatigueAssessment[]>("/fatigue-assessments");
      setAssessments(res.data);
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
    await api.post("/fatigue-assessments", data);
    setModal(null);
    await load();
  }
  async function update(id: string, data: any) {
    await api.put(`/fatigue-assessments/${id}`, data);
    setModal(null);
    await load();
  }
  async function remove(id: string) {
    if (!confirm(t("fatigueManagement.confirmDelete"))) return;
    await api.delete(`/fatigue-assessments/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const failCount = assessments.filter((a) => a.testResult === "FAIL").length;
  const stoodDownCount = assessments.filter((a) => a.outcome === "STOOD_DOWN").length;

  const columns: DataTableColumn<FatigueAssessment>[] = [
    { key: "worker", header: t("fatigueManagement.worker"), render: (a) => a.worker?.name ?? "—", sortValue: (a) => a.worker?.name ?? "" },
    { key: "assessedAt", header: t("fatigueManagement.assessedAt"), render: (a) => new Date(a.assessedAt).toLocaleDateString(), sortValue: (a) => a.assessedAt },
    { key: "testResult", header: t("fatigueManagement.testResult"), render: (a) => <StatusBadge status={a.testResult} />, sortValue: (a) => a.testResult },
    { key: "outcome", header: t("fatigueManagement.outcome"), render: (a) => <StatusBadge status={a.outcome} />, sortValue: (a) => a.outcome },
    { key: "consecutiveShifts", header: t("fatigueManagement.consecutiveShifts"), render: (a) => a.consecutiveShifts ?? "—", sortValue: (a) => a.consecutiveShifts ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-sm font-semibold text-mine-200">{t("fatigueManagement.title")}</h2>
          <p className="text-xs text-mine-400">{t("fatigueManagement.hint")}</p>
        </div>
        {canEdit && workers.length > 0 && <button className={buttonPrimary} onClick={() => setModal("create")}>{t("fatigueManagement.newAssessment")}</button>}
      </div>

      <SummaryCards
        cards={[
          { label: t("fatigueManagement.summaryFail"), value: failCount, tone: failCount > 0 ? "danger" : "default" },
          { label: t("fatigueManagement.summaryStoodDown"), value: stoodDownCount, tone: stoodDownCount > 0 ? "hazard" : "default" },
        ]}
      />

      <DataTable
        columns={columns}
        rows={assessments}
        rowKey={(a) => a.id}
        emptyMessage={t("fatigueManagement.noneYet")}
        searchValue={(a) => a.worker?.name ?? ""}
        exportFilename="fatigue-assessments"
        exportColumns={[
          { header: t("fatigueManagement.worker"), value: (a) => a.worker?.name ?? "" },
          { header: t("fatigueManagement.testResult"), value: (a) => a.testResult },
          { header: t("fatigueManagement.outcome"), value: (a) => a.outcome },
        ]}
        actions={(a) => (
          <div className="flex justify-end gap-2">
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(a)}>{t("common.edit")}</button>}
            {canDelete && <button className={buttonDanger} onClick={() => remove(a.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />

      {modal && (
        <Modal title={modal === "create" ? t("fatigueManagement.newAssessmentTitle") : t("fatigueManagement.editAssessmentTitle")} onClose={() => setModal(null)}>
          <AssessmentForm
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
