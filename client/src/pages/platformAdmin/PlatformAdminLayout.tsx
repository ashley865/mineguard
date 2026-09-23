import { NavLink, Outlet } from "react-router-dom";
import { usePlatformAdminAuth } from "../../context/PlatformAdminAuthContext";

// Deliberately plain slate/utilitarian, not MineGuard's own navy/amber product styling —
// this is internal tooling for the platform team, and looking visibly different from the
// mine-facing app is a feature: nobody should mistake which system they're in.
const navLink = ({ isActive }: { isActive: boolean }) => `text-sm font-medium ${isActive ? "text-white" : "text-slate-400 hover:text-white"}`;

export default function PlatformAdminLayout() {
  const { admin, logout } = usePlatformAdminAuth();
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex items-center gap-6 flex-wrap">
        <span className="font-bold text-sm tracking-wide whitespace-nowrap">MineGuard · Platform Admin</span>
        <nav className="flex gap-5">
          <NavLink to="/platform-admin/dashboard" className={navLink}>Dashboard</NavLink>
          <NavLink to="/platform-admin/customers" className={navLink}>Customers</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-slate-400">{admin?.name}</span>
          <button onClick={logout} className="text-slate-400 hover:text-white underline underline-offset-2">
            Log out
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-5 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
}
