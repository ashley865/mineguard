import { ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CyberTheme } from "./cyberTheme";

export interface CyberTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
}

interface CyberTableProps<T> {
  theme: CyberTheme;
  columns: CyberTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage: string;
  searchValue?: (row: T) => string;
  actions?: (row: T) => ReactNode;
  toolbarExtra?: ReactNode;
}

// A trimmed-down, theme-aware counterpart to the shared DataTable component — built
// locally rather than reusing that component because DataTable's chrome (search box,
// pagination buttons, card wrapper) is hard-wired to the app's light "mine-*" palette,
// which would clash with this module's dark-first SOC console look.
export default function CyberTable<T>({ theme, columns, rows, rowKey, emptyMessage, searchValue, actions, toolbarExtra }: CyberTableProps<T>) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-2">
      {(searchValue || toolbarExtra) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchValue && (
            <input className={`${theme.input} max-w-xs`} placeholder={t("common.search") ?? "Search"} value={search} onChange={(e) => setSearch(e.target.value)} />
          )}
          {toolbarExtra}
        </div>
      )}
      <div className={`${theme.panel} overflow-x-auto`}>
        <table className="w-full text-xs">
          <thead className={`${theme.tableHeader} uppercase text-[10px]`}>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`text-left px-3 py-2 ${c.className ?? ""}`}>
                  {c.sortValue ? (
                    <button type="button" className="flex items-center gap-1 hover:opacity-80" onClick={() => toggleSort(c.key)}>
                      {c.header}
                      {sortKey === c.key && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
              {actions && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={rowKey(row)} className={`border-t ${theme.rowBorder} ${theme.rowHover} align-top`}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 ${c.className ?? ""}`}>
                    {c.render(row)}
                  </td>
                ))}
                {actions && <td className="px-3 py-2 text-right whitespace-nowrap">{actions(row)}</td>}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className={`px-3 py-6 text-center ${theme.mutedText}`}>
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
