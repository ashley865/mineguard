interface InvoiceLineLike {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface InvoiceLike {
  invoiceNumber: string;
  clientName: string;
  clientAddress?: string | null;
  clientEmail?: string | null;
  clientTaxNumber?: string | null;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  vatRate: number;
  notes?: string | null;
  status: string;
  lines: InvoiceLineLike[];
}

interface MineLike {
  name: string;
  registrationNumber?: string | null;
  logoDataUri?: string | null;
  bankName?: string | null;
  bankAccountHolder?: string | null;
  bankAccountNumber?: string | null;
  bankBranchCode?: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: "#e5e7eb", fg: "#374151" },
  SENT: { bg: "#fdf1d6", fg: "#92650a" },
  PAID: { bg: "#dcf5e6", fg: "#15803d" },
  OVERDUE: { bg: "#fbe1de", fg: "#b91c1c" },
  CANCELLED: { bg: "#e5e7eb", fg: "#6b7280" },
};

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderInvoiceHtml(invoice: InvoiceLike, mine: MineLike, siteName: string) {
  const subtotal = invoice.lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const vatAmount = subtotal * (invoice.vatRate / 100);
  const total = subtotal + vatAmount;
  const money = (n: number) => `${invoice.currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const statusColor = STATUS_COLORS[invoice.status] ?? STATUS_COLORS.DRAFT;

  const rows = invoice.lines
    .map(
      (l, i) => `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#fafafa"};">
        <td style="padding:10px 12px;border-bottom:1px solid #eceff3;">${esc(l.description)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eceff3;text-align:right;">${l.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eceff3;text-align:right;">${money(l.unitPrice)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eceff3;text-align:right;font-weight:600;">${money(l.lineTotal)}</td>
      </tr>`
    )
    .join("");

  const hasBankingDetails = mine.bankName || mine.bankAccountHolder || mine.bankAccountNumber || mine.bankBranchCode;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice ${esc(invoice.invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Arial, Helvetica, sans-serif; color: #1c2536; margin: 0; background: #f4f5f7; }
  .sheet { max-width: 760px; margin: 0 auto; background: #ffffff; }
  .accent { height: 8px; background: linear-gradient(90deg, #c48a1f, #d9a441); }
  .content { padding: 36px 40px 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; gap: 16px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { width: 52px; height: 52px; object-fit: contain; border-radius: 8px; border: 1px solid #eceff3; }
  .mine { font-size: 19px; font-weight: 700; letter-spacing: -0.01em; }
  .site { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .invtitle { font-size: 22px; font-weight: 800; text-align: right; text-transform: uppercase; letter-spacing: 0.03em; color: #c48a1f; }
  .invnum { font-size: 13px; color: #6b7280; text-align: right; margin-top: 2px; }
  .status { display: inline-block; margin-top: 8px; padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; background: ${statusColor.bg}; color: ${statusColor.fg}; }
  .grid { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 13px; gap: 24px; }
  .grid > div { flex: 1; }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 6px; font-weight: 600; }
  .billto-name { font-weight: 700; font-size: 14px; }
  .meta-box { background: #f8f9fb; border: 1px solid #eceff3; border-radius: 10px; padding: 14px 16px; }
  .meta-row { display: flex; justify-content: space-between; font-size: 12.5px; padding: 3px 0; }
  .meta-row span:first-child { color: #6b7280; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px; border: 1px solid #eceff3; border-radius: 10px; overflow: hidden; }
  th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; background: #f8f9fb; padding: 10px 12px; border-bottom: 1px solid #eceff3; }
  th.right { text-align: right; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 8px; }
  .totals-box { width: 260px; background: #f8f9fb; border: 1px solid #eceff3; border-radius: 10px; padding: 14px 16px; }
  .totals .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; color: #4b5563; }
  .totals .total { font-weight: 800; font-size: 16px; color: #1c2536; border-top: 1px solid #dde1e8; padding-top: 8px; margin-top: 6px; }
  .payment { margin-top: 28px; background: #fdf8ec; border: 1px solid #f1e2bb; border-radius: 10px; padding: 16px 18px; }
  .payment .label { color: #92650a; }
  .payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 12.5px; }
  .payment-grid .k { color: #92650a; }
  .notes { margin-top: 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #eceff3; padding-top: 14px; white-space: pre-line; }
  .footer { margin-top: 32px; text-align: center; font-size: 10.5px; color: #b0b6c0; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="accent"></div>
    <div class="content">
      <div class="header">
        <div class="brand">
          ${mine.logoDataUri ? `<img src="${mine.logoDataUri}" alt="${esc(mine.name)}" />` : ""}
          <div>
            <div class="mine">${esc(mine.name)}</div>
            <div class="site">${esc(siteName)}${mine.registrationNumber ? ` · Reg. ${esc(mine.registrationNumber)}` : ""}</div>
          </div>
        </div>
        <div>
          <div class="invtitle">Invoice</div>
          <div class="invnum">#${esc(invoice.invoiceNumber)}</div>
          <div style="text-align:right;"><span class="status">${esc(invoice.status)}</span></div>
        </div>
      </div>

      <div class="grid">
        <div>
          <div class="label">Bill To</div>
          <div class="billto-name">${esc(invoice.clientName)}</div>
          ${invoice.clientAddress ? `<div style="white-space:pre-line;color:#4b5563;font-size:12.5px;margin-top:2px;">${esc(invoice.clientAddress)}</div>` : ""}
          ${invoice.clientEmail ? `<div style="color:#4b5563;font-size:12.5px;">${esc(invoice.clientEmail)}</div>` : ""}
          ${invoice.clientTaxNumber ? `<div style="color:#4b5563;font-size:12.5px;">Tax No: ${esc(invoice.clientTaxNumber)}</div>` : ""}
        </div>
        <div class="meta-box">
          <div class="meta-row"><span>Issue Date</span><span>${invoice.issueDate.toLocaleDateString()}</span></div>
          <div class="meta-row"><span>Due Date</span><span style="font-weight:600;">${invoice.dueDate.toLocaleDateString()}</span></div>
          <div class="meta-row"><span>Currency</span><span>${esc(invoice.currency)}</span></div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="right">Qty</th>
            <th class="right">Unit Price</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-box">
          <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
          <div class="row"><span>VAT (${invoice.vatRate}%)</span><span>${money(vatAmount)}</span></div>
          <div class="row total"><span>Total Due</span><span>${money(total)}</span></div>
        </div>
      </div>

      ${
        hasBankingDetails
          ? `<div class="payment">
        <div class="label">Payment Details</div>
        <div class="payment-grid">
          ${mine.bankName ? `<div><span class="k">Bank:</span> ${esc(mine.bankName)}</div>` : ""}
          ${mine.bankAccountHolder ? `<div><span class="k">Account Holder:</span> ${esc(mine.bankAccountHolder)}</div>` : ""}
          ${mine.bankAccountNumber ? `<div><span class="k">Account Number:</span> ${esc(mine.bankAccountNumber)}</div>` : ""}
          ${mine.bankBranchCode ? `<div><span class="k">Branch Code:</span> ${esc(mine.bankBranchCode)}</div>` : ""}
        </div>
      </div>`
          : ""
      }

      ${invoice.notes ? `<div class="notes">${esc(invoice.notes)}</div>` : ""}

      <div class="footer">Generated by Mine Guard</div>
    </div>
  </div>
</body>
</html>`;
}
