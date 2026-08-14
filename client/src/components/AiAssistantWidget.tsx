import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { AiChatMessage, AiChatResponse, AiSummaryResponse } from "../api/types";
import { buttonPrimary, buttonSecondary, inputClass } from "./ui";

const URGENT_KEYWORDS = ["overdue", "critical", "urgent", "immediate", "escalat", "non-compliant", "unauthorized", "unauthorised"];
const CAUTION_KEYWORDS = ["pending", "review", "attention", "expir", "due soon", "approval", "outstanding", "shortage"];

type Tone = "urgent" | "caution" | "neutral";

function toneOf(line: string): Tone {
  const lower = line.toLowerCase();
  if (URGENT_KEYWORDS.some((k) => lower.includes(k))) return "urgent";
  if (CAUTION_KEYWORDS.some((k) => lower.includes(k))) return "caution";
  return "neutral";
}

const TONE_TEXT: Record<Tone, string> = {
  urgent: "text-danger-600",
  caution: "text-hazard-600",
  neutral: "text-mine-50",
};
const TONE_DOT: Record<Tone, string> = {
  urgent: "bg-danger-500",
  caution: "bg-hazard-500",
  neutral: "bg-mine-400",
};

export default function AiAssistantWidget() {
  const { t } = useTranslation();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<AiSummaryResponse>("/ai/summary")
      .then((res) => {
        setConfigured(res.data.configured);
        setSummary(res.data.summary);
      })
      .catch(() => setConfigured(false))
      .finally(() => setLoadingSummary(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

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
          <button
            className="text-xs font-bold text-hazard-600 hover:text-hazard-500 bg-hazard-500/10 hover:bg-hazard-500/20 rounded-full px-3 py-1 transition-colors"
            onClick={() => setChatOpen((v) => !v)}
          >
            {chatOpen ? t("ai.hideChat") : t("ai.askQuestion")}
          </button>
        )}
      </div>

      {loadingSummary && <div className="text-mine-400 text-xs font-medium">{t("common.loading")}</div>}

      {!loadingSummary && configured === false && (
        <div className="text-xs font-medium text-mine-300 bg-mine-800/60 border border-mine-700 rounded-md p-3">
          {t("ai.notConfigured")}
        </div>
      )}

      {!loadingSummary && configured && summary && (
        <ul className="space-y-2 mb-2">
          {summary
            .split("\n")
            .map((line) => line.replace(/^[-•*]\s*/, "").trim())
            .filter(Boolean)
            .map((line, i) => {
              const tone = toneOf(line);
              return (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${TONE_DOT[tone]}`} />
                  <span className={`font-bold leading-snug ${TONE_TEXT[tone]}`}>{line}</span>
                </li>
              );
            })}
        </ul>
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
