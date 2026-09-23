import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { platformAdminApi } from "../../api/platformAdminClient";
import { PlatformAdminDashboardSummary } from "../../api/types";

function Tile({ label, value, tone }: { label: string; value: number; tone?: "warn" | "bad" }) {
  const toneClass = tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-3xl font-bold mt-1 tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

export default function PlatformAdminDashboard() {
  const [summary, setSummary] = useState<PlatformAdminDashboardSummary | null>(null);

  useEffect(() => {
    platformAdminApi.get<PlatformAdminDashboardSummary>("/platform-admin/dashboard/summary").then((r) => setSummary(r.data));
  }, []);

  if (!summary) return <div className="text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Licensing overview</h1>
        <div className="flex gap-4">
          <Link to="/platform-admin/renewals" className="text-sm font-semibold text-slate-900 underline underline-offset-2">
            Renewals worklist →
          </Link>
          <Link to="/platform-admin/customers" className="text-sm font-semibold text-slate-900 underline underline-offset-2">
            Manage customers →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Customers" value={summary.totalCustomers} />
        <Tile label="Leads" value={summary.leads} />
        <Tile label="Active customers" value={summary.activeCustomers} />
        <Tile label="Inactive customers" value={summary.inactiveCustomers} />
        <Tile label="Active licenses" value={summary.activeLicenses} />
        <Tile label="Expiring within 30 days" value={summary.expiringSoon} tone={summary.expiringSoon > 0 ? "warn" : undefined} />
        <Tile label="Expired / suspended" value={summary.expiredOrSuspended} tone={summary.expiredOrSuspended > 0 ? "bad" : undefined} />
        <Tile label="Mines without a customer link" value={summary.unlinkedMines} tone={summary.unlinkedMines > 0 ? "warn" : undefined} />
      </div>

      {summary.unlinkedMines > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          {summary.unlinkedMines} mine tenant(s) have no customer record and are not license-gated — they're treated as
          grandfathered-in until you link one. This is expected for mines that predate this system.
        </div>
      )}
    </div>
  );
}
