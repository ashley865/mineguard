import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { ExecutiveRequestCategory, ExecutiveRequestItem, ExecutiveTitle } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import FileDropzone from "../components/FileDropzone";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";

const executiveTitles: ExecutiveTitle[] = [
  "GENERAL_MANAGER",
  "CFO",
  "COO",
  "HR_MANAGER",
  "SECURITY_MANAGER",
  "SAFETY_MANAGER",
  "OPERATIONS_MANAGER",
  "COMPLIANCE_OFFICER",
  "IT_MANAGER",
];

const categories: ExecutiveRequestCategory[] = [
  "PAYROLL_PAYMENT",
  "INVOICE_APPROVAL",
  "PURCHASE_APPROVAL",
  "BUDGET_APPROVAL",
  "DOCUMENT_REVIEW",
  "GENERAL",
];

// Extensible per-department form config: departments not listed here just get the
// generic subject/message form. Add an entry here when a department's requests need
// a structured field the generic form doesn't cover (e.g. CFO requests need an amount).
const DEPARTMENT_EXTRA_FIELDS: Partial<Record<ExecutiveTitle, { amount?: boolean }>> = {
  CFO: { amount: true },
};

type TabKey = "received" | "sent";

function NewRequestForm({ onSubmit, onCancel }: {
  onSubmit: (form: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [toTitle, setToTitle] = useState<ExecutiveTitle>("CFO");
  const [category, setCategory] = useState<ExecutiveRequestCategory>("GENERAL");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "EMERGENCY">("NORMAL");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extraFields = DEPARTMENT_EXTRA_FIELDS[toTitle];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const form = new FormData();
      form.append("toTitle", toTitle);
      form.append("category", category);
      form.append("subject", subject);
      form.append("message", message);
      form.append("priority", priority);
      if (extraFields?.amount && amount) form.append("amount", amount);
      if (attachment) form.append("attachment", attachment);
      await onSubmit(form);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("executiveRequests.createError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("executiveRequests.sendTo")}</label>
          <select className={selectClass} value={toTitle} onChange={(e) => setToTitle(e.target.value as ExecutiveTitle)}>
            {executiveTitles.map((ti) => <option key={ti} value={ti}>{t(`settings.invites.titles.${ti}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("executiveRequests.category")}</label>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as ExecutiveRequestCategory)}>
            {categories.map((c) => <option key={c} value={c}>{t(`executiveRequests.categories.${c}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("executiveRequests.subject")}</label>
        <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>
      {extraFields?.amount && (
        <div>
          <label className={labelClass}>{t("executiveRequests.amountNeeded")}</label>
          <input className={inputClass} type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
      )}
      <div>
        <label className={labelClass}>{t("executiveRequests.message")}</label>
        <textarea className={inputClass} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("executiveRequests.attachment")}</label>
        <FileDropzone accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" hint={t("executiveRequests.attachmentHint") ?? ""} onFiles={(files) => setAttachment(files.item(0))} />
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-mine-200 bg-mine-800/40 border border-mine-800 rounded-lg px-3 py-2 cursor-pointer">
        <input
          type="checkbox"
          checked={priority === "EMERGENCY"}
          onChange={(e) => setPriority(e.target.checked ? "EMERGENCY" : "NORMAL")}
        />
        <span>
          <span className="text-danger-500 font-bold">{t("executiveRequests.emergencyMode")}</span>
          {" — "}
          {t("executiveRequests.emergencyModeHint")}
        </span>
      </label>
      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("executiveRequests.send")}</button>
      </div>
    </form>
  );
}

function RequestCard({ request, mine, onRespond }: {
  request: ExecutiveRequestItem;
  mine: boolean;
  onRespond: (id: string, status: "APPROVED" | "REJECTED" | "COMPLETED", note: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  async function act(status: "APPROVED" | "REJECTED" | "COMPLETED") {
    setActing(status);
    try {
      await onRespond(request.id, status, note);
      setNote("");
    } finally {
      setActing(null);
    }
  }

  const isEmergency = request.priority === "EMERGENCY";

  return (
    <div className={`${cardClass} p-4 space-y-2 ${isEmergency ? "border-2 border-danger-500/60 shadow-lg shadow-danger-500/10" : ""}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {isEmergency && (
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-white bg-danger-500 px-2 py-0.5 rounded-full animate-pulse">
                {t("executiveRequests.emergencyBadge")}
              </span>
            )}
            <span className="text-[10px] uppercase tracking-wide text-mine-400 bg-mine-800 px-2 py-0.5 rounded-full">
              {t(`executiveRequests.categories.${request.category}`)}
            </span>
            <StatusBadge status={request.status} />
          </div>
          <div className="text-sm font-semibold">{request.subject}</div>
          {typeof request.amount === "number" && (
            <div className="text-sm font-bold text-hazard-500 mt-0.5">
              {t("executiveRequests.amountNeeded")}: R{request.amount.toLocaleString()}
            </div>
          )}
          <div className="text-xs text-mine-400 mt-0.5">
            {mine
              ? t("executiveRequests.toLine", { title: t(`settings.invites.titles.${request.toTitle}`) })
              : t("executiveRequests.fromLine", { name: request.fromUser.name })}
            {" · "}
            {new Date(request.createdAt).toLocaleString()}
          </div>
        </div>
      </div>
      <p className="text-sm text-mine-200 whitespace-pre-line">{request.message}</p>
      {request.hasAttachment && (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs text-hazard-400 hover:text-hazard-300"
          onClick={async () => {
            const res = await api.get(`/executive-requests/${request.id}/attachment`, { responseType: "blob" });
            const url = window.URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = request.fileName ?? "attachment";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
          }}
        >
          📎 {request.fileName}
        </button>
      )}
      {request.responseNote && (
        <div className="text-xs text-mine-400 italic border-t border-mine-800 pt-2">
          {t("executiveRequests.responseNote", { name: request.respondedBy?.name ?? "" })}: "{request.responseNote}"
        </div>
      )}
      {!mine && request.status === "PENDING" && (
        <div className="space-y-2 border-t border-mine-800 pt-2">
          <input className={`${inputClass} text-xs`} placeholder={t("executiveRequests.notePlaceholder") ?? ""} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button className={`${buttonPrimary} text-xs px-3 py-1.5`} disabled={acting !== null} onClick={() => act("APPROVED")}>
              {acting === "APPROVED" ? t("common.saving") : t("executiveRequests.approve")}
            </button>
            <button className={`${buttonSecondary} text-xs px-3 py-1.5`} disabled={acting !== null} onClick={() => act("REJECTED")}>
              {acting === "REJECTED" ? t("common.saving") : t("executiveRequests.reject")}
            </button>
          </div>
        </div>
      )}
      {!mine && request.status === "APPROVED" && (
        <div className="border-t border-mine-800 pt-2">
          <button className={`${buttonPrimary} text-xs px-3 py-1.5`} disabled={acting !== null} onClick={() => act("COMPLETED")}>
            {acting === "COMPLETED" ? t("common.saving") : t("executiveRequests.markCompleted")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ExecutiveRequests() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const socket = useSocket();
  const [items, setItems] = useState<ExecutiveRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("received");
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<ExecutiveRequestItem[]>("/executive-requests");
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on("request:new", refresh);
    socket.on("request:responded", refresh);
    return () => {
      socket.off("request:new", refresh);
      socket.off("request:responded", refresh);
    };
  }, [socket]);

  async function createRequest(form: FormData) {
    await api.post("/executive-requests", form, { headers: { "Content-Type": "multipart/form-data" } });
    setModal(false);
    await load();
  }

  async function respond(id: string, status: "APPROVED" | "REJECTED" | "COMPLETED", note: string) {
    await api.put(`/executive-requests/${id}/respond`, { status, responseNote: note || undefined });
    await load();
  }

  const sent = items.filter((r) => r.fromUser.id === user?.id);
  const received = items.filter((r) => r.fromUser.id !== user?.id);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("executiveRequests.nav")}</h1>
          <p className="text-mine-300 text-sm">{t("executiveRequests.subtitle")}</p>
        </div>
        <button className={buttonPrimary} onClick={() => setModal(true)}>{t("executiveRequests.newRequest")}</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className={tab === "received" ? buttonPrimary : buttonSecondary} onClick={() => setTab("received")}>
          {t("executiveRequests.tabReceived", { count: received.length })}
        </button>
        <button className={tab === "sent" ? buttonPrimary : buttonSecondary} onClick={() => setTab("sent")}>
          {t("executiveRequests.tabSent", { count: sent.length })}
        </button>
      </div>

      <div className="space-y-3">
        {tab === "received" &&
          (received.length === 0 ? (
            <div className={`${cardClass} p-6 text-center text-mine-400`}>{t("executiveRequests.noneReceived")}</div>
          ) : (
            received.map((r) => <RequestCard key={r.id} request={r} mine={false} onRespond={respond} />)
          ))}
        {tab === "sent" &&
          (sent.length === 0 ? (
            <div className={`${cardClass} p-6 text-center text-mine-400`}>{t("executiveRequests.noneSent")}</div>
          ) : (
            sent.map((r) => <RequestCard key={r.id} request={r} mine={true} onRespond={respond} />)
          ))}
      </div>

      {modal && (
        <Modal title={t("executiveRequests.newRequestTitle")} onClose={() => setModal(false)}>
          <NewRequestForm onSubmit={createRequest} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
