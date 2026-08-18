import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { BudgetPlan, ExpenseCategory, Site } from "../api/types";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import LoadError from "../components/LoadError";
import DataTable, { DataTableColumn } from "../components/DataTable";

const categories: ExpenseCategory[] = [
  "OPERATIONS",
  "MAINTENANCE",
  "SALARIES_WAGES",
  "TRANSPORT_LOGISTICS",
  "UTILITIES",
  "PROFESSIONAL_SERVICES",
  "EQUIPMENT_SUPPLIES",
  "RENT_LEASE",
  "INSURANCE",
  "TAXES_LEVIES",
  "OTHER",
];

interface PlanSeed {
  siteId?: string | null;
  category?: ExpenseCategory;
  periodStart?: string;
  periodEnd?: string;
  budgetedAmount?: number;
  notes?: string | null;
}

function PlanForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: PlanSeed;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? "OPERATIONS");
  const [periodStart, setPeriodStart] = useState(initial?.periodStart?.slice(0, 10) ?? "");
  const [periodEnd, setPeriodEnd] = useState(initial?.periodEnd?.slice(0, 10) ?? "");
  const [budgetedAmount, setBudgetedAmount] = useState(initial?.budgetedAmount?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId: siteId || undefined, category, periodStart, periodEnd,
        budgetedAmount: Number(budgetedAmount), notes: notes || undefined,
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
            <option value="">{t("budgetPlanning.allSites")}</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("expenses.category")}</label>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {categories.map((c) => <option key={c} value={c}>{t(`expenses.categories.${c}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("budgetPlanning.periodStart")}</label>
          <DateField value={periodStart} onChange={setPeriodStart} required />
        </div>
        <div>
          <label className={labelClass}>{t("budgetPlanning.periodEnd")}</label>
          <DateField value={periodEnd} onChange={setPeriodEnd} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("budgetPlanning.budgetedAmount")}</label>
        <input className={inputClass} type="number" step="any" min="0" value={budgetedAmount} onChange={(e) => setBudgetedAmount(e.target.value)} required />
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

export default function BudgetPlanning() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | { mode: "create"; seed?: BudgetPlan } | { mode: "edit"; plan: BudgetPlan }>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [p, s] = await Promise.all([
        api.get<BudgetPlan[]>("/budget-plans"),
        api.get<Site[]>("/sites"),
      ]);
      setPlans(p.data);
      setSites(s.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/budget-plans", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/budget-plans/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("budgetPlanning.confirmDelete"))) return;
    await api.delete(`/budget-plans/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("budgetPlanning.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("budgetPlanning.subtitle")}</p>
        </div>
        {canEdit && (
          <button className={buttonPrimary} onClick={() => setModal({ mode: "create" })}>{t("budgetPlanning.new")}</button>
        )}
      </div>

      <DataTable
        columns={
          [
            { key: "site", header: t("common.site"), render: (p) => p.site?.name ?? t("budgetPlanning.allSites"), sortValue: (p) => p.site?.name ?? "" },
            { key: "category", header: t("expenses.category"), render: (p) => t(`expenses.categories.${p.category}`), sortValue: (p) => p.category },
            {
              key: "period",
              header: t("budgetPlanning.period"),
              render: (p) => `${new Date(p.periodStart).toLocaleDateString()} – ${new Date(p.periodEnd).toLocaleDateString()}`,
              sortValue: (p) => p.periodStart,
            },
            { key: "budgeted", header: t("budgetPlanning.budgetedAmount"), render: (p) => p.budgetedAmount.toLocaleString(), sortValue: (p) => p.budgetedAmount },
            { key: "actual", header: t("budgetPlanning.actualAmount"), render: (p) => p.actualAmount.toLocaleString(), sortValue: (p) => p.actualAmount },
            {
              key: "variance",
              header: t("budgetPlanning.variance"),
              render: (p) => {
                const variance = p.budgetedAmount - p.actualAmount;
                return (
                  <span className={`font-semibold ${variance < 0 ? "text-danger-500" : "text-success-500"}`}>
                    {variance < 0 ? "−" : "+"}{Math.abs(variance).toLocaleString()}
                  </span>
                );
              },
              sortValue: (p) => p.budgetedAmount - p.actualAmount,
            },
          ] as DataTableColumn<BudgetPlan>[]
        }
        rows={plans}
        rowKey={(p) => p.id}
        emptyMessage={t("budgetPlanning.noneYet")}
        searchValue={(p) => `${p.site?.name ?? ""} ${t(`expenses.categories.${p.category}`)}`}
        exportFilename="budget-plans"
        exportColumns={[
          { header: t("common.site"), value: (p) => p.site?.name ?? t("budgetPlanning.allSites") },
          { header: t("expenses.category"), value: (p) => t(`expenses.categories.${p.category}`) },
          { header: t("budgetPlanning.budgetedAmount"), value: (p) => p.budgetedAmount },
          { header: t("budgetPlanning.actualAmount"), value: (p) => p.actualAmount },
        ]}
        actions={(p) =>
          canEdit ? (
            <div className="flex justify-end gap-2">
              <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal({ mode: "edit", plan: p })}>{t("common.edit")}</button>
              <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal({ mode: "create", seed: p })}>{t("budgetPlanning.duplicate")}</button>
              <button className={buttonDanger} onClick={() => remove(p.id)}>{t("common.delete")}</button>
            </div>
          ) : null
        }
      />

      {modal && (
        <Modal title={modal.mode === "edit" ? t("budgetPlanning.editTitle") : t("budgetPlanning.newTitle")} onClose={() => setModal(null)}>
          <PlanForm
            sites={sites}
            initial={
              modal.mode === "edit"
                ? modal.plan
                : modal.seed
                ? { siteId: modal.seed.siteId, category: modal.seed.category, budgetedAmount: modal.seed.budgetedAmount, notes: modal.seed.notes }
                : undefined
            }
            onSubmit={(data) => (modal.mode === "edit" ? update(modal.plan.id, data) : create(data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
