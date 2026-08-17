import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ExecutiveRequestItem, Visitor } from "../api/types";

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
      const isEmergency = request.priority === "EMERGENCY";
      showToast({
        title: isEmergency
          ? t("executiveRequests.toastNewEmergencyTitle", { name: request.fromUser.name })
          : t("executiveRequests.toastNewTitle", { name: request.fromUser.name }),
        body: request.subject,
        onClick: () => navigate("/executive-requests"),
        variant: isEmergency ? "emergency" : "default",
      });
    }

    function onResponded(request: ExecutiveRequestItem) {
      showToast({
        title: t(`executiveRequests.toastResponded.${request.status}`, { name: request.respondedBy?.name ?? "" }),
        body: request.subject,
        onClick: () => navigate("/executive-requests"),
      });
    }

    function onVisitorPending(visitor: Visitor) {
      if (user!.role !== "ADMIN" && user!.role !== "EXECUTIVE") return;
      showToast({
        title: t("visitors.toastPendingTitle", { name: visitor.fullName }),
        body: t("visitors.toastPendingBody", { site: visitor.site?.name ?? "" }),
        onClick: () => navigate("/visitors"),
      });
    }

    socket.on("request:new", onNew);
    socket.on("request:responded", onResponded);
    socket.on("visitor:pending", onVisitorPending);
    return () => {
      socket.off("request:new", onNew);
      socket.off("request:responded", onResponded);
      socket.off("visitor:pending", onVisitorPending);
    };
  }, [socket, user, navigate, showToast, t]);

  return null;
}
