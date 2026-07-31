import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Message } from "../api/types";

export default function MessagesBell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const socket = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);

  async function load() {
    const res = await api.get<{ count: number }>("/messages/unread-count");
    setUnreadCount(res.data.count);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!socket || !user) return;
    const handler = (message: Message) => {
      if (message.recipientId === user.id) load();
    };
    socket.on("message:new", handler);
    return () => {
      socket.off("message:new", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user?.id]);

  return (
    <Link
      to="/messages"
      className="relative w-9 h-9 flex items-center justify-center rounded-lg text-mine-200 hover:bg-mine-800 hover:text-mine-50 transition-colors"
      aria-label={t("messages.nav")}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger-500 text-white text-[10px] leading-4 text-center font-semibold">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
