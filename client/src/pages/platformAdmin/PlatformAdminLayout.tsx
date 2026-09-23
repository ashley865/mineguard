import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { usePlatformAdminAuth } from "../../context/PlatformAdminAuthContext";

// Deliberately plain slate/utilitarian, not MineGuard's own navy/amber product styling —
// this is internal tooling for the platform team, and looking visibly different from the
// mine-facing app is a feature: nobody should mistake which system they're in.
const navLink = ({ isActive }: { isActive: boolean }) => `text-sm font-medium ${isActive ? "text-white" : "text-slate-400 hover:text-white"}`;

export default function PlatformAdminLayout() {
  const { admin, logout, rotateKey } = usePlatformAdminAuth();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRotate() {
    if (!confirm("Generate a new access key? Your current key stops working immediately.")) return;
    setBusy(true);
    try {
      setNewKey(await rotateKey());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex items-center gap-6 flex-wrap">
        <span className="font-bold text-sm tracking-wide whitespace-nowrap">MineGuard · Platform Admin</span>
        <nav className="flex gap-5">
          <NavLink to="/platform-admin/dashboard" className={navLink}>Dashboard</NavLink>
          <NavLink to="/platform-admin/customers" className={navLink}>Customers</NavLink>
          <NavLink to="/platform-admin/renewals" className={navLink}>Renewals</NavLink>
          <NavLink to="/platform-admin/team" className={navLink}>Team</NavLink>
          <NavLink to="/platform-admin/audit-log" className={navLink}>Audit log</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-slate-400">{admin?.name}</span>
          <button onClick={handleRotate} disabled={busy} className="text-slate-400 hover:text-white underline underline-offset-2 disabled:opacity-50">
            New access key
          </button>
          <button onClick={logout} className="text-slate-400 hover:text-white underline underline-offset-2">
            Log out
          </button>
        </div>
      </header>
      {newKey && (
        <div className="bg-amber-50 border-b border-amber-300 px-5 py-3 text-sm flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-amber-800">New access key (shown once):</span>
          <code className="font-mono text-xs break-all">{newKey}</code>
          <button onClick={() => setNewKey(null)} className="ml-auto text-xs text-amber-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}
      <main className="max-w-6xl mx-auto p-5 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
}
