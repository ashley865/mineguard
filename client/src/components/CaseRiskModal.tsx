import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { CaseRiskResponse } from "../api/types";
import Modal from "./Modal";
import { buttonSecondary } from "./ui";
import { PdfBuilder } from "../lib/exportPdf";

const RISK_TONE: Record<string, string> = {
  LOW: "text-success-600 bg-success-500/10 border-success-500/30",
  MEDIUM: "text-hazard-600 bg-hazard-500/10 border-hazard-500/30",
  HIGH: "text-danger-600 bg-danger-500/10 border-danger-500/30",
};

export default function CaseRiskModal({
  caseType,
  caseId,
  caseLabel,
  onClose,
}: {
  caseType: "DISCIPLINARY" | "GRIEVANCE" | "CCMA";
  caseId: string;
  caseLabel: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CaseRiskResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .post<CaseRiskResponse>("/ai/hr/case-risk", { caseType, caseId })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error ?? t("ai.sendError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseType, caseId]);

  function downloadPdf() {
    if (!data?.result) return;
    const pdf = new PdfBuilder();
    pdf.title(t("ai.caseRisk.title", { case: caseLabel }));
    pdf.subtitle(new Date().toLocaleString());
    pdf.divider();

    pdf.heading(t("ai.caseRisk.riskLevel"));
    pdf.paragraph(t(`ai.caseRisk.level.${data.result.riskLevel}`));
    pdf.spacer();

    if (data.result.riskFactors.length > 0) {
      pdf.heading(t("ai.caseRisk.riskFactors"));
      pdf.list(data.result.riskFactors.map((f) => `${f.factor}: ${f.detail}`));
      pdf.spacer();
    }

    if (data.result.proceduralConsiderations.length > 0) {
      pdf.heading(t("ai.caseRisk.proceduralConsiderations"));
      pdf.list(data.result.proceduralConsiderations);
      pdf.spacer();
    }

    if (data.disclaimer) {
      pdf.divider();
      pdf.paragraph(data.disclaimer, { italic: true, size: 8, muted: true });
    }

    const namePart = caseLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    pdf.save(`case-risk-${namePart}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <Modal title={t("ai.caseRisk.title", { case: caseLabel })} onClose={onClose}>
      <div className="space-y-4">
        {loading && <div className="text-mine-300 text-sm">{t("ai.report.generating")}</div>}
        {!loading && error && <div className="text-danger-600 text-sm font-bold">{error}</div>}
        {!loading && data && !data.configured && (
          <div className="text-xs font-medium text-mine-300 bg-mine-800/60 border border-mine-700 rounded-md p-3">
            {t("ai.notConfigured")}
          </div>
        )}
        {!loading && data?.configured && data.result && (
          <div className="space-y-4">
            <div className={`border-2 rounded-lg p-3 ${RISK_TONE[data.result.riskLevel]}`}>
              <div className="text-[10px] font-extrabold uppercase tracking-wide mb-0.5">{t("ai.caseRisk.riskLevel")}</div>
              <div className="text-lg font-extrabold">{t(`ai.caseRisk.level.${data.result.riskLevel}`)}</div>
            </div>

            {data.result.riskFactors.length > 0 && (
              <div>
                <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-mine-300 mb-2">
                  {t("ai.caseRisk.riskFactors")}
                </h4>
                <ul className="space-y-2">
                  {data.result.riskFactors.map((f, i) => (
                    <li key={i} className="border border-mine-800 rounded-md p-2.5">
                      <div className="font-bold text-xs text-mine-100">{f.factor}</div>
                      <div className="text-[11px] text-mine-300 font-medium mt-0.5">{f.detail}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.result.proceduralConsiderations.length > 0 && (
              <div>
                <h4 className="text-[11px] font-extrabold uppercase tracking-wide text-mine-300 mb-2">
                  {t("ai.caseRisk.proceduralConsiderations")}
                </h4>
                <ul className="space-y-1.5 list-disc list-inside">
                  {data.result.proceduralConsiderations.map((p, i) => (
                    <li key={i} className="text-xs text-mine-200 font-medium">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {!loading && data?.disclaimer && (
          <div className="text-[11px] text-mine-400 font-medium border-t border-mine-800 pt-3 leading-relaxed">
            {data.disclaimer}
          </div>
        )}
        {!loading && data?.configured && data.result && (
          <div className="flex justify-end">
            <button className={buttonSecondary} onClick={downloadPdf}>
              {t("ai.report.downloadPdf")}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
