import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { SocketProvider } from "../context/SocketContext";
import { EvacuationProvider } from "../context/EvacuationContext";
import { CallProvider } from "../context/CallContext";
import { ToastProvider } from "../context/ToastContext";
import Layout from "./Layout";

export default function ProtectedRoute() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mine-950 text-mine-100">
        {t("common.loading")}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SocketProvider>
      <EvacuationProvider>
        <ToastProvider>
          <CallProvider>
            <Layout />
          </CallProvider>
        </ToastProvider>
      </EvacuationProvider>
    </SocketProvider>
  );
}
