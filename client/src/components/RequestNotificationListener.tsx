import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ExecutiveRequestItem } from "../api/types";

export default function RequestNotificationListener() {
  const { t } = useTranslation();
  const socket = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    if (!socket || !user) return;

    function onNew(request: ExecutiveRequestItem) {
      const isRecipient = user!.role === "ADMIN" || user!.title === request.toTitle;
      if (!isRecipient || request.fromUser.id === user!.id) return;
      showToast({
        title: t("executiveRequests.toastNewTitle", { name: request.fromUser.name }),
        body: request.subject,
        onClick: () => navigate("/executive-requests"),
      });
    }

    function onResponded(request: ExecutiveRequestItem) {
      showToast({
        title: t(`executiveRequests.toastResponded.${request.status}`, { name: request.respondedBy?.name ?? "" }),
        body: request.subject,
        onClick: () => navigate("/executive-requests"),
      });
    }

    socket.on("request:new", onNew);
    socket.on("request:responded", onResponded);
    return () => {
      socket.off("request:new", onNew);
      socket.off("request:responded", onResponded);
    };
  }, [socket, user, navigate, showToast, t]);

  return null;
}
