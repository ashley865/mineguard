import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AiNarrativeRiskScanResponse } from "../api/types";
import { cardClass, buttonPrimary } from "../components/ui";
import LoadError from "../components/LoadError";

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "bg-mine-600 text-mine-100",
  MEDIUM: "bg-hazard-500 text-white",
  HIGH: "bg-danger-400 text-white",
  CRITICAL: "bg-danger-600 text-white",
};

export default function NarrativeRiskScanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canView = user?.role === "ADMIN" || ["SAFETY_MANAGER", "COMPLIANCE_OFFICER", "GENERAL_MANAGER"].includes(user?.title ?? "");
  const [data, setData] = useState<AiNarrativeRiskScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  async function scan() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<AiNarrativeRiskScanResponse>("/ai/narrative-risk-scan");
      setData(res.data);
      setHasScanned(true);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canView) scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canView) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("narrativeRiskScanner.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("narrativeRiskScanner.subtitle")}</p>
        </div>
        <button className={buttonPrimary} disabled={loading} onClick={scan}>
          {loading ? t("common.loading") : t("narrativeRiskScanner.rescan")}
        </button>
      </div>

      {loadError && <LoadError onRetry={scan} />}

      {hasScanned && data && !data.configured && (
        <div className="text-xs font-medium text-mine-300 bg-mine-800/60 border border-mine-700 rounded-md p-3">
          {t("ai.notConfigured")}
        </div>
      )}

      {hasScanned && data?.configured && (
        <>
          <p className="text-xs text-mine-400">{t("narrativeRiskScanner.scannedCount", { count: data.scannedCount })}</p>
          <div className="space-y-3">
            {data.flagged.map((f) => (
              <div key={`${f.type}-${f.id}`} className={`${cardClass} p-4 space-y-2`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wide text-mine-400 bg-mine-800 px-2 py-0.5 rounded-full">
                    {t(`narrativeRiskScanner.types.${f.type}`)}
                  </span>
                  <span className="text-[10px] text-mine-400">{f.site}</span>
                  <span className="text-xs text-mine-400">{t("narrativeRiskScanner.reported")}:</span>
                  <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${SEVERITY_COLORS[f.reportedSeverity] ?? "bg-mine-600"}`}>
                    {f.reportedSeverity}
                  </span>
                  <span className="text-xs text-mine-400">→ {t("narrativeRiskScanner.suggested")}:</span>
                  <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${SEVERITY_COLORS[f.suggestedSeverity] ?? "bg-mine-600"}`}>
                    {f.suggestedSeverity}
                  </span>
                </div>
                <p className="text-sm text-mine-200 whitespace-pre-line">{f.description}</p>
                <p className="text-xs text-hazard-500 border-t border-mine-800 pt-2">{f.reasoning}</p>
              </div>
            ))}
            {data.flagged.length === 0 && (
              <div className={`${cardClass} p-6 text-center text-mine-400`}>{t("narrativeRiskScanner.noneFlagged")}</div>
            )}
          </div>
          <p className="text-[10px] text-mine-500">{data.disclaimer}</p>
        </>
      )}
    </div>
  );
}
