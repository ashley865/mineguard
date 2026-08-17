import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { BudgetPlan, ExpenseCategory, Site } from "../api/types";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import LoadError from "../components/LoadError";

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

function PlanForm({ sites, onSubmit, onCancel }: {
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("OPERATIONS");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [budgetedAmount, setBudgetedAmount] = useState("");
  const [notes, setNotes] = useState("");
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
  const [modal, setModal] = useState(false);

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
    setModal(false);
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
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("budgetPlanning.new")}</button>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("expenses.category")}</th>
              <th className="text-left px-4 py-2">{t("budgetPlanning.period")}</th>
              <th className="text-left px-4 py-2">{t("budgetPlanning.budgetedAmount")}</th>
              <th className="text-left px-4 py-2">{t("budgetPlanning.actualAmount")}</th>
              <th className="text-left px-4 py-2">{t("budgetPlanning.variance")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => {
              const variance = p.budgetedAmount - p.actualAmount;
              return (
                <tr key={p.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                  <td className="px-4 py-2 font-medium">{p.site?.name ?? t("budgetPlanning.allSites")}</td>
                  <td className="px-4 py-2 text-mine-300">{t(`expenses.categories.${p.category}`)}</td>
                  <td className="px-4 py-2 text-mine-300">
                    {new Date(p.periodStart).toLocaleDateString()} – {new Date(p.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-mine-300">{p.budgetedAmount.toLocaleString()}</td>
                  <td className="px-4 py-2 text-mine-300">{p.actualAmount.toLocaleString()}</td>
                  <td className={`px-4 py-2 font-semibold ${variance < 0 ? "text-danger-500" : "text-success-500"}`}>
                    {variance < 0 ? "−" : "+"}{Math.abs(variance).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {canEdit && <button className={buttonDanger} onClick={() => remove(p.id)}>{t("common.delete")}</button>}
                  </td>
                </tr>
              );
            })}
            {plans.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-mine-400">{t("budgetPlanning.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={t("budgetPlanning.newTitle")} onClose={() => setModal(false)}>
          <PlanForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
