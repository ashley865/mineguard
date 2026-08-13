export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  // Quote whenever the value could otherwise be misread — comma, quote, or newline.
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// Pure client-side CSV generation — no backend endpoint needed, works on whatever rows are
// already loaded in the page. Opens directly in Excel/Sheets, which covers the overwhelming
// majority of "I need this data outside the app" requests without a PDF-rendering dependency.
export function exportToCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsvCell(c.value(row))).join(","));
  const csv = [header, ...lines].join("\r\n");
  // A UTF-8 BOM keeps Excel from mangling non-ASCII characters (accents, etc.) on Windows.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
