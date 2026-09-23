import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { usePlatformAdminAuth } from "../../context/PlatformAdminAuthContext";

export default function PlatformAdminLogin() {
  const { admin, loading, login } = usePlatformAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (admin) return <Navigate to="/platform-admin/dashboard" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">MineGuard Platform Admin</h1>
          <p className="text-xs text-slate-500 mt-1">Internal customer &amp; license management — separate from the mine-facing app.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
