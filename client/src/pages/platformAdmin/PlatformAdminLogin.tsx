import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { platformAdminApi } from "../../api/platformAdminClient";
import { usePlatformAdminAuth } from "../../context/PlatformAdminAuthContext";

// A generated access key rather than email+password: this is the only entry point that
// works before any admin account exists at all, since creating the very first one can't
// depend on already knowing a password nobody has set yet (see /bootstrap in
// routes/platformAdminAuth.ts, which self-disables the moment one admin exists).
function SetupPanel({ onKeyIssued }: { onKeyIssued: (key: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await platformAdminApi.post("/platform-admin/auth/bootstrap", { name, email });
      onKeyIssued(res.data.accessKey as string);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Set up platform admin access</h1>
        <p className="text-xs text-slate-500 mt-1">
          This only works once — it's disabled automatically the moment the first admin account exists.
        </p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Your name</label>
        <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Email (for your records — not used to sign in)</label>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <button type="submit" disabled={busy} className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">
        {busy ? "Creating…" : "Create account & get access key"}
      </button>
    </form>
  );
}

function IssuedKeyPanel({ accessKey, onContinue }: { accessKey: string; onContinue: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(accessKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the key stays selectable on screen either way.
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Save your access key</h1>
        <p className="text-xs text-slate-500 mt-1">This is shown exactly once. If you lose it, you'll need database access to reset it.</p>
      </div>
      <div className="bg-amber-50 border border-amber-300 rounded-md px-3 py-3 space-y-2">
        <code className="block text-xs font-mono break-all text-slate-900">{accessKey}</code>
        <button type="button" onClick={copy} className="text-xs font-semibold text-amber-700 hover:underline">
          {copied ? "Copied" : "Copy to clipboard"}
        </button>
      </div>
      <button onClick={onContinue} className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-semibold hover:bg-slate-800">
        I've saved it — continue to sign in
      </button>
    </div>
  );
}

function SignInPanel({ onSwitchToSetup }: { onSwitchToSetup: () => void }) {
  const { loginWithKey } = usePlatformAdminAuth();
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await loginWithKey(accessKey);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">MineGuard Platform Admin</h1>
        <p className="text-xs text-slate-500 mt-1">Internal customer &amp; license management — separate from the mine-facing app.</p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Access key</label>
        <input
          required
          autoFocus
          type="password"
          placeholder="mgpa_…"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <button type="submit" disabled={busy} className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <button type="button" onClick={onSwitchToSetup} className="w-full text-center text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2">
        First time here? Set up the admin account
      </button>
    </form>
  );
}

export default function PlatformAdminLogin() {
  const { admin, loading } = usePlatformAdminAuth();
  const [view, setView] = useState<"signin" | "setup" | "issued">("signin");
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  if (loading) return null;
  if (admin) return <Navigate to="/platform-admin/dashboard" replace />;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm">
        {view === "signin" && <SignInPanel onSwitchToSetup={() => setView("setup")} />}
        {view === "setup" && (
          <SetupPanel
            onKeyIssued={(key) => {
              setIssuedKey(key);
              setView("issued");
            }}
          />
        )}
        {view === "issued" && issuedKey && <IssuedKeyPanel accessKey={issuedKey} onContinue={() => setView("signin")} />}
      </div>
    </div>
  );
}
