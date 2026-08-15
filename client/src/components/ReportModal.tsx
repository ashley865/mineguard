import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { AiRecommendation, ExecutiveReportResponse, ReportPeriod } from "../api/types";
import Modal from "./Modal";
import { buttonPrimary, buttonSecondary } from "./ui";
import { routeForTopic } from "../lib/aiTopicRoutes";
import { PdfBuilder } from "../lib/exportPdf";

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

// Renders any section's precomputed data object as a compact fact string next to the AI's
// narrative for that section — this is the traceability mechanism: every sentence the AI
// wrote sits directly beside the real numbers it was constrained to draw from.
function factsToText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.length === 0 ? "none" : value.map(factsToText).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${humanizeKey(k)}: ${factsToText(v)}`)
      .join(" · ");
  }
  return String(value);
}

const KIND_BADGE: Record<AiRecommendation["kind"], string> = {
  RISK: "bg-danger-500/15 text-danger-600",
  PREDICTION: "bg-mine-400/15 text-mine-400",
  RECOMMENDATION: "bg-hazard-500/15 text-hazard-600",
  ACHIEVEMENT: "bg-success-500/15 text-success-600",
  ANNOUNCEMENT: "bg-mine-500/15 text-mine-300",
};

export default function ReportModal({
  onClose,
  endpoint,
  sectionKeys,
  titleKey,
  hintKey,
  sectionLabelPrefix,
}: {
  onClose: () => void;
  /** e.g. "/ai/report" or "/ai/hr/report" */
  endpoint: string;
  /** Section keys in display order — must match what the endpoint returns. */
  sectionKeys: readonly string[];
  /** i18n key for the modal title. */
  titleKey: string;
  /** i18n key for the pre-generation hint text. */
  hintKey: string;
  /** i18n namespace prefix for per-section labels, e.g. "ai.report.sections". */
  sectionLabelPrefix: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<ReportPeriod>("WEEK");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ExecutiveReportResponse | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<ExecutiveReportResponse>(endpoint, { period });
      if (!res.data.configured) {
        setError(t("ai.notConfigured"));
        return;
      }
      setReport(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("ai.sendError"));
    } finally {
      setLoading(false);
    }
  }

  const sectionsByKey = new Map((report?.sections ?? []).map((s) => [s.key, s]));

  function downloadPdf() {
    if (!report) return;
    const pdf = new PdfBuilder();
    pdf.title(`${report.mine?.name ?? ""} — ${t(titleKey)}`.trim());
    const periodLine = [
      report.period ? `${new Date(report.period.start).toLocaleDateString()} – ${new Date(report.period.end).toLocaleDateString()}` : null,
      report.generatedAt ? t("ai.report.generatedAt", { date: new Date(report.generatedAt).toLocaleString() }) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    if (periodLine) pdf.subtitle(periodLine);
    pdf.divider();

    pdf.heading(t("ai.report.executiveSummary"));
    pdf.paragraph(report.executiveSummary ?? "");
    pdf.spacer();

    sectionKeys.forEach((key) => {
      const section = sectionsByKey.get(key);
      if (!section) return;
      pdf.heading(t(`${sectionLabelPrefix}.${key}`));
      pdf.paragraph(section.narrative);
      pdf.paragraph(factsToText(section.data), { italic: true, size: 8, muted: true });
      pdf.spacer();
    });

    if (report.recommendedPriorities && report.recommendedPriorities.length > 0) {
      pdf.heading(t("ai.report.recommendedPriorities"));
      pdf.list(report.recommendedPriorities, true);
      pdf.spacer();
    }

    if (report.aiInsights && report.aiInsights.length > 0) {
      pdf.heading(t("ai.report.aiInsights"));
      pdf.list(report.aiInsights.map((rec) => `[${t(`ai.kind.${rec.kind}`)}] ${rec.title}`));
    }

    const datePart = new Date(report.generatedAt ?? Date.now()).toISOString().slice(0, 10);
    const namePart = (report.mine?.name ?? "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    pdf.save(`${namePart}-ai-report-${datePart}.pdf`);
  }

  return (
    <Modal title={t(titleKey)} onClose={onClose} size="lg">
      <div className="space-y-4">
        {!report && (
          <div className="space-y-3">
            <p className="text-sm text-mine-300">{t(hintKey)}</p>
            <div className="flex items-center gap-2">
              <button
                className={period === "WEEK" ? buttonPrimary : buttonSecondary}
                onClick={() => setPeriod("WEEK")}
              >
                {t("ai.report.thisWeek")}
              </button>
              <button
                className={period === "MONTH" ? buttonPrimary : buttonSecondary}
                onClick={() => setPeriod("MONTH")}
              >
                {t("ai.report.thisMonth")}
              </button>
            </div>
            {error && <div className="text-danger-600 text-sm font-bold">{error}</div>}
            <button className={buttonPrimary} disabled={loading} onClick={generate}>
              {loading ? t("ai.report.generating") : t("ai.report.generate")}
            </button>
          </div>
        )}

        {report && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-extrabold text-mine-50">{report.mine?.name}</h3>
                <p className="text-xs text-mine-400 font-medium">
                  {report.period && `${new Date(report.period.start).toLocaleDateString()} – ${new Date(report.period.end).toLocaleDateString()}`}
                  {report.generatedAt && ` · ${t("ai.report.generatedAt", { date: new Date(report.generatedAt).toLocaleString() })}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className={buttonSecondary} onClick={downloadPdf}>
                  {t("ai.report.downloadPdf")}
                </button>
                <button className={buttonSecondary} onClick={() => setReport(null)}>
                  {t("ai.report.newReport")}
                </button>
              </div>
            </div>

            <div className="bg-hazard-500/5 border-2 border-hazard-500/30 rounded-lg p-3">
              <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-hazard-600 mb-1.5">
                {t("ai.report.executiveSummary")}
              </h4>
              <p className="text-sm text-mine-100 font-semibold leading-relaxed">{report.executiveSummary}</p>
            </div>

            <div className="space-y-3">
              {sectionKeys.map((key) => {
                const section = sectionsByKey.get(key);
                if (!section) return null;
                return (
                  <div key={key} className="border border-mine-800 rounded-lg p-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-mine-200 mb-1">
                      {t(`${sectionLabelPrefix}.${key}`)}
                    </h4>
                    <p className="text-xs text-mine-100 font-medium leading-relaxed mb-2">{section.narrative}</p>
                    <p className="text-[10px] text-mine-400 font-mono leading-snug border-t border-mine-800 pt-1.5">
                      {factsToText(section.data)}
                    </p>
                  </div>
                );
              })}
            </div>

            {report.recommendedPriorities && report.recommendedPriorities.length > 0 && (
              <div className="bg-mine-800/40 border border-mine-700 rounded-lg p-3">
                <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-mine-300 mb-2">
                  {t("ai.report.recommendedPriorities")}
                </h4>
                <ol className="space-y-1.5 list-decimal list-inside">
                  {report.recommendedPriorities.map((p, i) => (
                    <li key={i} className="text-xs text-mine-100 font-semibold">
                      {p}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {report.aiInsights && report.aiInsights.length > 0 && (
              <div>
                <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-mine-300 mb-2">
                  {t("ai.report.aiInsights")}
                </h4>
                <ul className="space-y-1.5">
                  {report.aiInsights.map((rec) => {
                    const route = routeForTopic(rec.topic);
                    return (
                      <li key={rec.id} className="flex items-center gap-2 text-xs">
                        <span className={`text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${KIND_BADGE[rec.kind]}`}>
                          {t(`ai.kind.${rec.kind}`)}
                        </span>
                        <span className="font-semibold text-mine-200 truncate flex-1">{rec.title}</span>
                        {route && (
                          <button
                            className="text-[10px] font-bold text-hazard-600 hover:text-hazard-500 shrink-0"
                            onClick={() => {
                              onClose();
                              navigate(route);
                            }}
                          >
                            {t("ai.takeAction")}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
