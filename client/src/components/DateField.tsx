import { useEffect, useRef, useState } from "react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function DateField({
  value,
  onChange,
  required,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseIso(value);
  const [viewMonth, setViewMonth] = useState(() => selected ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) setViewMonth(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  function selectDay(d: Date) {
    onChange(toIso(d));
    setOpen(false);
  }

  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-required={required}
        className="w-full bg-mine-800/60 border border-mine-700 rounded-lg px-3.5 py-2.5 text-sm text-left text-mine-50 shadow-inner shadow-black/5 transition-all hover:border-mine-600 focus:outline-none focus:ring-2 focus:ring-hazard-500/70 focus:border-hazard-500 flex items-center justify-between gap-2"
      >
        <span className={selected ? "" : "text-mine-400"}>
          {selected
            ? selected.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
            : placeholder ?? "Select date"}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-mine-400 shrink-0">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-64 bg-mine-900 border border-mine-700 rounded-xl shadow-lg shadow-black/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              className="p-1 rounded hover:bg-mine-800 text-mine-300"
              onClick={() => setViewMonth(new Date(year, month - 1, 1))}
              aria-label="Previous month"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="text-xs font-semibold text-mine-100">{monthLabel}</div>
            <button
              type="button"
              className="p-1 rounded hover:bg-mine-800 text-mine-300"
              onClick={() => setViewMonth(new Date(year, month + 1, 1))}
              aria-label="Next month"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-mine-500 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const isSelected = selected && toIso(d) === toIso(selected);
              const isToday = toIso(d) === toIso(today);
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => selectDay(d)}
                  className={`text-xs rounded-md py-1.5 transition-colors ${
                    isSelected
                      ? "bg-hazard-500 text-white font-semibold"
                      : isToday
                      ? "border border-hazard-500 text-mine-100"
                      : "text-mine-200 hover:bg-mine-800"
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between pt-2 mt-2 border-t border-mine-800">
            <button type="button" className="text-[10px] text-mine-400 hover:text-mine-100" onClick={() => selectDay(today)}>
              Today
            </button>
            {value && (
              <button
                type="button"
                className="text-[10px] text-danger-400 hover:text-danger-300"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
