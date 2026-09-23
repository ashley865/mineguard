import { useEffect, useState } from "react";
import { platformAdminApi } from "../../api/platformAdminClient";
import { PlatformAdminAuditLogEntry } from "../../api/types";

const ACTION_LABEL: Record<string, string> = {
  CUSTOMER_CREATED: "Customer created",
  CUSTOMER_UPDATED: "Customer updated",
  CUSTOMER_DELETED: "Customer deleted",
  MINE_LINKED: "Mine linked",
  MINE_UNLINKED: "Mine unlinked",
  LICENSE_ISSUED: "License issued",
  LICENSE_UPDATED: "License updated",
  LICENSE_SUSPENDED: "License suspended",
  LICENSE_REACTIVATED: "License reactivated",
  LICENSE_REVOKED: "License revoked",
  ADMIN_CREATED: "Admin created",
  ADMIN_REMOVED: "Admin removed",
};

const ACTION_TONE: Record<string, string> = {
  CUSTOMER_DELETED: "text-red-600",
  LICENSE_REVOKED: "text-red-600",
  LICENSE_SUSPENDED: "text-amber-600",
  ADMIN_REMOVED: "text-red-600",
  LICENSE_ISSUED: "text-green-700",
  ADMIN_CREATED: "text-green-700",
};

export default function PlatformAdminAuditLog() {
  const [logs, setLogs] = useState<PlatformAdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformAdminApi.get<PlatformAdminAuditLogEntry[]>("/platform-admin/audit-log").then((r) => {
      setLogs(r.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Audit log</h1>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">When</th>
              <th className="text-left px-4 py-2.5">Admin</th>
              <th className="text-left px-4 py-2.5">Action</th>
              <th className="text-left px-4 py-2.5">Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No actions recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5">{l.actor?.name ?? <span className="text-slate-400">Removed admin</span>}</td>
                  <td className={`px-4 py-2.5 font-semibold ${ACTION_TONE[l.action] ?? "text-slate-700"}`}>{ACTION_LABEL[l.action] ?? l.action}</td>
                  <td className="px-4 py-2.5 text-slate-600">{l.detail ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
