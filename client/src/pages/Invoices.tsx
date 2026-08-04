import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Invoice, InvoiceStatus, Mine, Site } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

const invoiceStatuses: InvoiceStatus[] = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"];

function InvoiceForm({ sites, onSubmit, onCancel }: {
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientTaxNumber, setClientTaxNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [vatRate, setVatRate] = useState("15");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ description: "", quantity: "1", unitPrice: "0" }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateLine(i: number, field: string, value: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { description: "", quantity: "1", unitPrice: "0" }]);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const subtotal = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const vatAmount = subtotal * ((Number(vatRate) || 0) / 100);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        invoiceNumber,
        clientName,
        clientAddress: clientAddress || undefined,
        clientEmail: clientEmail || undefined,
        clientTaxNumber: clientTaxNumber || undefined,
        dueDate,
        vatRate: Number(vatRate),
        notes: notes || undefined,
        lines: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
      });
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("invoices.createError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={inputClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("invoices.invoiceNumber")}</label>
          <input className={inputClass} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("invoices.clientName")}</label>
          <input className={inputClass} value={clientName} onChange={(e) => setClientName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("invoices.clientEmail")}</label>
          <input className={inputClass} type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("invoices.clientAddress")}</label>
        <textarea className={inputClass} rows={2} value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("invoices.clientTaxNumber")}</label>
          <input className={inputClass} value={clientTaxNumber} onChange={(e) => setClientTaxNumber(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("invoices.dueDate")}</label>
          <input className={inputClass} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("invoices.vatRate")}</label>
          <input className={inputClass} type="number" step="any" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2 border border-mine-800 rounded-md p-3">
        <div className="text-xs font-semibold text-mine-300 uppercase">{t("invoices.lineItems")}</div>
        {lines.map((l, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className={labelClass}>{t("procurement.itemDescription")}</label>
              <input className={inputClass} value={l.description} onChange={(e) => updateLine(i, "description", e.target.value)} required />
            </div>
            <div className="w-20">
              <label className={labelClass}>{t("inventory.quantity")}</label>
              <input className={inputClass} type="number" step="any" value={l.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} required />
            </div>
            <div className="w-24">
              <label className={labelClass}>{t("marketplace.pricePerUnit")}</label>
              <input className={inputClass} type="number" step="any" value={l.unitPrice} onChange={(e) => updateLine(i, "unitPrice", e.target.value)} required />
            </div>
            {lines.length > 1 && (
              <button type="button" className={buttonDanger} onClick={() => removeLine(i)}>{t("common.delete")}</button>
            )}
          </div>
        ))}
        <button type="button" className={`${buttonSecondary} text-xs px-3`} onClick={addLine}>{t("procurement.addLine")}</button>
        <div className="text-xs text-right pt-1 space-y-0.5">
          <div>{t("invoices.subtotal")}: {subtotal.toLocaleString()}</div>
          <div>{t("invoices.vatAmount")}: {vatAmount.toLocaleString()}</div>
          <div className="font-semibold text-sm">{t("invoices.total")}: {(subtotal + vatAmount).toLocaleString()}</div>
        </div>
      </div>

      <div>
        <label className={labelClass}>{t("invoices.notes")}</label>
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

