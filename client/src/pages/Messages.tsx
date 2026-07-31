import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Message, MessageContact } from "../api/types";
import { buttonPrimary, cardClass, inputClass } from "../components/ui";

export default function Messages() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const socket = useSocket();
  const [contacts, setContacts] = useState<MessageContact[]>([]);
  const [selected, setSelected] = useState<MessageContact | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadContacts() {
    setLoadingContacts(true);
    const res = await api.get<MessageContact[]>("/messages/contacts");
    setContacts(res.data);
    setLoadingContacts(false);
  }

  async function loadThread(contactId: string) {
    setLoadingThread(true);
    const res = await api.get<Message[]>(`/messages/thread/${contactId}`);
    setThread(res.data);
    setLoadingThread(false);
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, unreadCount: 0 } : c)));
  }

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (selected) loadThread(selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  useEffect(() => {
    if (!socket || !user) return;
    const handler = (message: Message) => {
      const isForThisThread =
        selected && ((message.senderId === selected.id && message.recipientId === user.id) ||
          (message.senderId === user.id && message.recipientId === selected.id));
      if (isForThisThread) {
        setThread((prev) => [...prev, message]);
        if (message.recipientId === user.id) api.get(`/messages/thread/${selected!.id}`).catch(() => {});
      } else if (message.recipientId === user.id) {
        loadContacts();
      }
    };
    socket.on("message:new", handler);
    return () => {
      socket.off("message:new", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user?.id, selected?.id]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!selected || !body.trim()) return;
    setSending(true);
    try {
      await api.post("/messages", { recipientId: selected.id, body: body.trim() });
      setBody("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("messages.title")}</h1>
        <p className="text-mine-300 text-sm">{t("messages.subtitle")}</p>
      </div>

      <div className={`${cardClass} grid grid-cols-1 md:grid-cols-3 h-[32rem] overflow-hidden`}>
        <div className="border-b md:border-b-0 md:border-r border-mine-800 overflow-y-auto">
          {loadingContacts && <div className="p-4 text-sm text-mine-300">{t("common.loading")}</div>}
          {!loadingContacts && contacts.length === 0 && (
            <div className="p-4 text-sm text-mine-400">{t("messages.noContacts")}</div>
          )}
          {contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={`w-full text-left px-4 py-3 border-b border-mine-800 hover:bg-mine-800/40 transition-colors ${
                selected?.id === c.id ? "bg-mine-800/60" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium truncate">{c.name}</div>
                {c.unreadCount > 0 && (
                  <span className="min-w-[16px] h-4 px-1 rounded-full bg-hazard-500 text-white text-[10px] leading-4 text-center font-semibold shrink-0">
                    {c.unreadCount > 9 ? "9+" : c.unreadCount}
                  </span>
                )}
              </div>
              <div className="text-xs text-mine-400 truncate">
                {c.title ? t(`settings.invites.titles.${c.title}`) : c.role}
              </div>
            </button>
          ))}
        </div>

        <div className="md:col-span-2 flex flex-col min-h-0">
          {!selected && (
            <div className="flex-1 flex items-center justify-center text-sm text-mine-400 p-4 text-center">
              {t("messages.selectContact")}
            </div>
          )}
          {selected && (
            <>
              <div className="px-4 py-3 border-b border-mine-800">
                <div className="text-sm font-semibold">{selected.name}</div>
                <div className="text-xs text-mine-400">
                  {selected.title ? t(`settings.invites.titles.${selected.title}`) : selected.role}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingThread && <div className="text-sm text-mine-300">{t("common.loading")}</div>}
                {!loadingThread && thread.length === 0 && (
                  <div className="text-sm text-mine-400">{t("messages.noMessagesYet")}</div>
                )}
                {thread.map((m) => {
                  const mine = m.senderId === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          mine ? "bg-hazard-500 text-white" : "bg-mine-800 text-mine-50"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-mine-400"}`}>
                          {new Date(m.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={handleSend} className="p-3 border-t border-mine-800 flex gap-2">
                <input
                  className={inputClass}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t("messages.typePlaceholder") ?? ""}
                />
                <button type="submit" className={buttonPrimary} disabled={sending || !body.trim()}>
                  {t("messages.send")}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
