import { cardClass } from "./ui";

export interface SummaryCard {
  label: string;
  value: string | number;
  tone?: "default" | "danger" | "hazard" | "success";
}

const TONE_CLASSES: Record<NonNullable<SummaryCard["tone"]>, string> = {
  default: "text-mine-50",
  danger: "text-danger-500",
  hazard: "text-hazard-500",
  success: "text-success-500",
};

// A row of at-a-glance stat cards for a module's landing view — pass whatever counts are
// meaningful for that module (e.g. "Overdue: 3", "Open cases: 12"). Purely presentational;
// each page computes its own cards from data it already has loaded, no new endpoint needed.
export default function SummaryCards({ cards }: { cards: SummaryCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className={`${cardClass} p-3`}>
          <div className="text-xs text-mine-400 uppercase tracking-wide">{c.label}</div>
          <div className={`text-2xl font-bold ${TONE_CLASSES[c.tone ?? "default"]}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
