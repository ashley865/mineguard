import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { RequestNotification, ReviewNotification } from "../api/types";
import { SeverityBadge, StatusBadge } from "./Badges";
import { cardClass } from "./ui";

const SEEN_KEY = "mineguard_notifications_seen";

export default function NotificationBell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();
  const canAct = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<ReviewNotification[]>([]);
  const [requests, setRequests] = useState<RequestNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<number>(() => Number(localStorage.getItem(SEEN_KEY) ?? 0));
  const panelRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await api.get<ReviewNotification[]>("/notifications");
    setItems(res.data);
  }

  async function loadRequests() {
    const res = await api.get<RequestNotification[]>("/request-notifications");
    setRequests(res.data);
  }

  async function openRequest(n: RequestNotification) {
    setOpen(false);
    if (!n.readAt) {
      setRequests((prev) => prev.map((r) => (r.id === n.id ? { ...r, readAt: new Date().toISOString() } : r)));
      api.post(`/request-notifications/${n.id}/read`).catch(() => {});
    }
    if (n.link) navigate(n.link);
  }

  async function markAllRequestsRead() {
    setRequests((prev) => prev.map((r) => (r.readAt ? r : { ...r, readAt: new Date().toISOString() })));
    await api.post("/request-notifications/read-all").catch(() => {});
  }

  function goTo(path: string) {
    setOpen(false);
    navigate(path);
  }

  async function endContract(n: ReviewNotification) {
    if (!n.entityId || !confirm(t("notifications.confirmEndContract"))) return;
    setActingId(n.id);
    try {
      await api.put(`/contractors/${n.entityId}`, { status: "TERMINATED" });
      await load();
    } finally {
      setActingId(null);
    }
  }

  async function cancelOrder(n: ReviewNotification) {
    if (!n.entityId || !confirm(t("notifications.confirmCancelOrder"))) return;
    setActingId(n.id);
    try {
      await api.put(`/procurement/orders/${n.entityId}`, { status: "CANCELLED" });
      await load();
    } finally {
      setActingId(null);
    }
  }

  useEffect(() => {
    load();
    loadRequests();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    const refreshRequests = () => loadRequests();
    socket.on("alert:updated", refresh);
    socket.on("incident:updated", refresh);
    socket.on("notification:new", refreshRequests);
    return () => {
      socket.off("alert:updated", refresh);
      socket.off("incident:updated", refresh);
      socket.off("notification:new", refreshRequests);
    };
  }, [socket]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      const now = Date.now();
      localStorage.setItem(SEEN_KEY, String(now));
      setLastSeen(now);
    }
  }

  const unreadCount = items.filter((n) => new Date(n.reviewedAt).getTime() > lastSeen).length + requests.filter((r) => !r.readAt).length;
  const unreadRequestCount = requests.filter((r) => !r.readAt).length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-mine-200 hover:bg-mine-800 hover:text-mine-50 transition-colors"
        aria-label={t("notifications.title")}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger-500 text-white text-[10px] leading-4 text-center font-semibold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`${cardClass} absolute right-0 mt-2 w-96 max-h-[28rem] overflow-y-auto z-20`}>
          {requests.length > 0 && (
            <>
              <div className="px-4 py-3 border-b border-mine-800 text-sm font-semibold flex items-center justify-between">
                <span>{t("notifications.requestsTitle")}</span>
                {unreadRequestCount > 0 && (
                  <button className="text-xs font-medium text-hazard-400 hover:text-hazard-300" onClick={markAllRequestsRead}>
                    {t("notifications.markAllRead")}
                  </button>
                )}
              </div>
              <div className="divide-y divide-mine-800">
                {requests.map((n) => (
                  <button key={n.id} className="w-full text-left px-4 py-3 hover:bg-mine-800/60 transition-colors" onClick={() => openRequest(n)}>
                    <div className="flex items-center gap-2">
                      {!n.readAt && <span className="w-1.5 h-1.5 rounded-full bg-hazard-500 shrink-0" />}
                      <span className="text-sm">{n.title}</span>
                    </div>
                    {n.body && <div className="text-xs text-mine-400 mt-1">{n.body}</div>}
                    <div className="text-[10px] text-mine-500 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="px-4 py-3 border-b border-mine-800 text-sm font-semibold">{t("notifications.title")}</div>
          <div className="divide-y divide-mine-800">
            {items.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-mine-400">{t("notifications.empty")}</div>
            )}
            {items.map((n) => (
              <div key={n.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wide text-mine-400">
                    {t(`notifications.${n.kind}Label`)}
                  </span>
                  <SeverityBadge severity={n.severity} />
                  <StatusBadge status={n.reviewStatus} />
                </div>
                <div className="text-sm">{n.title}</div>
                <div className="text-xs text-mine-400 mt-1">
                  {n.site?.name}
                  {n.reviewedBy?.name ? ` · ${t("common.reviewedBy", { name: n.reviewedBy.name })}` : ""}
                </div>
                {n.reviewNote && <div className="text-xs text-mine-400 mt-1 italic">"{n.reviewNote}"</div>}
                <div className="text-[10px] text-mine-500 mt-1">
                  {n.reviewStatus === "SCHEDULED"
                    ? t("notifications.dueOn", { date: new Date(n.reviewedAt).toLocaleDateString() })
                    : new Date(n.reviewedAt).toLocaleString()}
                </div>
                {n.kind !== "alert" && n.kind !== "incident" && (
                  <div className="flex items-center gap-2 mt-2">
                    {n.kind === "certification" && (
                      <button className="px-2.5 py-1 rounded-lg text-xs font-medium text-mine-300 hover:text-mine-50 hover:bg-mine-800 transition-colors" onClick={() => goTo("/workers")}>
                        {t("notifications.viewWorker")}
                      </button>
                    )}
                    {n.kind === "contract" && (
                      <>
                        {canAct && (
                          <button
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-danger-400 hover:bg-danger-500/10 transition-colors disabled:opacity-50"
                            disabled={actingId === n.id}
                            onClick={() => endContract(n)}
                          >
                            {actingId === n.id ? t("common.saving") : t("notifications.endContract")}
                          </button>
                        )}
                        <button className="px-2.5 py-1 rounded-lg text-xs font-medium text-mine-300 hover:text-mine-50 hover:bg-mine-800 transition-colors" onClick={() => goTo("/contractors")}>
                          {t("notifications.viewContractor")}
                        </button>
                      </>
                    )}
                    {n.kind === "invoice" && (
                      <button className="px-2.5 py-1 rounded-lg text-xs font-medium text-mine-300 hover:text-mine-50 hover:bg-mine-800 transition-colors" onClick={() => goTo("/invoices")}>
                        {t("notifications.viewInvoice")}
                      </button>
                    )}
                    {n.kind === "order" && (
                      <>
                        {canAct && (
                          <button
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-danger-400 hover:bg-danger-500/10 transition-colors disabled:opacity-50"
                            disabled={actingId === n.id}
                            onClick={() => cancelOrder(n)}
                          >
                            {actingId === n.id ? t("common.saving") : t("notifications.cancelOrder")}
                          </button>
                        )}
                        <button className="px-2.5 py-1 rounded-lg text-xs font-medium text-mine-300 hover:text-mine-50 hover:bg-mine-800 transition-colors" onClick={() => goTo("/procurement")}>
                          {t("notifications.viewOrder")}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
