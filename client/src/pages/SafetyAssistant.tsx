import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { AiChatMessage, AiChatResponse } from "../api/types";
import { buttonPrimary, buttonSecondary, cardClass, inputClass } from "../components/ui";

export default function SafetyAssistant() {
  const { t } = useTranslation();
  // There's no lightweight status endpoint for this chat-only route, so start
  // optimistic — the first real message's response reveals the true `configured` state.
  const [configured, setConfigured] = useState(true);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      const res = await api.post<AiChatResponse>("/ai/safety-chat", { messages: nextMessages });
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("safetyAssistant.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("safetyAssistant.subtitle")}</p>
      </div>

      {!configured && (
        <div className="text-xs font-medium text-mine-300 bg-mine-800/60 border border-mine-700 rounded-md p-3">
          {t("ai.notConfigured")}
        </div>
      )}

      {configured && (
        <div className={`${cardClass} p-4 space-y-3`}>
          <div ref={scrollRef} className="max-h-[28rem] min-h-[16rem] overflow-y-auto space-y-2 pr-1">
            {messages.length === 0 && <div className="text-mine-400 text-sm">{t("safetyAssistant.chatHint")}</div>}
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] ${m.role === "user" ? "ml-auto" : ""}`}>
                <div className={`text-[10px] font-extrabold uppercase tracking-wide mb-0.5 ${m.role === "user" ? "text-hazard-600 text-right" : "text-mine-400"}`}>
                  {m.role === "user" ? t("ai.you") : t("safetyAssistant.nav")}
                </div>
                <div
                  className={`text-sm font-medium rounded-lg px-3 py-2 whitespace-pre-line ${
                    m.role === "user" ? "bg-hazard-500 text-white" : "bg-mine-800 text-mine-100 border border-mine-700"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && <div className="text-mine-400 text-sm">{t("ai.thinking")}</div>}
          </div>
          {error && <div className="text-danger-600 text-xs font-bold">{error}</div>}
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              className={inputClass}
              placeholder={t("safetyAssistant.inputPlaceholder") ?? ""}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={sending}
            />
            <button type="submit" className={buttonPrimary} disabled={sending || !draft.trim()}>
              {t("ai.send")}
            </button>
            {messages.length > 0 && (
              <button type="button" className={buttonSecondary} onClick={() => setMessages([])} disabled={sending}>
                {t("ai.clear")}
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
