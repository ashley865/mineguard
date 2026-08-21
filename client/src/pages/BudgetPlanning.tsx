import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AiBudgetInsight, BudgetPlan, BudgetPlanExpense, BudgetSummary, ExpenseCategory, Site } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import LoadError from "../components/LoadError";
import DataTable, { DataTableColumn } from "../components/DataTable";

// Itemized breakdown behind a plan's actualAmount, so "actual spend" is a verifiable
// list of real expenses rather than a lump number the viewer has to take on faith.
function SpendingModal({ plan, onClose }: { plan: BudgetPlan; onClose: () => void }) {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<BudgetPlanExpense[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    setLoadError(false);
    try {
      const res = await api.get<BudgetPlanExpense[]>(`/budget-plans/${plan.id}/expenses`);
      setExpenses(res.data);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title={t("budgetPlanning.spendingTitle", { category: t(`expenses.categories.${plan.category}`) })} onClose={onClose} size="lg">
      {loadError && <LoadError onRetry={load} />}
      {!loadError && !expenses && <div className="text-mine-300 text-sm">{t("common.loading")}</div>}
      {!loadError && expenses && (
        expenses.length === 0 ? (
          <div className="text-mine-400 text-sm">{t("budgetPlanning.noSpendingYet")}</div>
        ) : (
          <div className="space-y-2">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm border-b border-mine-800 pb-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{e.description}</div>
                  <div className="text-xs text-mine-400">
                    {e.expenseNumber} · {e.payee?.name ?? "—"} · {e.site?.name ?? "—"} · {new Date(e.expenseDate).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <StatusBadge status={e.status} />
                  <span className="font-semibold tabular-nums">{e.currency} {e.amount.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </Modal>
  );
}

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

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 10, fill: "#52525b" };

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

function ReviewForm({ decision, onSubmit, onCancel }: { decision: "approve" | "reject"; onSubmit: (reviewNote?: string) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(reviewNote || undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("budgetPlanning.reviewNote")}</label>
        <textarea className={inputClass} rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={decision === "approve" ? buttonPrimary : buttonDanger} disabled={saving}>
          {saving ? t("common.saving") : decision === "approve" ? t("common.approve") : t("common.reject")}
        </button>
      </div>
    </form>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "danger" | "hazard" | "success" }) {
  const toneClass = tone === "danger" ? "text-danger-500" : tone === "hazard" ? "text-hazard-500" : tone === "success" ? "text-success-500" : "";
  return (
    <div className={`${cardClass} px-4 py-3`}>
      <div className="text-[10px] text-mine-400 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${toneClass}`}>{value}</div>
    </div>
  );
}

function AiInsightsPanel() {
  const { t } = useTranslation();
  const [data, setData] = useState<AiBudgetInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(refresh?: boolean) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get<AiBudgetInsight>("/ai/budget-insights", { params: refresh ? { refresh: "true" } : undefined });
      setData(res.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className={`${cardClass} p-4 text-sm text-mine-300`}>{t("common.loading")}</div>;
  if (!data) return null;

  return (
    <div className={`${cardClass} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("budgetPlanning.aiInsightsTitle")}</h3>
        {data.configured && (
          <button className={buttonSecondary} disabled={refreshing} onClick={() => load(true)}>
            {refreshing ? t("common.saving") : t("budgetPlanning.refreshInsights")}
          </button>
        )}
      </div>
      {!data.configured ? (
        <p className="text-xs text-mine-400">{t("ai.notConfigured")}</p>
      ) : (
        <>
          <p className="text-sm text-mine-200">{data.summary}</p>
          {data.riskFlags.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-mine-400 mb-1">{t("budgetPlanning.riskFlags")}</div>
              <div className="space-y-1.5">
                {data.riskFlags.map((r, i) => (
                  <div key={i} className="text-xs border-l-2 border-danger-500 pl-2">
                    <span className="font-semibold">{r.category}</span> — <span className="text-mine-300">{r.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.recommendations.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-mine-400 mb-1">{t("budgetPlanning.recommendations")}</div>
              <ul className="text-xs text-mine-300 list-disc pl-4 space-y-0.5">
                {data.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function BudgetPlanning() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const canApprove = user?.role === "ADMIN";
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | { mode: "create"; seed?: BudgetPlan } | { mode: "edit"; plan: BudgetPlan }>(null);
  const [reviewModal, setReviewModal] = useState<null | { plan: BudgetPlan; decision: "approve" | "reject" }>(null);
  const [spendingPlan, setSpendingPlan] = useState<BudgetPlan | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [p, sum, s] = await Promise.all([
        api.get<BudgetPlan[]>("/budget-plans"),
        api.get<BudgetSummary>("/budget-plans/summary"),
        api.get<Site[]>("/sites"),
      ]);
      setPlans(p.data);
      setSummary(sum.data);
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

  async function review(reviewNote?: string) {
    if (!reviewModal) return;
    await api.post(`/budget-plans/${reviewModal.plan.id}/${reviewModal.decision}`, { reviewNote });
    setReviewModal(null);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const money = (n: number) => `R ${Math.round(n).toLocaleString()}`;
  const categoryChartData = (summary?.byCategory ?? []).map((c) => ({ ...c, categoryLabel: t(`expenses.categories.${c.category}`) }));
  const siteChartData = summary?.bySite ?? [];

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

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label={t("budgetPlanning.totalBudgeted")} value={money(summary.totalBudgeted)} />
          <KpiCard label={t("budgetPlanning.totalActual")} value={money(summary.totalActual)} />
          <KpiCard
            label={t("budgetPlanning.totalVariance")}
            value={`${summary.totalVariance < 0 ? "−" : "+"}${money(Math.abs(summary.totalVariance))}`}
            tone={summary.totalVariance < 0 ? "danger" : "success"}
          />
          <KpiCard label={t("budgetPlanning.utilization")} value={`${summary.utilizationPct}%`} tone={summary.utilizationPct > 100 ? "danger" : summary.utilizationPct > 85 ? "hazard" : "success"} />
          <KpiCard label={t("budgetPlanning.overBudgetCount")} value={String(summary.overBudgetCount)} tone={summary.overBudgetCount > 0 ? "danger" : "success"} />
          <KpiCard label={t("budgetPlanning.pendingApprovalCount")} value={String(summary.statusCounts.PENDING_APPROVAL)} tone={summary.statusCounts.PENDING_APPROVAL > 0 ? "hazard" : undefined} />
        </div>
      )}

      {summary && summary.byCategory.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`${cardClass} p-4`}>
            <h3 className="text-sm font-semibold mb-3">{t("budgetPlanning.chartByCategory")}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData}>
                  <XAxis dataKey="categoryLabel" tick={CHART_TICK_STYLE} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={CHART_TICK_STYLE} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => money(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="budgeted" name={t("budgetPlanning.budgetedAmount")} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name={t("budgetPlanning.actualAmount")} fill="#c48a1f" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className={`${cardClass} p-4`}>
            <h3 className="text-sm font-semibold mb-3">{t("budgetPlanning.chartBySite")}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={siteChartData}>
                  <XAxis dataKey="site" tick={CHART_TICK_STYLE} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={CHART_TICK_STYLE} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => money(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="budgeted" name={t("budgetPlanning.budgetedAmount")} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name={t("budgetPlanning.actualAmount")} fill="#c48a1f" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <AiInsightsPanel />

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
            { key: "status", header: t("common.status"), render: (p) => <StatusBadge status={p.status} />, sortValue: (p) => p.status },
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
          { header: t("common.status"), value: (p) => p.status },
        ]}
        actions={(p) => (
          <div className="flex justify-end gap-2">
            <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setSpendingPlan(p)}>{t("budgetPlanning.viewSpending")}</button>
            {canApprove && p.status === "PENDING_APPROVAL" && (
              <>
                <button className="text-xs text-success-500 hover:text-success-400" onClick={() => setReviewModal({ plan: p, decision: "approve" })}>
                  {t("common.approve")}
                </button>
                <button className="text-xs text-danger-500 hover:text-danger-400" onClick={() => setReviewModal({ plan: p, decision: "reject" })}>
                  {t("common.reject")}
                </button>
              </>
            )}
            {canEdit && (
              <>
                <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal({ mode: "edit", plan: p })}>{t("common.edit")}</button>
                <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal({ mode: "create", seed: p })}>{t("budgetPlanning.duplicate")}</button>
                <button className={buttonDanger} onClick={() => remove(p.id)}>{t("common.delete")}</button>
              </>
            )}
          </div>
        )}
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

      {reviewModal && (
        <Modal
          title={reviewModal.decision === "approve" ? t("budgetPlanning.approveTitle") : t("budgetPlanning.rejectTitle")}
          onClose={() => setReviewModal(null)}
        >
          <ReviewForm decision={reviewModal.decision} onSubmit={review} onCancel={() => setReviewModal(null)} />
        </Modal>
      )}

      {spendingPlan && <SpendingModal plan={spendingPlan} onClose={() => setSpendingPlan(null)} />}
    </div>
  );
}
