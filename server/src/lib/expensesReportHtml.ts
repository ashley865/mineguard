interface ExpenseLike {
  expenseNumber: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  expenseDate: Date;
  status: string;
  payeeName: string;
}

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderExpensesReportHtml(
  expenses: ExpenseLike[],
  mine: { name: string; logoDataUri?: string | null },
  generatedAt: Date
) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const currency = expenses[0]?.currency ?? "ZAR";
  const money = (n: number) => `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  const categoryRows = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .map(
      ([category, amount]) => `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eceff3;">${esc(category.replace(/_/g, " "))}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eceff3;text-align:right;font-weight:600;">${money(amount)}</td>
      </tr>`
    )
    .join("");

  const rows = expenses
    .map(
      (e, i) => `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#fafafa"};">
        <td style="padding:8px 10px;border-bottom:1px solid #eceff3;">${esc(e.expenseNumber)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eceff3;">${esc(e.expenseDate.toLocaleDateString())}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eceff3;">${esc(e.payeeName)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eceff3;">${esc(e.category.replace(/_/g, " "))}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eceff3;">${esc(e.status)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eceff3;text-align:right;font-weight:600;">${money(e.amount)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Expenses Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Arial, Helvetica, sans-serif; color: #1c2536; margin: 0; background: #f4f5f7; }
  .sheet { max-width: 820px; margin: 0 auto; background: #ffffff; }
  .accent { height: 8px; background: linear-gradient(90deg, #c48a1f, #d9a441); }
  .content { padding: 32px 36px 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 16px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { width: 46px; height: 46px; object-fit: contain; border-radius: 8px; border: 1px solid #eceff3; }
  .mine { font-size: 17px; font-weight: 700; }
  .gendate { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .title { font-size: 20px; font-weight: 800; text-align: right; text-transform: uppercase; letter-spacing: 0.03em; color: #c48a1f; }
  .summary { display: flex; gap: 12px; margin-bottom: 24px; }
  .summary-box { flex: 1; background: #f8f9fb; border: 1px solid #eceff3; border-radius: 10px; padding: 12px 16px; }
  .summary-box .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; font-weight: 600; margin-bottom: 4px; }
  .summary-box .value { font-size: 18px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 22px; border: 1px solid #eceff3; border-radius: 10px; overflow: hidden; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; background: #f8f9fb; padding: 8px 10px; border-bottom: 1px solid #eceff3; }
  th.right { text-align: right; }
  h2.section { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; margin: 0 0 8px; }
  .footer { margin-top: 28px; text-align: center; font-size: 10.5px; color: #b0b6c0; }
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
            <div class="gendate">Generated ${generatedAt.toLocaleString()}</div>
          </div>
        </div>
        <div class="title">Expenses Report</div>
      </div>

      <div class="summary">
        <div class="summary-box"><div class="label">Total Expenses</div><div class="value">${money(total)}</div></div>
        <div class="summary-box"><div class="label">Line Items</div><div class="value">${expenses.length}</div></div>
      </div>

      <h2 class="section">By Category</h2>
      <table>
        <thead><tr><th>Category</th><th class="right">Amount</th></tr></thead>
        <tbody>${categoryRows || `<tr><td style="padding:10px;color:#9ca3af;" colspan="2">No expenses in this period.</td></tr>`}</tbody>
      </table>

      <h2 class="section">All Expenses</h2>
      <table>
        <thead>
          <tr>
            <th>Ref</th>
            <th>Date</th>
            <th>Payee</th>
            <th>Category</th>
            <th>Status</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td style="padding:10px;color:#9ca3af;" colspan="6">No expenses in this period.</td></tr>`}</tbody>
      </table>

      <div class="footer">Generated by Mine Guard</div>
    </div>
  </div>
</body>
</html>`;
}
