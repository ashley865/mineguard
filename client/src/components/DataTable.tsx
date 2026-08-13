import { ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cardClass, buttonSecondary, inputClass } from "./ui";
import { exportToCsv, CsvColumn } from "../lib/exportCsv";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Omit to make the column unsortable. */
  sortValue?: (row: T) => string | number | Date | null | undefined;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage: string;
  /** Combined searchable text for a row; omit to hide the search box entirely. */
  searchValue?: (row: T) => string;
  searchPlaceholder?: string;
  pageSize?: number;
  /** Rendered as a trailing, right-aligned column (edit/delete buttons etc). */
  actions?: (row: T) => ReactNode;
  /** Supplying both enables an "Export CSV" toolbar button. */
  exportFilename?: string;
  exportColumns?: CsvColumn<T>[];
  /** Extra toolbar content (e.g. a status filter dropdown) rendered next to the search box. */
  toolbarExtra?: ReactNode;
}

// A generic, reusable list view: search, column sorting, pagination and CSV export in one
// place, so every module gets the same behaviour instead of a bespoke hand-rolled <table>.
// Fully client-side (filters/sorts/paginates the `rows` already loaded) — fine at the data
// volumes this app operates at; swap for server-side paging later if that ever changes.
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  searchValue,
  searchPlaceholder,
  pageSize = 20,
  actions,
  exportFilename,
  exportColumns,
  toolbarExtra,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!searchValue || !search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => searchValue(r).toLowerCase().includes(q));
  }, [rows, search, searchValue]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const withKeys = filtered.map((row) => ({ row, key: col.sortValue!(row) }));
    withKeys.sort((a, b) => {
      const av = a.key ?? "";
      const bv = b.key ?? "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return withKeys.map((w) => w.row);
  }, [filtered, columns, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  function handleExport() {
    if (!exportFilename || !exportColumns) return;
    exportToCsv(exportFilename, sorted, exportColumns);
  }

  return (
    <div className="space-y-3">
      {(searchValue || toolbarExtra || (exportFilename && exportColumns)) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchValue && (
            <input
              className={`${inputClass} max-w-xs`}
              placeholder={searchPlaceholder ?? t("common.search") ?? "Search"}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          )}
          {toolbarExtra}
          {exportFilename && exportColumns && (
            <button type="button" className={`${buttonSecondary} text-xs ml-auto`} onClick={handleExport}>
              {t("common.exportCsv")}
            </button>
          )}
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`text-left px-4 py-2 ${c.className ?? ""}`}>
                  {c.sortValue ? (
                    <button type="button" className="flex items-center gap-1 hover:text-mine-50" onClick={() => toggleSort(c.key)}>
                      {c.header}
                      {sortKey === c.key && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
              {actions && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-mine-800 hover:bg-mine-800/30 align-top">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-2 ${c.className ?? ""}`}>{c.render(row)}</td>
                ))}
                {actions && <td className="px-4 py-2 text-right">{actions(row)}</td>}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-6 text-center text-mine-400">{emptyMessage}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-mine-400">
          <span>{t("common.pageOf", { page: currentPage, pages: pageCount })}</span>
          <div className="flex gap-2">
            <button type="button" className={buttonSecondary} disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
              {t("common.previous")}
            </button>
            <button type="button" className={buttonSecondary} disabled={currentPage >= pageCount} onClick={() => setPage((p) => p + 1)}>
              {t("common.next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
