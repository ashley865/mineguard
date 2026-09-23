import { Navigate, Outlet } from "react-router-dom";
import { usePlatformAdminAuth } from "../../context/PlatformAdminAuthContext";

export default function PlatformAdminProtectedRoute() {
  const { admin, loading } = usePlatformAdminAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading…</div>;
  if (!admin) return <Navigate to="/platform-admin/login" replace />;
  return <Outlet />;
}
