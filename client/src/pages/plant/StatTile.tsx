import { ReactNode } from "react";

type Tone = "good" | "warn" | "bad";

const toneClass: Record<Tone, string> = {
  good: "text-success-500",
  warn: "text-hazard-500",
  bad: "text-danger-500",
};

/**
 * A headline number with the target it is judged against. The target is not
 * optional by accident — a count of overdue inspections means nothing until the
 * reader knows the acceptable number is zero.
 */
export default function StatTile({ label, value, target, tone, hint }: {
  label: string;
  value: ReactNode;
  target: string;
  tone?: Tone;
  hint?: string;
}) {
  return (
    <div className="bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6">
      <p className="text-xs font-medium text-mine-300 tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${tone ? toneClass[tone] : "text-mine-50"}`}>{value}</p>
      <p className="text-[11px] text-mine-400 mt-1">{target}</p>
      {hint && <p className="text-[11px] text-mine-400 mt-1">{hint}</p>}
    </div>
  );
}
