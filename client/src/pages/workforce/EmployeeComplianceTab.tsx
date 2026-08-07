import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { EmployeeComplianceCheck, FitnessResult, Worker } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";

const fitnessOptions: FitnessResult[] = ["FIT", "FIT_WITH_RESTRICTION", "TEMPORARILY_UNFIT", "UNFIT"];

const checkFields = [
  "isProperlyTrained",
  "isCompetent",
  "isCertified",
  "isAuthorised",
  "isAssignedPermittedTasks",
  "isTrainingUpToDate",
] as const;

function ComplianceForm({ workers, initial, onSubmit, onCancel }: {
  workers: Worker[];
  initial?: Partial<EmployeeComplianceCheck>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(initial?.workerId ?? workers[0]?.id ?? "");
  const [flags, setFlags] = useState<Record<(typeof checkFields)[number], boolean>>({
    isProperlyTrained: initial?.isProperlyTrained ?? false,
    isCompetent: initial?.isCompetent ?? false,
    isCertified: initial?.isCertified ?? false,
    isAuthorised: initial?.isAuthorised ?? false,
    isAssignedPermittedTasks: initial?.isAssignedPermittedTasks ?? false,
    isTrainingUpToDate: initial?.isTrainingUpToDate ?? false,
  });
  const [medicalFitness, setMedicalFitness] = useState<FitnessResult | "">(initial?.medicalFitness ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        workerId,
        ...flags,
        medicalFitness: medicalFitness || null,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("workforce.compliance.worker")}</label>
        <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)} required>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({t(`workers.categories.${w.category}`)})</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {checkFields.map((field) => (
          <label key={field} className="flex items-center gap-2 text-sm text-mine-200">
            <input
              type="checkbox"
              checked={flags[field]}
              onChange={(e) => setFlags((f) => ({ ...f, [field]: e.target.checked }))}
            />
            {t(`workforce.compliance.fields.${field}`)}
          </label>
        ))}
      </div>

      <div>
        <label className={labelClass}>{t("workforce.compliance.medicalFitness")}</label>
        <select className={selectClass} value={medicalFitness} onChange={(e) => setMedicalFitness(e.target.value as FitnessResult | "")}>
          <option value="">{t("workforce.compliance.notApplicable")}</option>
          {fitnessOptions.map((r) => <option key={r} value={r}>{t(`badges.status.${r}`)}</option>)}
        </select>
      </div>

      <div>
        <label className={labelClass}>{t("workforce.compliance.notes")}</label>
        <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function EmployeeComplianceTab({ workers }: { workers: Worker[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<EmployeeComplianceCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | EmployeeComplianceCheck>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<EmployeeComplianceCheck[]>("/employee-compliance");
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/employee-compliance", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/employee-compliance/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("workforce.compliance.confirmDelete"))) return;
    await api.delete(`/employee-compliance/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("workforce.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("workforce.compliance.subtitle")}</p>

      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("workforce.compliance.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("workforce.compliance.colWorker")}</th>
              <th className="text-left px-4 py-2">{t("workforce.compliance.colChecks")}</th>
              <th className="text-left px-4 py-2">{t("workforce.compliance.colMedicalFitness")}</th>
              <th className="text-left px-4 py-2">{t("workforce.compliance.colAssessmentDate")}</th>
              <th className="text-left px-4 py-2">{t("workforce.compliance.colAssessedBy")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30 align-top">
                <td className="px-4 py-2 font-medium">{item.worker?.name}</td>
                <td className="px-4 py-2">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                    {checkFields.map((field) => (
                      <span key={field} className={item[field] ? "text-success-500" : "text-danger-500"}>
                        {item[field] ? "✓" : "✗"} {t(`workforce.compliance.fields.${field}`)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  {item.medicalFitness ? <StatusBadge status={item.medicalFitness} /> : <span className="text-mine-400 text-xs">{t("workforce.compliance.notApplicable")}</span>}
                </td>
                <td className="px-4 py-2 text-mine-300">{new Date(item.assessmentDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{item.assessedBy?.name ?? "—"}</td>
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
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("workforce.compliance.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("workforce.compliance.newTitle") : t("workforce.compliance.editTitle")} onClose={() => setModal(null)}>
          <ComplianceForm
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
