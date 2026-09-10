import { useTranslation } from "react-i18next";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days until `iso`, negative when already past. Null when there is no date. */
export function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.ceil((then - Date.now()) / DAY_MS);
}

export function isOverdue(iso?: string | null): boolean {
  const d = daysUntil(iso);
  return d != null && d < 0;
}

export function isDueSoon(iso?: string | null, withinDays = 30): boolean {
  const d = daysUntil(iso);
  return d != null && d >= 0 && d <= withinDays;
}

/**
 * A statutory due date with its own urgency baked in. A blank date is rendered as
 * "not set" in amber rather than an em dash: on a register the mine has to be able
 * to produce on demand, an unknown next-inspection date is a finding, not a gap in
 * the UI.
 */
export default function DueDate({ value, withinDays = 30 }: { value?: string | null; withinDays?: number }) {
  const { t } = useTranslation();
  if (!value) return <span className="text-hazard-500">{t("plantIntegrity.notSet")}</span>;
  const days = daysUntil(value);
  const label = new Date(value).toLocaleDateString();
  if (days != null && days < 0) {
    return (
      <span className="text-danger-500 font-semibold">
        {label} <span className="text-[11px] font-normal">({t("plantIntegrity.overdueByDays", { count: Math.abs(days) })})</span>
      </span>
    );
  }
  if (days != null && days <= withinDays) {
    return (
      <span className="text-hazard-500">
        {label} <span className="text-[11px]">({t("plantIntegrity.inDays", { count: days })})</span>
      </span>
    );
  }
  return <span className="text-mine-200">{label}</span>;
}
