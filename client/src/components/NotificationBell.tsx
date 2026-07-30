import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { ReviewNotification } from "../api/types";
import { SeverityBadge, StatusBadge } from "./Badges";
import { cardClass } from "./ui";

const SEEN_KEY = "mineguard_notifications_seen";

export default function NotificationBell() {
  const { t } = useTranslation();
  const socket = useSocket();
  const [items, setItems] = useState<ReviewNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(() => Number(localStorage.getItem(SEEN_KEY) ?? 0));
  const panelRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await api.get<ReviewNotification[]>("/notifications");
    setItems(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on("alert:updated", refresh);
    socket.on("incident:updated", refresh);
    return () => {
      socket.off("alert:updated", refresh);
      socket.off("incident:updated", refresh);
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

  const unreadCount = items.filter((n) => new Date(n.reviewedAt).getTime() > lastSeen).length;

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
          <div className="px-4 py-3 border-b border-mine-800 text-sm font-semibold">{t("notifications.title")}</div>
          <div className="divide-y divide-mine-800">
            {items.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-mine-400">{t("notifications.empty")}</div>
            )}
            {items.map((n) => (
              <div key={n.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wide text-mine-400">
                    {n.kind === "alert" ? t("notifications.alertLabel") : t("notifications.incidentLabel")}
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
                <div className="text-[10px] text-mine-500 mt-1">{new Date(n.reviewedAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
