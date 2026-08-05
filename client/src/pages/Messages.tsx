import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useCall } from "../context/CallContext";
import { Message, MessageContact, MessageGroup } from "../api/types";
import Modal from "../components/Modal";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

type Selection = { type: "contact"; id: string } | { type: "group"; id: string } | null;

function NewGroupForm({ contacts, onSubmit, onCancel }: {
  contacts: MessageContact[];
  onSubmit: (name: string, memberIds: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMember(id: string) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(name, memberIds);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("messages.groupCreateError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("messages.groupName")}</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("messages.groupMembers")}</label>
        <div className="border border-mine-800 rounded-lg max-h-48 overflow-y-auto divide-y divide-mine-800">
          {contacts.map((c) => (
            <label key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-mine-800/40">
              <input type="checkbox" checked={memberIds.includes(c.id)} onChange={() => toggleMember(c.id)} />
              <span className="truncate">{c.name}</span>
            </label>
          ))}
          {contacts.length === 0 && <div className="px-3 py-2 text-xs text-mine-400">{t("messages.noContacts")}</div>}
        </div>
      </div>
      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving || memberIds.length === 0}>
          {saving ? t("common.saving") : t("messages.createGroup")}
        </button>
      </div>
    </form>
  );
}

export default function Messages() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const socket = useSocket();
  const { callState, startCall } = useCall();
  const [contacts, setContacts] = useState<MessageContact[]>([]);
  const [groups, setGroups] = useState<MessageGroup[]>([]);
  const [selected, setSelected] = useState<Selection>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedContact = selected?.type === "contact" ? contacts.find((c) => c.id === selected.id) ?? null : null;
  const selectedGroup = selected?.type === "group" ? groups.find((g) => g.id === selected.id) ?? null : null;

  async function loadContacts() {
    setLoadingContacts(true);
    const [c, g] = await Promise.all([
      api.get<MessageContact[]>("/messages/contacts"),
      api.get<MessageGroup[]>("/messages/groups"),
    ]);
    setContacts(c.data);
    setGroups(g.data);
    setLoadingContacts(false);
  }

  async function loadThread(sel: Selection) {
    if (!sel) return;
    setLoadingThread(true);
    const res =
      sel.type === "contact"
        ? await api.get<Message[]>(`/messages/thread/${sel.id}`)
        : await api.get<Message[]>(`/messages/groups/${sel.id}/thread`);
    setThread(res.data);
    setLoadingThread(false);
    if (sel.type === "contact") {
      setContacts((prev) => prev.map((c) => (c.id === sel.id ? { ...c, unreadCount: 0 } : c)));
    }
  }

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (selected) loadThread(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.type, selected?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  useEffect(() => {
    if (!socket || !user) return;
    const handler = (message: Message) => {
      const isForThisThread =
        (selected?.type === "group" && message.groupId === selected.id) ||
        (selected?.type === "contact" &&
          ((message.senderId === selected.id && message.recipientId === user.id) ||
            (message.senderId === user.id && message.recipientId === selected.id)));
      if (isForThisThread) {
        setThread((prev) => [...prev, message]);
      } else if (message.recipientId === user.id || message.groupId) {
        loadContacts();
      }
    };
    const groupHandler = () => loadContacts();
    socket.on("message:new", handler);
    socket.on("group:new", groupHandler);
    return () => {
      socket.off("message:new", handler);
      socket.off("group:new", groupHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user?.id, selected?.type, selected?.id]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!selected || !body.trim()) return;
    setSending(true);
    try {
      await api.post(
        "/messages",
        selected.type === "contact"
          ? { recipientId: selected.id, body: body.trim() }
          : { groupId: selected.id, body: body.trim() }
      );
      setBody("");
    } finally {
      setSending(false);
    }
  }

  async function createGroup(name: string, memberIds: string[]) {
    await api.post("/messages/groups", { name, memberIds });
    setGroupModal(false);
    await loadContacts();
  }

  const selectedName = selectedContact?.name ?? selectedGroup?.name ?? null;
  const selectedSubtitle = selectedContact
    ? selectedContact.title
      ? t(`settings.invites.titles.${selectedContact.title}`)
      : t(`roles.${selectedContact.role}`)
    : selectedGroup
    ? t("messages.groupMemberCount", { count: selectedGroup.members.length })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("messages.title")}</h1>
          <p className="text-mine-300 text-sm">{t("messages.subtitle")}</p>
        </div>
        <button className={buttonSecondary} onClick={() => setGroupModal(true)}>{t("messages.newGroup")}</button>
      </div>

      <div className={`${cardClass} grid grid-cols-1 md:grid-cols-3 h-[32rem] overflow-hidden`}>
        <div className="border-b md:border-b-0 md:border-r border-mine-800 overflow-y-auto">
          {loadingContacts && <div className="p-4 text-sm text-mine-300">{t("common.loading")}</div>}

          {!loadingContacts && groups.length > 0 && (
            <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-mine-500">{t("messages.groupsSection")}</div>
          )}
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelected({ type: "group", id: g.id })}
              className={`w-full text-left px-4 py-3 border-b border-mine-800 hover:bg-mine-800/40 transition-colors ${
                selected?.type === "group" && selected.id === g.id ? "bg-mine-800/60" : ""
              }`}
            >
              <div className="text-sm font-medium truncate">👥 {g.name}</div>
              <div className="text-xs text-mine-400 truncate">{t("messages.groupMemberCount", { count: g.members.length })}</div>
            </button>
          ))}

          {!loadingContacts && (
            <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-mine-500">{t("messages.directSection")}</div>
          )}
          {!loadingContacts && contacts.length === 0 && (
            <div className="p-4 text-sm text-mine-400">{t("messages.noContacts")}</div>
          )}
          {contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected({ type: "contact", id: c.id })}
              className={`w-full text-left px-4 py-3 border-b border-mine-800 hover:bg-mine-800/40 transition-colors ${
                selected?.type === "contact" && selected.id === c.id ? "bg-mine-800/60" : ""
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
                {c.title ? t(`settings.invites.titles.${c.title}`) : t(`roles.${c.role}`)}
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
              <div className="px-4 py-3 border-b border-mine-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{selectedGroup ? `👥 ${selectedName}` : selectedName}</div>
                  <div className="text-xs text-mine-400 truncate">{selectedSubtitle}</div>
                </div>
                {selectedContact && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className={`${buttonSecondary} text-xs px-3 py-1.5`}
                      disabled={callState !== "idle"}
                      onClick={() => startCall(selectedContact.id, selectedContact.name, false)}
                    >
                      {t("calling.voiceCall")}
                    </button>
                    <button
                      className={`${buttonSecondary} text-xs px-3 py-1.5`}
                      disabled={callState !== "idle"}
                      onClick={() => startCall(selectedContact.id, selectedContact.name, true)}
                    >
                      {t("calling.videoCall")}
                    </button>
                  </div>
                )}
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
                        {selectedGroup && !mine && (
                          <div className="text-[10px] font-semibold text-mine-300 mb-0.5">{m.sender.name}</div>
                        )}
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

      {groupModal && (
        <Modal title={t("messages.newGroupTitle")} onClose={() => setGroupModal(false)}>
          <NewGroupForm contacts={contacts} onSubmit={createGroup} onCancel={() => setGroupModal(false)} />
        </Modal>
      )}
    </div>
  );
}
