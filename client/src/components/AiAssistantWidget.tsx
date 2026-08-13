import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { AiChatMessage, AiChatResponse, AiSummaryResponse } from "../api/types";
import { buttonPrimary, buttonSecondary, cardClass, inputClass } from "./ui";

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
    <div className={`${cardClass} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold">{t("ai.title")}</h2>
        {configured && (
          <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setChatOpen((v) => !v)}>
            {chatOpen ? t("ai.hideChat") : t("ai.askQuestion")}
          </button>
        )}
      </div>

      {loadingSummary && <div className="text-mine-400 text-xs">{t("common.loading")}</div>}

      {!loadingSummary && configured === false && (
        <div className="text-xs text-mine-400 bg-mine-800/50 border border-mine-700 rounded-md p-3">
          {t("ai.notConfigured")}
        </div>
      )}

      {!loadingSummary && configured && summary && (
        <ul className="space-y-1.5 mb-2">
          {summary
            .split("\n")
            .map((line) => line.replace(/^[-•*]\s*/, "").trim())
            .filter(Boolean)
            .map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-mine-200">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1 bg-hazard-500" />
                {line}
              </li>
            ))}
        </ul>
      )}

      {chatOpen && configured && (
        <div className="mt-3 border-t border-mine-800 pt-3 space-y-2">
          <div ref={scrollRef} className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {messages.length === 0 && <div className="text-mine-400 text-xs">{t("ai.chatHint")}</div>}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-xs rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-line ${
                  m.role === "user" ? "ml-auto bg-hazard-500/20 text-mine-50" : "bg-mine-800 text-mine-200"
                }`}
              >
                {m.content}
              </div>
            ))}
            {sending && <div className="text-mine-400 text-xs">{t("ai.thinking")}</div>}
          </div>
          {error && <div className="text-danger-500 text-xs">{error}</div>}
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              className={`${inputClass} text-xs py-2`}
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
