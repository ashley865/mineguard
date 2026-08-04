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

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderInvoiceHtml(invoice: InvoiceLike, mineName: string, siteName: string) {
  const subtotal = invoice.lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const vatAmount = subtotal * (invoice.vatRate / 100);
  const total = subtotal + vatAmount;
  const money = (n: number) => `${invoice.currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const rows = invoice.lines
    .map(
      (l) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e5e5e5;">${esc(l.description)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e5e5;text-align:right;">${l.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e5e5;text-align:right;">${money(l.unitPrice)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e5e5;text-align:right;">${money(l.lineTotal)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice ${esc(invoice.invoiceNumber)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1c2536; padding: 32px; max-width: 720px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .mine { font-size: 18px; font-weight: bold; }
  .site { font-size: 12px; color: #666; }
  .invtitle { font-size: 20px; font-weight: bold; text-align: right; text-transform: uppercase; }
  .invnum { font-size: 13px; color: #666; text-align: right; }
  .status { display: inline-block; margin-top: 4px; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: #eef1f6; }
  .grid { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ccc; padding-bottom: 6px; }
  th.right { text-align: right; }
  .totals { display: flex; justify-content: flex-end; }
  .totals div { width: 220px; }
  .totals .row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 13px; }
  .totals .total { font-weight: bold; font-size: 15px; border-top: 1px solid #ccc; padding-top: 6px; margin-top: 4px; }
  .notes { margin-top: 24px; font-size: 12px; color: #666; border-top: 1px solid #e5e5e5; padding-top: 12px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="mine">${esc(mineName)}</div>
      <div class="site">${esc(siteName)}</div>
    </div>
    <div>
      <div class="invtitle">Invoice</div>
      <div class="invnum">#${esc(invoice.invoiceNumber)}</div>
      <div style="text-align:right;"><span class="status">${esc(invoice.status)}</span></div>
    </div>
  </div>

  <div class="grid">
    <div>
      <div style="font-size:11px;text-transform:uppercase;color:#666;margin-bottom:4px;">Bill To</div>
      <div style="font-weight:600;">${esc(invoice.clientName)}</div>
      ${invoice.clientAddress ? `<div style="white-space:pre-line;color:#444;">${esc(invoice.clientAddress)}</div>` : ""}
      ${invoice.clientEmail ? `<div style="color:#444;">${esc(invoice.clientEmail)}</div>` : ""}
      ${invoice.clientTaxNumber ? `<div style="color:#444;">Tax No: ${esc(invoice.clientTaxNumber)}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div>Issue Date: ${invoice.issueDate.toLocaleDateString()}</div>
      <div>Due Date: ${invoice.dueDate.toLocaleDateString()}</div>
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
    <div>
      <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      <div class="row"><span>VAT (${invoice.vatRate}%)</span><span>${money(vatAmount)}</span></div>
      <div class="row total"><span>Total</span><span>${money(total)}</span></div>
    </div>
  </div>

  ${invoice.notes ? `<div class="notes">${esc(invoice.notes)}</div>` : ""}
</body>
</html>`;
}
