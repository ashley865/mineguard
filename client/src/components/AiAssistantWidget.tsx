import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { AiChatMessage, AiChatResponse, AiRecommendation, AiSummaryResponse } from "../api/types";
import { buttonPrimary, buttonSecondary, inputClass } from "./ui";
import ReportModal from "./ReportModal";
import { routeForTopic } from "../lib/aiTopicRoutes";

const EXEC_REPORT_SECTIONS = [
  "production",
  "operations",
  "safety",
  "compliance",
  "security",
  "maintenance",
  "workforce",
  "environment",
  "finance",
  "enterpriseRisks",
] as const;
const HR_REPORT_SECTIONS = [
  "workforceOverview",
  "leaveAndAttendance",
  "certificatesAndTraining",
  "labourRelations",
  "equityAndSkillsDevelopment",
] as const;

const URGENT_KEYWORDS = ["overdue", "critical", "urgent", "immediate", "escalat", "non-compliant", "unauthorized", "unauthorised"];
const CAUTION_KEYWORDS = ["pending", "review", "attention", "expir", "due soon", "approval", "outstanding", "shortage"];
const POSITIVE_KEYWORDS = ["achiev", "improv", "met target", "zero incident", "cleared", "completed", "on track", "milestone"];

const SUMMARY_PREVIEW_COUNT = 3;
const RECOMMENDATIONS_PREVIEW_COUNT = 3;

type Tone = "urgent" | "caution" | "positive" | "neutral";

function toneOf(line: string): Tone {
  const lower = line.toLowerCase();
  if (URGENT_KEYWORDS.some((k) => lower.includes(k))) return "urgent";
  if (CAUTION_KEYWORDS.some((k) => lower.includes(k))) return "caution";
  if (POSITIVE_KEYWORDS.some((k) => lower.includes(k))) return "positive";
  return "neutral";
}

// Achievements/announcements get a tone driven by their kind, not their (often
// incidental) severity field, so a "zero incidents" achievement never reads as alarming.
function toneOfItem(rec: AiRecommendation): Tone {
  if (rec.kind === "ACHIEVEMENT") return "positive";
  if (rec.kind === "ANNOUNCEMENT") return "neutral";
  if (rec.severity === "CRITICAL" || rec.severity === "HIGH") return "urgent";
  if (rec.severity === "MEDIUM") return "caution";
  return "neutral";
}

const TONE_TEXT: Record<Tone, string> = {
  urgent: "text-danger-600",
  caution: "text-hazard-600",
  positive: "text-success-600",
  neutral: "text-mine-50",
};
const TONE_DOT: Record<Tone, string> = {
  urgent: "bg-danger-500",
  caution: "bg-hazard-500",
  positive: "bg-success-500",
  neutral: "bg-mine-400",
};
const KIND_BADGE: Record<AiRecommendation["kind"], string> = {
  RISK: "bg-danger-500/15 text-danger-600",
  PREDICTION: "bg-mine-400/15 text-mine-400",
  RECOMMENDATION: "bg-hazard-500/15 text-hazard-600",
  ACHIEVEMENT: "bg-success-500/15 text-success-600",
  ANNOUNCEMENT: "bg-mine-500/15 text-mine-300",
};
const NON_ACTIONABLE_KINDS = new Set<AiRecommendation["kind"]>(["ACHIEVEMENT", "ANNOUNCEMENT"]);

