import { FormEvent, useEffect, useState } from "react";
import { platformAdminApi } from "../../api/platformAdminClient";
import { usePlatformAdminAuth } from "../../context/PlatformAdminAuthContext";
import { PlatformAdmin } from "../../api/types";

const inputClass = "w-full border border-slate-300 rounded-md px-3 py-2 text-sm";
const labelClass = "block text-xs font-semibold text-slate-600 mb-1";

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function InviteForm({ onIssued }: { onIssued: (admin: PlatformAdmin, key: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await platformAdminApi.post("/platform-admin/admins", { name, email });
      onIssued(res.data.admin, res.data.accessKey);
      setOpen(false);
      setName("");
      setEmail("");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Could not create admin");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white font-semibold">
        + Add admin
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Name</label>
          <input required autoFocus className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input required type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        A generated access key will be emailed to them if outgoing email is configured, and shown here either way.
      </p>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-sm px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white font-semibold disabled:opacity-50">
          {busy ? "Creating…" : "Create admin"}
        </button>
      </div>
    </form>
  );
}

export default function PlatformAdminTeam() {
  const { admin: self } = usePlatformAdminAuth();
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuedKey, setIssuedKey] = useState<{ email: string; key: string } | null>(null);

  async function load() {
    const res = await platformAdminApi.get<PlatformAdmin[]>("/platform-admin/admins");
    setAdmins(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(a: PlatformAdmin) {
    if (!confirm(`Remove ${a.name} as a platform admin? This can't be undone.`)) return;
    await platformAdminApi.delete(`/platform-admin/admins/${a.id}`);
    await load();
  }

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Team</h1>
        <InviteForm
          onIssued={(a, key) => {
            setAdmins((prev) => [...prev, a]);
            setIssuedKey({ email: a.email, key });
          }}
        />
      </div>

      {issuedKey && (
        <div className="bg-amber-50 border border-amber-300 rounded-md px-4 py-3 space-y-1">
          <div className="text-sm font-semibold text-amber-800">Access key for {issuedKey.email} (shown once):</div>
          <code className="block text-xs font-mono break-all">{issuedKey.key}</code>
          <button onClick={() => setIssuedKey(null)} className="text-xs text-amber-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Name</th>
              <th className="text-left px-4 py-2.5">Email</th>
              <th className="text-left px-4 py-2.5">Last login</th>
              <th className="text-left px-4 py-2.5">Added</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-semibold">
                  {a.name} {a.id === self?.id && <span className="text-[10px] text-slate-400 font-normal">(you)</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{a.email}</td>
                <td className="px-4 py-2.5 text-slate-600">{relativeTime(a.lastLoginAt)}</td>
                <td className="px-4 py-2.5 text-slate-600">{new Date(a.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2.5 text-right">
                  {a.id !== self?.id && admins.length > 1 && (
                    <button onClick={() => remove(a)} className="text-xs text-red-600 hover:underline">
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