function InvoiceView({ invoice, mine, onBack, onStatusChange }: {
  invoice: Invoice;
  mine: Mine | null;
  onBack: () => void;
  onStatusChange: (status: InvoiceStatus) => void;
}) {
  const { t } = useTranslation();
  const subtotal = invoice.lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const vatAmount = subtotal * (invoice.vatRate / 100);
  const total = subtotal + vatAmount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <button className={buttonSecondary} onClick={onBack}>{t("invoices.backToList")}</button>
        <div className="flex items-center gap-2">
          <select
            className={`${inputClass} text-xs py-1.5`}
            value={invoice.status}
            onChange={(e) => onStatusChange(e.target.value as InvoiceStatus)}
          >
            {invoiceStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
          <button className={buttonPrimary} onClick={() => window.print()}>{t("invoices.print")}</button>
        </div>
      </div>

      <div className={`${cardClass} p-8 space-y-6`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            {mine?.hasLogo ? (
              <img src={`${API_URL}/api/mines/${mine.id}/logo`} alt={mine.name} className="w-12 h-12 rounded object-contain bg-white p-1" />
            ) : (
              <span className="text-3xl">⛏</span>
            )}
            <div>
              <div className="text-lg font-bold">{mine?.name || "Mine Guard"}</div>
              <div className="text-xs text-mine-400">{invoice.site?.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold uppercase tracking-wide">{t("invoices.nav")}</div>
            <div className="text-sm text-mine-300">#{invoice.invoiceNumber}</div>
            <StatusBadge status={invoice.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-xs font-semibold text-mine-400 uppercase mb-1">{t("invoices.billTo")}</div>
            <div className="font-medium">{invoice.clientName}</div>
            {invoice.clientAddress && <div className="text-mine-300 whitespace-pre-line">{invoice.clientAddress}</div>}
            {invoice.clientEmail && <div className="text-mine-300">{invoice.clientEmail}</div>}
            {invoice.clientTaxNumber && <div className="text-mine-300">{t("invoices.clientTaxNumber")}: {invoice.clientTaxNumber}</div>}
          </div>
          <div className="text-right">
            <div><span className="text-mine-400">{t("invoices.issueDate")}:</span> {new Date(invoice.issueDate).toLocaleDateString()}</div>
            <div><span className="text-mine-400">{t("invoices.dueDate")}:</span> {new Date(invoice.dueDate).toLocaleDateString()}</div>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="border-b border-mine-800 text-mine-400 text-xs uppercase">
            <tr>
              <th className="text-left py-2">{t("procurement.itemDescription")}</th>
              <th className="text-right py-2">{t("inventory.quantity")}</th>
              <th className="text-right py-2">{t("marketplace.pricePerUnit")}</th>
              <th className="text-right py-2">{t("procurement.total")}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.id} className="border-b border-mine-800">
                <td className="py-2">{l.description}</td>
                <td className="py-2 text-right">{l.quantity}</td>
                <td className="py-2 text-right">{l.unitPrice.toLocaleString()}</td>
                <td className="py-2 text-right">{l.lineTotal.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-mine-400">{t("invoices.subtotal")}</span><span>{invoice.currency} {subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-mine-400">{t("invoices.vatAmount")} ({invoice.vatRate}%)</span><span>{invoice.currency} {vatAmount.toLocaleString()}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-mine-800 pt-1"><span>{t("invoices.total")}</span><span>{invoice.currency} {total.toLocaleString()}</span></div>
          </div>
        </div>

        {invoice.notes && (
          <div className="text-xs text-mine-400 border-t border-mine-800 pt-3">{invoice.notes}</div>
        )}
      </div>
    </div>
  );
}

export default function Invoices() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [mine, setMine] = useState<Mine | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [viewing, setViewing] = useState<Invoice | null>(null);

  async function load() {
    setLoading(true);
    const [i, s, m] = await Promise.all([
      api.get<Invoice[]>("/invoices"),
      api.get<Site[]>("/sites"),
      api.get<Mine>("/mines/mine"),
    ]);
    setInvoices(i.data);
    setSites(s.data);
    setMine(m.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/invoices", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("invoices.confirmDelete"))) return;
    await api.delete(`/invoices/${id}`);
    await load();
  }

  async function updateStatus(id: string, status: InvoiceStatus) {
    const res = await api.put<Invoice>(`/invoices/${id}`, { status });
    setViewing(res.data);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  if (viewing) {
    return (
      <InvoiceView
        invoice={viewing}
        mine={mine}
        onBack={() => setViewing(null)}
        onStatusChange={(status) => updateStatus(viewing.id, status)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("invoices.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("invoices.subtitle")}</p>
        </div>
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("invoices.newInvoice")}</button>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("invoices.invoiceNumber")}</th>
              <th className="text-left px-4 py-2">{t("invoices.clientName")}</th>
              <th className="text-left px-4 py-2">{t("invoices.dueDate")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">
                  <button className="hover:underline" onClick={() => setViewing(inv)}>{inv.invoiceNumber}</button>
                </td>
                <td className="px-4 py-2 text-mine-300">{inv.clientName}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(inv.dueDate).toLocaleDateString()}</td>
                <td className="px-4 py-2"><StatusBadge status={inv.status} /></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setViewing(inv)}>{t("invoices.viewInvoice")}</button>
                    {canDelete && (
                      <button className={buttonDanger} onClick={() => remove(inv.id)}>{t("common.delete")}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("invoices.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={t("invoices.newInvoiceTitle")} onClose={() => setModal(false)}>
          <InvoiceForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