export default function AiAssistantWidget({
  showReportGenerator = false,
  showHrReportGenerator = false,
}: {
  showReportGenerator?: boolean;
  showHrReportGenerator?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [openReport, setOpenReport] = useState<"EXEC" | "HR" | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [recommendationsExpanded, setRecommendationsExpanded] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadRecommendations() {
    try {
      const res = await api.get<AiRecommendation[]>("/ai/recommendations");
      setRecommendations(res.data);
    } catch {
      // Non-fatal: the summary card still works without the tracked list.
    }
  }

  useEffect(() => {
    api
      .get<AiSummaryResponse>("/ai/summary")
      .then((res) => {
        setConfigured(res.data.configured);
        setSummary(res.data.summary);
        if (res.data.configured) loadRecommendations();
      })
      .catch(() => setConfigured(false))
      .finally(() => setLoadingSummary(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function reviewRecommendation(id: string, status: "ACKNOWLEDGED" | "ACTIONED" | "DISMISSED") {
    let reviewNote: string | undefined;
    if (status === "DISMISSED") {
      reviewNote = window.prompt(t("ai.dismissReasonPrompt") ?? "") ?? undefined;
    }
    setReviewingId(id);
    try {
      await api.put(`/ai/recommendations/${id}`, { status, reviewNote });
      await loadRecommendations();
    } finally {
      setReviewingId(null);
    }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setError(null);
    const nextMessages: AiChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setSending(true);
    try {
      const res = await api.post<AiChatResponse>("/ai/chat", { messages: nextMessages });
      if (!res.data.configured || !res.data.reply) {
        setConfigured(false);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: res.data.reply! }]);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("ai.sendError"));
      setMessages(nextMessages.slice(0, -1));
      setDraft(content);
    } finally {
      setSending(false);
    }
  }

  const summaryLines = (summary ?? "")
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  const visibleSummaryLines = summaryExpanded ? summaryLines : summaryLines.slice(0, SUMMARY_PREVIEW_COUNT);

  const activeRecommendations = recommendations.filter((r) => r.status === "OPEN" || r.status === "ACKNOWLEDGED");
  const resolvedRecommendations = recommendations.filter((r) => r.status === "ACTIONED" || r.status === "DISMISSED");
  const filteredRecommendations = showResolved ? recommendations : activeRecommendations;
  const visibleRecommendations = recommendationsExpanded
    ? filteredRecommendations
    : filteredRecommendations.slice(0, RECOMMENDATIONS_PREVIEW_COUNT);

  return (
    <div className="relative bg-mine-900 border-2 border-hazard-500/40 rounded-xl shadow-lg shadow-hazard-500/10 p-4 bg-gradient-to-br from-hazard-500/5 via-transparent to-transparent">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-md bg-hazard-500 text-white text-[10px] font-extrabold tracking-wide shrink-0">
            AI
          </span>
          <h2 className="text-sm font-extrabold text-mine-50 tracking-tight">{t("ai.title")}</h2>
        </div>
        {configured && (
          <div className="flex items-center gap-2">
            {showReportGenerator && (
              <button
                className="text-xs font-bold text-mine-300 hover:text-mine-50 bg-mine-800 hover:bg-mine-700 rounded-full px-3 py-1 transition-colors"
                onClick={() => setOpenReport("EXEC")}
              >
                {t("ai.report.button")}
              </button>
            )}
            {showHrReportGenerator && (
              <button
                className="text-xs font-bold text-mine-300 hover:text-mine-50 bg-mine-800 hover:bg-mine-700 rounded-full px-3 py-1 transition-colors"
                onClick={() => setOpenReport("HR")}
              >
                {t("ai.hrReport.button")}
              </button>
            )}
            <button
              className="text-xs font-bold text-hazard-600 hover:text-hazard-500 bg-hazard-500/10 hover:bg-hazard-500/20 rounded-full px-3 py-1 transition-colors"
              onClick={() => setChatOpen((v) => !v)}
            >
              {chatOpen ? t("ai.hideChat") : t("ai.askQuestion")}
            </button>
          </div>
        )}
      </div>

      {openReport === "EXEC" && (
        <ReportModal
          onClose={() => setOpenReport(null)}
          endpoint="/ai/report"
          sectionKeys={EXEC_REPORT_SECTIONS}
          titleKey="ai.report.title"
          hintKey="ai.report.hint"
          sectionLabelPrefix="ai.report.sections"
        />
      )}
      {openReport === "HR" && (
        <ReportModal
          onClose={() => setOpenReport(null)}
          endpoint="/ai/hr/report"
          sectionKeys={HR_REPORT_SECTIONS}
          titleKey="ai.hrReport.title"
          hintKey="ai.hrReport.hint"
          sectionLabelPrefix="ai.hrReport.sections"
        />
      )}

      {loadingSummary && <div className="text-mine-400 text-xs font-medium">{t("common.loading")}</div>}

      {!loadingSummary && configured === false && (
        <div className="text-xs font-medium text-mine-300 bg-mine-800/60 border border-mine-700 rounded-md p-3">
          {t("ai.notConfigured")}
        </div>
      )}

      {!loadingSummary && configured && summaryLines.length > 0 && (
        <div className="mb-3">
          <ul className="space-y-2">
            {visibleSummaryLines.map((line, i) => {
              const tone = toneOf(line);
              return (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${TONE_DOT[tone]}`} />
                  <span className={`font-bold leading-snug ${TONE_TEXT[tone]}`}>{line}</span>
                </li>
              );
            })}
          </ul>
          {summaryLines.length > SUMMARY_PREVIEW_COUNT && (
            <button
              className="text-[10px] font-bold text-hazard-600 hover:text-hazard-500 mt-1.5"
              onClick={() => setSummaryExpanded((v) => !v)}
            >
              {summaryExpanded ? t("ai.showLess") : t("ai.readMore", { count: summaryLines.length - SUMMARY_PREVIEW_COUNT })}
            </button>
          )}
        </div>
      )}

      {!loadingSummary && configured && recommendations.length > 0 && (
        <div className="border-t-2 border-hazard-500/20 pt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-mine-300">
              {t("ai.insightsTitle", { count: activeRecommendations.length })}
            </h3>
            {resolvedRecommendations.length > 0 && (
              <button
                className="text-[10px] font-bold text-mine-400 hover:text-mine-200"
                onClick={() => {
                  setShowResolved((v) => !v);
                  setRecommendationsExpanded(false);
                }}
              >
                {showResolved ? t("ai.hideResolved") : t("ai.showResolved", { count: resolvedRecommendations.length })}
              </button>
            )}
          </div>
          {visibleRecommendations.length === 0 && (
            <div className="text-mine-400 text-xs font-medium mb-2">{t("ai.noOpenRecommendations")}</div>
          )}
          <ul className="space-y-2">
            {visibleRecommendations.map((rec) => {
              const tone = toneOfItem(rec);
              const isResolved = rec.status === "ACTIONED" || rec.status === "DISMISSED";
              const nonActionable = NON_ACTIONABLE_KINDS.has(rec.kind);
              return (
                <li key={rec.id} className={`rounded-lg border border-mine-800 p-2.5 ${isResolved ? "opacity-60" : "bg-mine-800/30"}`}>
                  <div className="flex items-start gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${TONE_DOT[tone]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className={`text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded ${KIND_BADGE[rec.kind]}`}>
                          {t(`ai.kind.${rec.kind}`)}
                        </span>
                        <span className={`font-bold text-xs ${TONE_TEXT[tone]}`}>{rec.title}</span>
                      </div>
                      <p className="text-[11px] text-mine-300 font-medium leading-snug">{rec.detail}</p>
                      {isResolved && (
                        <p className="text-[10px] text-mine-400 mt-1 font-semibold">
                          {t(`ai.status.${rec.status}`)}
                          {rec.reviewedBy?.name ? ` — ${rec.reviewedBy.name}` : ""}
                          {rec.reviewNote ? `: "${rec.reviewNote}"` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  {!isResolved && (
                    <div className="flex justify-end gap-1.5 mt-2">
                      {nonActionable ? (
                        <button
                          className="text-[10px] font-bold text-white bg-mine-400 hover:bg-mine-500 rounded px-2 py-1 transition-colors disabled:opacity-50"
                          disabled={reviewingId === rec.id}
                          onClick={() => reviewRecommendation(rec.id, "ACTIONED")}
                        >
                          {t("ai.gotIt")}
                        </button>
                      ) : (
                        <>
                          {routeForTopic(rec.topic) && (
                            <button
                              className="text-[10px] font-bold text-white bg-hazard-500 hover:bg-hazard-600 rounded px-2 py-1 transition-colors disabled:opacity-50"
                              disabled={reviewingId === rec.id}
                              onClick={() => navigate(routeForTopic(rec.topic)!)}
                            >
                              {t("ai.takeAction")}
                            </button>
                          )}
                          {rec.status === "OPEN" && (
                            <button
                              className="text-[10px] font-bold text-mine-300 hover:text-mine-50 bg-mine-800 hover:bg-mine-700 rounded px-2 py-1 transition-colors disabled:opacity-50"
                              disabled={reviewingId === rec.id}
                              onClick={() => reviewRecommendation(rec.id, "ACKNOWLEDGED")}
                            >
                              {t("ai.acknowledge")}
                            </button>
                          )}
                          <button
                            className="text-[10px] font-bold text-white bg-success-500 hover:bg-success-600 rounded px-2 py-1 transition-colors disabled:opacity-50"
                            disabled={reviewingId === rec.id}
                            onClick={() => reviewRecommendation(rec.id, "ACTIONED")}
                          >
                            {t("ai.markActioned")}
                          </button>
                          <button
                            className="text-[10px] font-bold text-mine-300 hover:text-danger-600 bg-mine-800 hover:bg-danger-500/10 rounded px-2 py-1 transition-colors disabled:opacity-50"
                            disabled={reviewingId === rec.id}
                            onClick={() => reviewRecommendation(rec.id, "DISMISSED")}
                          >
                            {t("ai.dismiss")}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {filteredRecommendations.length > RECOMMENDATIONS_PREVIEW_COUNT && (
            <button
              className="text-[10px] font-bold text-hazard-600 hover:text-hazard-500 mt-2"
              onClick={() => setRecommendationsExpanded((v) => !v)}
            >
              {recommendationsExpanded
                ? t("ai.showLess")
                : t("ai.readMore", { count: filteredRecommendations.length - RECOMMENDATIONS_PREVIEW_COUNT })}
            </button>
          )}
        </div>
      )}

      {chatOpen && configured && (
        <div className="mt-3 border-t-2 border-hazard-500/20 pt-3 space-y-2">
          <div ref={scrollRef} className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {messages.length === 0 && <div className="text-mine-400 text-xs font-medium">{t("ai.chatHint")}</div>}
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] ${m.role === "user" ? "ml-auto" : ""}`}>
                <div className={`text-[10px] font-extrabold uppercase tracking-wide mb-0.5 ${m.role === "user" ? "text-hazard-600 text-right" : "text-mine-400"}`}>
                  {m.role === "user" ? t("ai.you") : t("ai.title")}
                </div>
                <div
                  className={`text-xs font-semibold rounded-lg px-3 py-2 whitespace-pre-line ${
                    m.role === "user" ? "bg-hazard-500 text-white" : "bg-mine-800 text-mine-100 border border-mine-700"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && <div className="text-mine-400 text-xs font-medium">{t("ai.thinking")}</div>}
          </div>
          {error && <div className="text-danger-600 text-xs font-bold">{error}</div>}
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              className={`${inputClass} text-xs py-2 font-medium`}
              placeholder={t("ai.inputPlaceholder") ?? ""}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={sending}
            />
            <button type="submit" className={`${buttonPrimary} text-xs px-3 py-2`} disabled={sending || !draft.trim()}>
              {t("ai.send")}
            </button>
            {messages.length > 0 && (
              <button type="button" className={`${buttonSecondary} text-xs px-3 py-2`} onClick={() => setMessages([])} disabled={sending}>
                {t("ai.clear")}
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
