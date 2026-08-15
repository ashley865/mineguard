import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { OnboardingChecklist } from "../../api/types";
import Modal from "../../components/Modal";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import LoadError from "../../components/LoadError";

const CHECKLIST_ITEMS: { flag: keyof OnboardingChecklist; date: keyof OnboardingChecklist | null; labelKey: string }[] = [
  { flag: "inductionCompleted", date: "inductionDate", labelKey: "recruitment.onboarding.induction" },
  { flag: "medicalCompleted", date: "medicalDate", labelKey: "recruitment.onboarding.medical" },
  { flag: "ppeIssued", date: "ppeIssuedDate", labelKey: "recruitment.onboarding.ppe" },
  { flag: "contractSigned", date: "contractSignedDate", labelKey: "recruitment.onboarding.contract" },
  { flag: "bankDetailsCollected", date: null, labelKey: "recruitment.onboarding.bankDetails" },
  { flag: "statutoryFormsCompleted", date: null, labelKey: "recruitment.onboarding.statutoryForms" },
  { flag: "systemAccessGranted", date: null, labelKey: "recruitment.onboarding.systemAccess" },
];

function ChecklistForm({ checklist, onSubmit, onCancel }: {
  checklist: OnboardingChecklist;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, boolean>>(
    Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.flag, !!checklist[item.flag]]))
  );
  const [dates, setDates] = useState<Record<string, string>>(
    Object.fromEntries(
      CHECKLIST_ITEMS.filter((i) => i.date).map((item) => [item.date as string, (checklist[item.date as keyof OnboardingChecklist] as string | null)?.slice(0, 10) ?? ""])
    )
  );
  const [notes, setNotes] = useState(checklist.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        ...values,
        ...Object.fromEntries(Object.entries(dates).map(([k, v]) => [k, v || null])),
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {CHECKLIST_ITEMS.map((item) => (
        <div key={item.flag} className="flex items-center justify-between gap-3 border-b border-mine-800 pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values[item.flag]}
              onChange={(e) => setValues((prev) => ({ ...prev, [item.flag]: e.target.checked }))}
            />
            {t(item.labelKey)}
          </label>
          {item.date && (
            <div className="w-40">
              <DateField value={dates[item.date]} onChange={(v) => setDates((prev) => ({ ...prev, [item.date as string]: v }))} />
            </div>
          )}
        </div>
      ))}
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

export default function OnboardingTab() {
  const { t } = useTranslation();
  const [checklists, setChecklists] = useState<OnboardingChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<OnboardingChecklist | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<OnboardingChecklist[]>("/recruitment/onboarding");
      setChecklists(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function update(id: string, data: any) {
    await api.put(`/recruitment/onboarding/${id}`, data);
    setEditing(null);
    await load();
  }

  function completedItems(c: OnboardingChecklist): number {
    return CHECKLIST_ITEMS.filter((item) => c[item.flag]).length;
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const incompleteCount = checklists.filter((c) => !c.completedAt).length;

  const columns: DataTableColumn<OnboardingChecklist>[] = [
    { key: "worker", header: t("workers.title"), render: (c) => <span className="font-medium">{c.worker?.name}</span>, sortValue: (c) => c.worker?.name ?? "" },
    { key: "employeeId", header: t("workers.employeeId"), render: (c) => c.worker?.employeeId ?? "—" },
    { key: "site", header: t("common.site"), render: (c) => c.worker?.site?.name ?? "—", sortValue: (c) => c.worker?.site?.name ?? "" },
    {
      key: "progress",
      header: t("recruitment.onboarding.progress"),
      render: (c) => `${completedItems(c)} / ${CHECKLIST_ITEMS.length}`,
      sortValue: (c) => completedItems(c),
    },
    {
      key: "status",
      header: t("common.status"),
      render: (c) =>
        c.completedAt ? (
          <span className="text-success-500 font-semibold text-xs">{t("recruitment.onboarding.complete")}</span>
        ) : (
          <span className="text-hazard-500 font-semibold text-xs">{t("recruitment.onboarding.inProgress")}</span>
        ),
      sortValue: (c) => (c.completedAt ? 1 : 0),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("recruitment.onboarding.hint")}</p>

      <SummaryCards cards={[{ label: t("recruitment.onboarding.summaryIncomplete"), value: incompleteCount, tone: incompleteCount > 0 ? "hazard" : "default" }]} />

      <DataTable
        columns={columns}
        rows={checklists}
        rowKey={(c) => c.id}
        emptyMessage={t("recruitment.onboarding.none")}
        searchValue={(c) => c.worker?.name ?? ""}
        actions={(c) => (
          <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setEditing(c)}>
            {t("common.edit")}
          </button>
        )}
      />

      {editing && (
        <Modal title={t("recruitment.onboarding.editTitle", { name: editing.worker?.name })} onClose={() => setEditing(null)}>
          <ChecklistForm checklist={editing} onSubmit={(data) => update(editing.id, data)} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
