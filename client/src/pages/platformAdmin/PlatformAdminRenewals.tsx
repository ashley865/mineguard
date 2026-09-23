import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { platformAdminApi } from "../../api/platformAdminClient";
import { Customer, RenewalUrgency } from "../../api/types";

type RenewalRow = Customer & { urgency: RenewalUrgency; daysUntil: number | null };

const URGENCY_LABEL: Record<RenewalUrgency, string> = {
  EXPIRED: "Expired",
  SUSPENDED: "Suspended",
  GRACE_PERIOD: "In grace period",
  EXPIRES_SOON: "Expires soon",
  NO_LICENSE: "No license",
};

const URGENCY_BADGE: Record<RenewalUrgency, string> = {
  EXPIRED: "bg-red-100 text-red-700",
  SUSPENDED: "bg-red-100 text-red-700",
  GRACE_PERIOD: "bg-amber-100 text-amber-700",
  EXPIRES_SOON: "bg-amber-100 text-amber-700",
  NO_LICENSE: "bg-slate-100 text-slate-600",
};

function daysLabel(row: RenewalRow): string {
  if (row.urgency === "NO_LICENSE" || row.urgency === "SUSPENDED") return "—";
  if (row.daysUntil === null) return "—";
  if (row.daysUntil < 0) return `${-row.daysUntil}d overdue`;
  return `${row.daysUntil}d left`;
}

export default function PlatformAdminRenewals() {
  const [rows, setRows] = useState<RenewalRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformAdminApi.get<RenewalRow[]>("/platform-admin/renewals").then((r) => {
      setRows(r.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Renewals</h1>
        <p className="text-xs text-slate-500 mt-1">Every customer whose license needs attention, most urgent first.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Company</th>
              <th className="text-left px-4 py-2.5">Contact</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Timing</th>
              <th className="text-left px-4 py-2.5">Plan</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Nothing needs attention right now.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link to={`/platform-admin/customers/${r.id}`} className="font-semibold text-slate-900 hover:underline">
                      {r.companyName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    <div>{r.contactName}</div>
                    <div className="text-xs text-slate-400">{r.contactEmail}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${URGENCY_BADGE[r.urgency]}`}>{URGENCY_LABEL[r.urgency]}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 tabular-nums">{daysLabel(r)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.currentLicense?.plan ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
