import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api, API_URL } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { CostSummary, Expense, ExpenseCategory, ExpenseStatus, Payee, PayeeType, PaymentMethod, Site } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import FileDropzone from "../components/FileDropzone";
import DataTable, { DataTableColumn } from "../components/DataTable";
import { AuditHistoryButton } from "../components/AuditHistoryPanel";
import SummaryCards from "../components/SummaryCards";
import LoadError from "../components/LoadError";

const CHART_TOOLTIP_STYLE = { background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 11 };
const CHART_TICK_STYLE = { fontSize: 9, fill: "#52525b" };
const CATEGORY_COLORS = ["#c48a1f", "#8a9ab5", "#16a34a", "#e13b2e", "#f3665b", "#5b7092", "#d9a441", "#3f5a7d", "#7a8a5a", "#9a6b3f", "#6b6b6b"];

const expenseCategories: ExpenseCategory[] = [
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
const paymentMethods: PaymentMethod[] = ["EFT", "CASH", "CHEQUE", "CARD", "OTHER"];
const payeeTypes: PayeeType[] = ["COMPANY", "INDIVIDUAL", "BUYER", "CONTRACTOR"];
// Includes the two auto-synced types (EMPLOYEE from Worker/Executive records, SUPPLIER
// from the procurement Supplier register) — not offered as manual-creation options above,
// but needed here so the payee list can be filtered/grouped by every type that actually
// exists, not just the manually-creatable ones.
const ALL_PAYEE_TYPES: PayeeType[] = ["COMPANY", "INDIVIDUAL", "BUYER", "CONTRACTOR", "EMPLOYEE", "SUPPLIER"];

type TabKey = "expenses" | "payees";
const TAB_KEYS: TabKey[] = ["expenses", "payees"];

function ExpenseForm({ sites, payees, initial, onSubmit, onCancel }: {
  sites: Site[];
  payees: Payee[];
  initial?: Expense;
  onSubmit: (form: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [payeeId, setPayeeId] = useState(initial?.payeeId ?? payees[0]?.id ?? "");
  const [expenseNumber, setExpenseNumber] = useState(initial?.expenseNumber ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? "OPERATIONS");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [expenseDate, setExpenseDate] = useState(initial?.expenseDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initial?.paymentMethod ?? "EFT");
  const [referenceNumber, setReferenceNumber] = useState(initial?.referenceNumber ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const form = new FormData();
      form.append("siteId", siteId);
      form.append("payeeId", payeeId);
      form.append("expenseNumber", expenseNumber);
      form.append("category", category);
      form.append("description", description);
      form.append("amount", amount);
      form.append("expenseDate", expenseDate);
      form.append("paymentMethod", paymentMethod);
      if (referenceNumber) form.append("referenceNumber", referenceNumber);
      if (notes) form.append("notes", notes);
      if (receipt) form.append("receipt", receipt);
      await onSubmit(form);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("expenses.createError"));
    } finally {
      setSaving(false);
    }
  }

  if (payees.length === 0) {
    return <div className="text-mine-300 text-sm">{t("expenses.registerPayeeFirst")}</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("expenses.expenseNumber")}</label>
          <input className={inputClass} value={expenseNumber} onChange={(e) => setExpenseNumber(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("expenses.payee")}</label>
        <select className={selectClass} value={payeeId} onChange={(e) => setPayeeId(e.target.value)}>
          {payees.map((p) => <option key={p.id} value={p.id}>{p.name} ({t(`expenses.payeeTypes.${p.payeeType}`)})</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("expenses.category")}</label>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {expenseCategories.map((c) => <option key={c} value={c}>{t(`expenses.categories.${c}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("expenses.amount")}</label>
          <input className={inputClass} type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("expenses.expenseDate")}</label>
          <DateField value={expenseDate} onChange={setExpenseDate} required />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("expenses.paymentMethod")}</label>
          <select className={selectClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            {paymentMethods.map((m) => <option key={m} value={m}>{t(`expenses.paymentMethods.${m}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("expenses.referenceNumber")}</label>
          <input className={inputClass} value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("expenses.receipt")}</label>
        <FileDropzone accept="image/*,.pdf" hint={t("expenses.receiptHint")} onFiles={(files) => setReceipt(files.item(0))} />
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <p className="text-xs text-mine-400">{t("expenses.pendingApprovalHint")}</p>
      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function PayeeForm({ initial, onSubmit, onCancel }: {
  initial?: Payee;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [payeeType, setPayeeType] = useState<PayeeType>(initial?.payeeType ?? "COMPANY");
  const [name, setName] = useState(initial?.name ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(initial?.registrationNumber ?? "");
  const [taxNumber, setTaxNumber] = useState(initial?.taxNumber ?? "");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [bankAccountHolder, setBankAccountHolder] = useState(initial?.bankAccountHolder ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState(initial?.bankAccountNumber ?? "");
  const [bankBranchCode, setBankBranchCode] = useState(initial?.bankBranchCode ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const isAutoSynced = initial?.payeeType === "EMPLOYEE" || initial?.payeeType === "SUPPLIER";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        // Auto-synced payees (linked to a Worker/Executive or a Supplier record) have
        // their type and name managed automatically — omit payeeType entirely on save
        // rather than resubmitting a value the create-only dropdown below can't represent,
        // which would otherwise either fail validation (SUPPLIER) or silently mismatch.
        payeeType: isAutoSynced ? undefined : payeeType,
        name,
        registrationNumber: registrationNumber || undefined,
        taxNumber: taxNumber || undefined,
        contactName: contactName || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        bankName: bankName || undefined,
        bankAccountHolder: bankAccountHolder || undefined,
        bankAccountNumber: bankAccountNumber || undefined,
        bankBranchCode: bankBranchCode || undefined,
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
          <label className={labelClass}>{t("expenses.payeeType")}</label>
          {isAutoSynced ? (
            <div className={`${inputClass} bg-mine-800/40 text-mine-300 cursor-not-allowed`} title={t("expenses.payeeTypeAutoSyncedHint") ?? ""}>
              {t(`expenses.payeeTypes.${initial!.payeeType}`)}
            </div>
          ) : (
            <select className={selectClass} value={payeeType} onChange={(e) => setPayeeType(e.target.value as PayeeType)}>
              {payeeTypes.map((p) => <option key={p} value={p}>{t(`expenses.payeeTypes.${p}`)}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className={labelClass}>{t("expenses.payeeName")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("buyerRegister.registrationNumber")}</label>
          <input className={inputClass} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("buyerRegister.taxNumber")}</label>
          <input className={inputClass} value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("buyerRegister.contactName")}</label>
          <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("buyerRegister.contactEmail")}</label>
          <input className={inputClass} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("buyerRegister.contactPhone")}</label>
          <input className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
      </div>
      <div className="text-xs font-semibold text-mine-300 uppercase pt-2 border-t border-mine-800">{t("expenses.bankingDetails")}</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("buyerRegister.bankName")}</label>
          <input className={inputClass} value={bankName} onChange={(e) => setBankName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("buyerRegister.bankAccountHolder")}</label>
          <input className={inputClass} value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("buyerRegister.bankAccountNumber")}</label>
          <input className={inputClass} value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("buyerRegister.bankBranchCode")}</label>
          <input className={inputClass} value={bankBranchCode} onChange={(e) => setBankBranchCode(e.target.value)} />
        </div>
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

export default function Expenses() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const canApprove =
    user?.role === "ADMIN" ||
    (user?.role === "EXECUTIVE" && (user?.title === "CFO" || user?.title === "GENERAL_MANAGER" || user?.title === "COO"));
  const initialTab = TAB_KEYS.includes(searchParams.get("tab") as TabKey) ? (searchParams.get("tab") as TabKey) : "expenses";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [expenseModal, setExpenseModal] = useState<null | "create" | Expense>(null);
  const [payeeModal, setPayeeModal] = useState<null | "create" | Payee>(null);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [payeeTypeFilter, setPayeeTypeFilter] = useState<PayeeType | "ALL">("ALL");

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [e, p, s, c] = await Promise.all([
        api.get<Expense[]>("/expenses"),
        api.get<Payee[]>("/payees"),
        api.get<Site[]>("/sites"),
        api.get<CostSummary>("/expenses/cost-summary", { params: { months: 6 } }),
      ]);
      setExpenses(e.data);
      setPayees(p.data);
      setSites(s.data);
      setCostSummary(c.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createExpense(form: FormData) {
    await api.post("/expenses", form, { headers: { "Content-Type": "multipart/form-data" } });
    setExpenseModal(null);
    await load();
  }

  async function updateExpense(id: string, form: FormData) {
    await api.put(`/expenses/${id}`, form, { headers: { "Content-Type": "multipart/form-data" } });
    setExpenseModal(null);
    await load();
  }

  async function removeExpense(id: string) {
    if (!confirm(t("expenses.confirmDelete"))) return;
    await api.delete(`/expenses/${id}`);
    await load();
  }

  async function reviewExpense(id: string, decision: Extract<ExpenseStatus, "PAID" | "CANCELLED">) {
    if (decision === "PAID") {
      if (!confirm(t("expenses.confirmApprove"))) return;
      await api.post(`/expenses/${id}/review`, { decision });
    } else {
      const note = window.prompt(t("expenses.rejectReasonPrompt") ?? "") ?? undefined;
      await api.post(`/expenses/${id}/review`, { decision, note });
    }
    await load();
  }

  async function exportPdf() {
    setExportingPdf(true);
    try {
      await api.post("/expenses/export-pdf");
      navigate("/documents");
    } finally {
      setExportingPdf(false);
    }
  }

  async function createPayee(data: any) {
    await api.post("/payees", data);
    setPayeeModal(null);
    await load();
  }

  async function updatePayee(id: string, data: any) {
    await api.put(`/payees/${id}`, data);
    setPayeeModal(null);
    await load();
  }

  async function removePayee(id: string) {
    if (!confirm(t("expenses.confirmDeletePayee"))) return;
    try {
      await api.delete(`/payees/${id}`);
      await load();
    } catch (err: any) {
      alert(err.response?.data?.error ?? t("expenses.deletePayeeError"));
    }
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.status === "PAID" ? e.amount : 0), 0);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("expenses.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("expenses.subtitle")}</p>
        </div>
        {canEdit && tab === "expenses" && (
          <div className="flex items-center gap-2">
            <button className={buttonSecondary} disabled={exportingPdf} onClick={exportPdf}>
              {exportingPdf ? t("common.saving") : t("expenses.exportPdf")}
            </button>
            {sites.length > 0 && (
              <button className={buttonPrimary} onClick={() => setExpenseModal("create")}>{t("expenses.newExpense")}</button>
            )}
          </div>
        )}
        {canEdit && tab === "payees" && (
          <button className={buttonPrimary} onClick={() => setPayeeModal("create")}>{t("expenses.newPayee")}</button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className={tab === "expenses" ? buttonPrimary : buttonSecondary} onClick={() => setTab("expenses")}>
          {t("expenses.tabExpenses")}
        </button>
        <button className={tab === "payees" ? buttonPrimary : buttonSecondary} onClick={() => setTab("payees")}>
          {t("expenses.tabPayees")}
        </button>
      </div>

      {tab === "expenses" && (
        <>
          {costSummary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className={`${cardClass} px-4 py-3`}>
                  <div className="text-[10px] text-mine-400 uppercase tracking-wide">{t("expenses.tabExpenses")}</div>
                  <div className="text-lg font-bold mt-0.5">{costSummary.totals.expenses.toLocaleString()}</div>
                </div>
                <div className={`${cardClass} px-4 py-3`}>
                  <div className="text-[10px] text-mine-400 uppercase tracking-wide">{t("maintenance.nav")}</div>
                  <div className="text-lg font-bold mt-0.5">{costSummary.totals.maintenance.toLocaleString()}</div>
                </div>
                <div className={`${cardClass} px-4 py-3`}>
                  <div className="text-[10px] text-mine-400 uppercase tracking-wide">{t("payroll.nav")}</div>
                  <div className="text-lg font-bold mt-0.5">{costSummary.totals.payroll.toLocaleString()}</div>
                </div>
                <div className={`${cardClass} px-4 py-3 border-hazard-500/40`}>
                  <div className="text-[10px] text-mine-400 uppercase tracking-wide">{t("expenses.totalCosts")}</div>
                  <div className="text-lg font-bold mt-0.5 text-hazard-500">{costSummary.totals.grandTotal.toLocaleString()}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className={`${cardClass} p-4`}>
                  <h3 className="text-sm font-semibold mb-3">{t("expenses.costsBySource")}</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={costSummary.months}>
                        <XAxis dataKey="month" tick={CHART_TICK_STYLE} tickFormatter={(m: string) => m.slice(2)} />
                        <YAxis tick={CHART_TICK_STYLE} />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="expenses" name={t("expenses.tabExpenses")} stackId="cost" fill="#c48a1f" />
                        <Bar dataKey="maintenance" name={t("maintenance.nav")} stackId="cost" fill="#5b7092" />
                        <Bar dataKey="payroll" name={t("payroll.nav")} stackId="cost" fill="#e13b2e" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className={`${cardClass} p-4`}>
                  <h3 className="text-sm font-semibold mb-3">{t("expenses.byCategory")}</h3>
                  {costSummary.byCategory.length === 0 ? (
                    <div className="text-mine-400 text-xs h-56 flex items-center justify-center">{t("expenses.noneYet")}</div>
                  ) : (
                    <div className="h-56 flex items-center gap-4">
                      <div className="w-36 h-36 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={costSummary.byCategory} dataKey="amount" nameKey="category" innerRadius={36} outerRadius={64} paddingAngle={2}>
                              {costSummary.byCategory.map((d, i) => (
                                <Cell key={d.category} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => v.toLocaleString()} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-1 text-xs flex-1 min-w-0 max-h-56 overflow-y-auto">
                        {costSummary.byCategory.map((d, i) => (
                          <div key={d.category} className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-mine-300 truncate">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                              {t(`expenses.categories.${d.category}`)}
                            </span>
                            <span className="font-semibold text-mine-50">{d.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className={`${cardClass} p-4 flex items-center gap-2`}>
            <span className="text-mine-400 text-xs uppercase">{t("expenses.totalPaid")}</span>
            <span className="text-lg font-bold">{totalExpenses.toLocaleString()}</span>
          </div>

          <DataTable
            columns={
              [
                { key: "number", header: t("expenses.expenseNumber"), render: (ex) => <span className="font-medium">{ex.expenseNumber}</span>, sortValue: (ex) => ex.expenseNumber },
                {
                  key: "payee",
                  header: t("expenses.payee"),
                  render: (ex) => (
                    <>
                      {ex.payee?.name}
                      {ex.payslipId && <span className="ml-2 text-[10px] uppercase tracking-wide text-mine-400 border border-mine-700 rounded px-1 py-0.5">{t("expenses.payslipLinked")}</span>}
                      {ex.purchaseOrderId && <span className="ml-2 text-[10px] uppercase tracking-wide text-mine-400 border border-mine-700 rounded px-1 py-0.5">{t("expenses.purchaseOrderLinked")}</span>}
                      {ex.maintenanceScheduleId && <span className="ml-2 text-[10px] uppercase tracking-wide text-mine-400 border border-mine-700 rounded px-1 py-0.5">{t("expenses.maintenanceLinked")}</span>}
                      {ex.contractBidId && <span className="ml-2 text-[10px] uppercase tracking-wide text-mine-400 border border-mine-700 rounded px-1 py-0.5">{t("expenses.contractLinked")}</span>}
                      {ex.executiveRequestId && <span className="ml-2 text-[10px] uppercase tracking-wide text-mine-400 border border-mine-700 rounded px-1 py-0.5">{t("expenses.requestLinked")}</span>}
                    </>
                  ),
                  sortValue: (ex) => ex.payee?.name ?? "",
                },
                { key: "category", header: t("expenses.category"), render: (ex) => t(`expenses.categories.${ex.category}`), sortValue: (ex) => ex.category },
                { key: "date", header: t("expenses.expenseDate"), render: (ex) => new Date(ex.expenseDate).toLocaleDateString(), sortValue: (ex) => ex.expenseDate },
                { key: "amount", header: t("expenses.amount"), render: (ex) => `${ex.currency} ${ex.amount.toLocaleString()}`, sortValue: (ex) => ex.amount },
                { key: "status", header: t("common.status"), render: (ex) => <StatusBadge status={ex.status} />, sortValue: (ex) => ex.status },
              ] as DataTableColumn<Expense>[]
            }
            rows={expenses}
            rowKey={(ex) => ex.id}
            emptyMessage={t("expenses.noneYet")}
            searchValue={(ex) => `${ex.expenseNumber} ${ex.payee?.name ?? ""}`}
            exportFilename="expenses"
            exportColumns={[
              { header: t("expenses.expenseNumber"), value: (ex) => ex.expenseNumber },
              { header: t("expenses.payee"), value: (ex) => ex.payee?.name ?? "" },
              { header: t("expenses.category"), value: (ex) => ex.category },
              { header: t("expenses.expenseDate"), value: (ex) => ex.expenseDate },
              { header: t("expenses.amount"), value: (ex) => ex.amount },
              { header: t("common.status"), value: (ex) => ex.status },
            ]}
            actions={(ex) => (
              <div className="flex justify-end gap-2">
                {ex.documentId && (
                  <a
                    className="text-xs text-mine-300 hover:text-mine-50"
                    href={`${API_URL}/api/documents/${ex.documentId}/download`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("expenses.viewReceipt")}
                  </a>
                )}
                <AuditHistoryButton entityType="Expense" entityId={ex.id} />
                {canEdit && ex.status === "PENDING" && (
                  <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setExpenseModal(ex)}>{t("common.edit")}</button>
                )}
                {canApprove && ex.status === "PENDING" && (
                  <>
                    <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => reviewExpense(ex.id, "PAID")}>
                      {t("expenses.approve")}
                    </button>
                    <button className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => reviewExpense(ex.id, "CANCELLED")}>
                      {t("expenses.reject")}
                    </button>
                  </>
                )}
                {canDelete && (
                  <button className={buttonDanger} onClick={() => removeExpense(ex.id)}>{t("common.delete")}</button>
                )}
              </div>
            )}
          />
        </>
      )}

      {tab === "payees" && (
        <>
          <SummaryCards
            cards={ALL_PAYEE_TYPES.map((type) => ({
              label: t(`expenses.payeeTypes.${type}`),
              value: payees.filter((p) => p.payeeType === type).length,
            }))}
          />
          <div className="flex gap-2 flex-wrap">
            <button
              className={payeeTypeFilter === "ALL" ? buttonPrimary : buttonSecondary}
              onClick={() => setPayeeTypeFilter("ALL")}
            >
              {t("expenses.allPayeeTypes")} ({payees.length})
            </button>
            {ALL_PAYEE_TYPES.map((type) => {
              const count = payees.filter((p) => p.payeeType === type).length;
              if (count === 0) return null;
              return (
                <button
                  key={type}
                  className={payeeTypeFilter === type ? buttonPrimary : buttonSecondary}
                  onClick={() => setPayeeTypeFilter(type)}
                >
                  {t(`expenses.payeeTypes.${type}`)} ({count})
                </button>
              );
            })}
          </div>
          <DataTable
          columns={
            [
              { key: "name", header: t("expenses.payeeName"), render: (p) => <span className="font-medium">{p.name}</span>, sortValue: (p) => p.name },
              { key: "type", header: t("expenses.payeeType"), render: (p) => t(`expenses.payeeTypes.${p.payeeType}`), sortValue: (p) => p.payeeType },
              { key: "email", header: t("buyerRegister.contactEmail"), render: (p) => p.contactEmail ?? "—", sortValue: (p) => p.contactEmail ?? "" },
              { key: "phone", header: t("buyerRegister.contactPhone"), render: (p) => p.contactPhone ?? "—" },
              { key: "expenseCount", header: t("expenses.expenseCount"), render: (p) => p._count?.expenses ?? 0, sortValue: (p) => p._count?.expenses ?? 0 },
            ] as DataTableColumn<Payee>[]
          }
          rows={payeeTypeFilter === "ALL" ? payees : payees.filter((p) => p.payeeType === payeeTypeFilter)}
          rowKey={(p) => p.id}
          emptyMessage={t("expenses.noPayeesYet")}
          searchValue={(p) => `${p.name} ${p.contactEmail ?? ""}`}
          actions={(p) => (
            <div className="flex justify-end gap-2">
              {canEdit && (
                <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setPayeeModal(p)}>{t("common.edit")}</button>
              )}
              {canDelete && (
                <button className={buttonDanger} onClick={() => removePayee(p.id)}>{t("common.delete")}</button>
              )}
            </div>
          )}
          />
        </>
      )}

      {expenseModal && (
        <Modal title={expenseModal === "create" ? t("expenses.newExpenseTitle") : t("expenses.editExpenseTitle")} onClose={() => setExpenseModal(null)}>
          <ExpenseForm
            sites={sites}
            payees={payees}
            initial={expenseModal === "create" ? undefined : expenseModal}
            onSubmit={(form) => (expenseModal === "create" ? createExpense(form) : updateExpense(expenseModal.id, form))}
            onCancel={() => setExpenseModal(null)}
          />
        </Modal>
      )}

      {payeeModal && (
        <Modal title={payeeModal === "create" ? t("expenses.newPayeeTitle") : t("expenses.editPayeeTitle")} onClose={() => setPayeeModal(null)}>
          <PayeeForm
            initial={payeeModal === "create" ? undefined : payeeModal}
            onSubmit={(data) => (payeeModal === "create" ? createPayee(data) : updatePayee(payeeModal.id, data))}
            onCancel={() => setPayeeModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
