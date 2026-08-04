import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Expense, ExpenseCategory, ExpenseStatus, Payee, PayeeType, PaymentMethod, Site } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import FileDropzone from "../components/FileDropzone";

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
const expenseStatuses: ExpenseStatus[] = ["PENDING", "PAID", "CANCELLED"];
const paymentMethods: PaymentMethod[] = ["EFT", "CASH", "CHEQUE", "CARD", "OTHER"];
const payeeTypes: PayeeType[] = ["COMPANY", "INDIVIDUAL", "BUYER", "CONTRACTOR"];

type TabKey = "expenses" | "payees";

function ExpenseForm({ sites, payees, onSubmit, onCancel }: {
  sites: Site[];
  payees: Payee[];
  onSubmit: (form: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [payeeId, setPayeeId] = useState(payees[0]?.id ?? "");
  const [expenseNumber, setExpenseNumber] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("OPERATIONS");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFT");
  const [status, setStatus] = useState<ExpenseStatus>("PAID");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
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
      form.append("status", status);
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
      <div className="grid grid-cols-3 gap-3">
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
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("expenses.paymentMethod")}</label>
          <select className={selectClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            {paymentMethods.map((m) => <option key={m} value={m}>{t(`expenses.paymentMethods.${m}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ExpenseStatus)}>
            {expenseStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        payeeType,
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
          <select className={selectClass} value={payeeType} onChange={(e) => setPayeeType(e.target.value as PayeeType)}>
            {payeeTypes.map((p) => <option key={p} value={p}>{t(`expenses.payeeTypes.${p}`)}</option>)}
          </select>
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
      <div className="grid grid-cols-3 gap-3">
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
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<TabKey>("expenses");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [expenseModal, setExpenseModal] = useState(false);
  const [payeeModal, setPayeeModal] = useState<null | "create" | Payee>(null);

  async function load() {
    setLoading(true);
    const [e, p, s] = await Promise.all([
      api.get<Expense[]>("/expenses"),
      api.get<Payee[]>("/payees"),
      api.get<Site[]>("/sites"),
    ]);
    setExpenses(e.data);
    setPayees(p.data);
    setSites(s.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createExpense(form: FormData) {
    await api.post("/expenses", form, { headers: { "Content-Type": "multipart/form-data" } });
    setExpenseModal(false);
    await load();
  }

  async function removeExpense(id: string) {
    if (!confirm(t("expenses.confirmDelete"))) return;
    await api.delete(`/expenses/${id}`);
    await load();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("expenses.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("expenses.subtitle")}</p>
        </div>
        {canEdit && tab === "expenses" && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setExpenseModal(true)}>{t("expenses.newExpense")}</button>
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
          <div className={`${cardClass} p-4 flex items-center gap-2`}>
            <span className="text-mine-400 text-xs uppercase">{t("expenses.totalPaid")}</span>
            <span className="text-lg font-bold">{totalExpenses.toLocaleString()}</span>
          </div>

          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">{t("expenses.expenseNumber")}</th>
                  <th className="text-left px-4 py-2">{t("expenses.payee")}</th>
                  <th className="text-left px-4 py-2">{t("expenses.category")}</th>
                  <th className="text-left px-4 py-2">{t("expenses.expenseDate")}</th>
                  <th className="text-left px-4 py-2">{t("expenses.amount")}</th>
                  <th className="text-left px-4 py-2">{t("common.status")}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((ex) => (
                  <tr key={ex.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                    <td className="px-4 py-2 font-medium">{ex.expenseNumber}</td>
                    <td className="px-4 py-2 text-mine-300">{ex.payee?.name}</td>
                    <td className="px-4 py-2 text-mine-300">{t(`expenses.categories.${ex.category}`)}</td>
                    <td className="px-4 py-2 text-mine-300">{new Date(ex.expenseDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-mine-300">{ex.currency} {ex.amount.toLocaleString()}</td>
                    <td className="px-4 py-2"><StatusBadge status={ex.status} /></td>
                    <td className="px-4 py-2 text-right">
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
                        {canDelete && (
                          <button className={buttonDanger} onClick={() => removeExpense(ex.id)}>{t("common.delete")}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-mine-400">{t("expenses.noneYet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "payees" && (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">{t("expenses.payeeName")}</th>
                <th className="text-left px-4 py-2">{t("expenses.payeeType")}</th>
                <th className="text-left px-4 py-2">{t("buyerRegister.contactEmail")}</th>
                <th className="text-left px-4 py-2">{t("buyerRegister.contactPhone")}</th>
                <th className="text-left px-4 py-2">{t("expenses.expenseCount")}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {payees.map((p) => (
                <tr key={p.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-mine-300">{t(`expenses.payeeTypes.${p.payeeType}`)}</td>
                  <td className="px-4 py-2 text-mine-300">{p.contactEmail ?? "—"}</td>
                  <td className="px-4 py-2 text-mine-300">{p.contactPhone ?? "—"}</td>
                  <td className="px-4 py-2 text-mine-300">{p._count?.expenses ?? 0}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {canEdit && (
                        <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setPayeeModal(p)}>{t("common.edit")}</button>
                      )}
                      {canDelete && (
                        <button className={buttonDanger} onClick={() => removePayee(p.id)}>{t("common.delete")}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {payees.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("expenses.noPayeesYet")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {expenseModal && (
        <Modal title={t("expenses.newExpenseTitle")} onClose={() => setExpenseModal(false)}>
          <ExpenseForm sites={sites} payees={payees} onSubmit={createExpense} onCancel={() => setExpenseModal(false)} />
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
