import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { CyberAlert, CyberCorrelationResult, CyberIncident, CyberSeverity, CyberVulnerability } from "../../api/types";
import { CyberTheme, SeverityPill, cyberButtonPrimary, cyberButtonSecondary } from "./cyberTheme";

type ExplainType = "alert" | "incident" | "vulnerability";

export default function AiAnalystTab({ theme, canEdit }: { theme: CyberTheme; canEdit: boolean }) {
  const { t } = useTranslation();
  const [openAlerts, setOpenAlerts] = useState<CyberAlert[]>([]);
  const [incidents, setIncidents] = useState<CyberIncident[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<CyberVulnerability[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);
  const [correlating, setCorrelating] = useState(false);
  const [correlationError, setCorrelationError] = useState<string | null>(null);
  const [correlationResult, setCorrelationResult] = useState<CyberCorrelationResult | null>(null);
  const [creatingIncident, setCreatingIncident] = useState(false);

  const [explainType, setExplainType] = useState<ExplainType>("alert");
  const [explainId, setExplainId] = useState("");
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [a, i, v] = await Promise.all([
        api.get<CyberAlert[]>("/cyber-alerts"),
        api.get<CyberIncident[]>("/cyber-incidents"),
        api.get<CyberVulnerability[]>("/cyber-vulnerabilities"),
      ]);
      setOpenAlerts(a.data.filter((al) => al.status === "NEW" || al.status === "INVESTIGATING"));
      setIncidents(i.data);
      setVulnerabilities(v.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function toggleAlert(id: string) {
    setSelectedAlertIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function runCorrelation() {
    setCorrelating(true);
    setCorrelationError(null);
    setCorrelationResult(null);
    try {
      const res = await api.post<CyberCorrelationResult>("/cyber-ai/correlate", { alertIds: selectedAlertIds });
      setCorrelationResult(res.data);
    } catch (err: any) {
      setCorrelationError(err.response?.data?.error ?? t("cyber.ai.correlationError"));
    } finally {
      setCorrelating(false);
    }
  }

  async function createIncidentFromSuggestion() {
    if (!correlationResult) return;
    setCreatingIncident(true);
    try {
      const res = await api.post<CyberIncident>("/cyber-incidents", {
        title: correlationResult.title,
        description: correlationResult.description,
        severity: correlationResult.severity,
        affectedAssets: correlationResult.affectedAssets || undefined,
        riskScore: correlationResult.riskScore ?? undefined,
      });
      await Promise.all(correlationResult.alertIds.map((id) => api.put(`/cyber-alerts/${id}`, { incidentId: res.data.id, status: "INVESTIGATING" })));
      setCorrelationResult(null);
      setSelectedAlertIds([]);
      await load();
    } finally {
      setCreatingIncident(false);
    }
  }

  async function runExplain() {
    if (!explainId) return;
    setExplaining(true);
    setExplainError(null);
    setExplanation(null);
    try {
      const res = await api.post<{ explanation: string }>("/cyber-ai/explain", { type: explainType, id: explainId });
      setExplanation(res.data.explanation);
    } catch (err: any) {
      setExplainError(err.response?.data?.error ?? t("cyber.ai.explainError"));
    } finally {
      setExplaining(false);
    }
  }

  const explainOptions = explainType === "alert" ? openAlerts : explainType === "incident" ? incidents : vulnerabilities;

  if (loading) return <div className={theme.subtext}>{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <p className={`text-[10px] ${theme.mutedText}`}>{t("cyber.ai.disclaimer")}</p>

      <div className={`${theme.panel} p-4 space-y-3`}>
        <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.ai.correlateTitle")}</h3>
        <p className={`text-xs ${theme.subtext}`}>{t("cyber.ai.correlateHint")}</p>
        {openAlerts.length === 0 ? (
          <div className={`text-xs ${theme.mutedText}`}>{t("cyber.ai.noOpenAlerts")}</div>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {openAlerts.map((a) => (
              <label key={a.id} className={`flex items-center gap-2 text-xs ${theme.text} border-b ${theme.rowBorder} pb-1.5 last:border-b-0`}>
                <input type="checkbox" checked={selectedAlertIds.includes(a.id)} onChange={() => toggleAlert(a.id)} />
                <span className="flex-1 truncate">{a.title}</span>
                <SeverityPill severity={a.severity} />
              </label>
            ))}
          </div>
        )}
        {canEdit && (
          <button className={cyberButtonPrimary} disabled={selectedAlertIds.length === 0 || correlating} onClick={runCorrelation}>
            {correlating ? t("cyber.ai.correlating") : t("cyber.ai.correlateAction", { count: selectedAlertIds.length })}
          </button>
        )}
        {correlationError && <div className="text-xs text-red-500">{correlationError}</div>}
        {correlationResult && (
          <div className={`${theme.panel} p-3 space-y-2 mt-2`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm font-semibold ${theme.text}`}>{correlationResult.title}</span>
              <SeverityPill severity={correlationResult.severity as CyberSeverity} />
            </div>
            <p className={`text-xs ${theme.subtext}`}>{correlationResult.description}</p>
            {correlationResult.affectedAssets && (
              <p className={`text-xs ${theme.mutedText}`}>{t("cyber.ai.affectedAssets")}: {correlationResult.affectedAssets}</p>
            )}
            {correlationResult.riskScore != null && <p className={`text-xs ${theme.mutedText}`}>{t("cyber.incidents.riskScore")}: {correlationResult.riskScore}/100</p>}
            {correlationResult.recommendedActions.length > 0 && (
              <ul className={`text-xs ${theme.subtext} list-disc list-inside space-y-0.5`}>
                {correlationResult.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button className={cyberButtonSecondary(theme)} onClick={() => setCorrelationResult(null)}>{t("common.cancel")}</button>
              <button className={cyberButtonPrimary} disabled={creatingIncident} onClick={createIncidentFromSuggestion}>
                {creatingIncident ? t("common.saving") : t("cyber.ai.createIncidentFromSuggestion")}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`${theme.panel} p-4 space-y-3`}>
        <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.ai.explainTitle")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <select
            className={theme.select}
            value={explainType}
            onChange={(e) => { setExplainType(e.target.value as ExplainType); setExplainId(""); setExplanation(null); }}
          >
            <option value="alert">{t("cyber.alerts.tabAlerts")}</option>
            <option value="incident">{t("cyber.incidents.tabIncidents")}</option>
            <option value="vulnerability">{t("cyber.tabVulnerabilities")}</option>
          </select>
          <select className={theme.select} value={explainId} onChange={(e) => setExplainId(e.target.value)}>
            <option value="">{t("cyber.ai.selectRecord")}</option>
            {explainOptions.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </div>
        <button className={cyberButtonPrimary} disabled={!explainId || explaining} onClick={runExplain}>
          {explaining ? t("cyber.ai.explaining") : t("cyber.ai.explainAction")}
        </button>
        {explainError && <div className="text-xs text-red-500">{explainError}</div>}
        {explanation && <p className={`text-xs ${theme.subtext} whitespace-pre-line border-t ${theme.rowBorder} pt-2`}>{explanation}</p>}
      </div>
    </div>
  );
}
