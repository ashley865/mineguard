import { useTranslation } from "react-i18next";
import { CyberSeverity } from "../../api/types";

// A deliberately distinct, self-contained SOC console look (dark by default, with a
// light toggle) rather than the rest of the app's light "mine-*" palette — this page
// owns its own theme tokens instead of reusing shared components tied to that palette,
// so it reads unmistakably as a security console.
export interface CyberTheme {
  dark: boolean;
  page: string;
  panel: string;
  panelHeader: string;
  text: string;
  subtext: string;
  mutedText: string;
  input: string;
  select: string;
  tableHeader: string;
  rowHover: string;
  rowBorder: string;
  chip: string;
}

export function getCyberTheme(dark: boolean): CyberTheme {
  return dark
    ? {
        dark: true,
        page: "bg-[#0a0e1a] text-white",
        panel: "bg-[#0f1523] border border-white/10 rounded-xl",
        panelHeader: "border-b border-white/10",
        text: "text-white",
        subtext: "text-white/60",
        mutedText: "text-white/35",
        input:
          "bg-[#0a0e1a] border border-white/15 text-white placeholder-white/30 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-hazard-500 w-full",
        select: "bg-[#0a0e1a] border border-white/15 text-white rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-hazard-500",
        tableHeader: "bg-white/[0.04] text-white/45",
        rowHover: "hover:bg-white/[0.04]",
        rowBorder: "border-white/10",
        chip: "bg-white/10 text-white/70",
      }
    : {
        dark: false,
        page: "bg-slate-100 text-slate-900",
        panel: "bg-white border border-slate-200 rounded-xl shadow-sm",
        panelHeader: "border-b border-slate-200",
        text: "text-slate-900",
        subtext: "text-slate-500",
        mutedText: "text-slate-400",
        input: "bg-white border border-slate-300 text-slate-900 placeholder-slate-400 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-hazard-500 w-full",
        select: "bg-white border border-slate-300 text-slate-900 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-hazard-500",
        tableHeader: "bg-slate-50 text-slate-500",
        rowHover: "hover:bg-slate-50",
        rowBorder: "border-slate-200",
        chip: "bg-slate-100 text-slate-600",
      };
}

export const cyberButtonPrimary = "bg-hazard-500 hover:bg-hazard-600 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors disabled:opacity-50";
export const cyberButtonDanger = "bg-danger-500 hover:bg-danger-600 text-white text-xs font-semibold px-2.5 py-1 rounded-md transition-colors disabled:opacity-50";
export function cyberButtonSecondary(theme: CyberTheme) {
  return theme.dark
    ? "bg-white/10 hover:bg-white/15 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
    : "bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors disabled:opacity-50";
}
export function cyberLinkButton(theme: CyberTheme) {
  return theme.dark ? "text-xs text-white/60 hover:text-hazard-400" : "text-xs text-slate-500 hover:text-hazard-600";
}

export const SEVERITY_ORDER: CyberSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"];

const SEVERITY_COLORS: Record<CyberSeverity, string> = {
  CRITICAL: "bg-red-600 text-white",
  HIGH: "bg-orange-500 text-white",
  MEDIUM: "bg-amber-500 text-white",
  LOW: "bg-blue-500 text-white",
  INFORMATIONAL: "bg-slate-400 text-white",
};

export function SeverityPill({ severity }: { severity: CyberSeverity }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${SEVERITY_COLORS[severity]}`}>
      {t(`cyber.severity.${severity}`)}
    </span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-500",
  OPEN: "bg-blue-500",
  INVESTIGATING: "bg-amber-500",
  CONTAINED: "bg-purple-500",
  RESOLVED: "bg-green-600",
  FALSE_POSITIVE: "bg-slate-400",
  IN_PROGRESS: "bg-amber-500",
  PATCHED: "bg-green-600",
  ACCEPTED_RISK: "bg-slate-500",
  COMPLIANT: "bg-green-600",
  NON_COMPLIANT: "bg-red-600",
  NOT_ASSESSED: "bg-slate-400",
  PROTECTED: "bg-green-600",
  OUTDATED: "bg-amber-500",
  MISSING: "bg-red-600",
  DISABLED: "bg-red-600",
  UP_TO_DATE: "bg-green-600",
  PENDING: "bg-amber-500",
  OVERDUE: "bg-red-600",
  UNKNOWN: "bg-slate-400",
  ENCRYPTED: "bg-green-600",
  NOT_ENCRYPTED: "bg-red-600",
  SECURE: "bg-green-600",
  WARNING: "bg-amber-500",
  COMPROMISED: "bg-red-600",
  BLOCKED: "bg-red-600",
};

export function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-white whitespace-nowrap ${STATUS_COLORS[status] ?? "bg-slate-400"}`}>
      {t(`cyber.status.${status}`, status.replace(/_/g, " "))}
    </span>
  );
}

export function severityWeight(s: CyberSeverity): number {
  return SEVERITY_ORDER.indexOf(s);
}
