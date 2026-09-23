import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { platformAdminApi } from "../../api/platformAdminClient";
import { Customer, CustomerStatus } from "../../api/types";

const STATUS_BADGE: Record<CustomerStatus, string> = {
  LEAD: "bg-slate-100 text-slate-600",
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-slate-200 text-slate-500",
};

function licenseBadge(customer: Customer): { label: string; className: string } {
  const license = customer.currentLicense;
  if (!license) return { label: "No license", className: "bg-slate-100 text-slate-500" };
  if (license.status === "SUSPENDED") return { label: "Suspended", className: "bg-red-100 text-red-700" };
  if (license.expiresAt && new Date(license.expiresAt).getTime() < Date.now()) return { label: "Expired", className: "bg-red-100 text-red-700" };
  if (license.expiresAt && new Date(license.expiresAt).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000) {
    return { label: "Expiring soon", className: "bg-amber-100 text-amber-700" };
  }
  return { label: license.plan, className: "bg-green-100 text-green-700" };
}

function NewCustomerForm({ onCreated, onCancel }: { onCreated: (c: Customer) => void; onCancel: () => void }) {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await platformAdminApi.post<Customer>("/platform-admin/customers", {
        companyName,
        contactName,
        contactEmail,
        contactPhone: contactPhone || undefined,
      });
      onCreated(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.formErrors?.join(", ") ?? err.response?.data?.error ?? "Could not create customer");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "w-full border border-slate-300 rounded-md px-3 py-2 text-sm";
  const labelClass = "block text-xs font-semibold text-slate-600 mb-1";

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <h2 className="text-sm font-bold">New customer</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Company name</label>
          <input required className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Contact name</label>
          <input required className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Contact email</label>
          <input required type="email" className={inputClass} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Contact phone</label>
          <input className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </div>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-sm px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white font-semibold disabled:opacity-50">
          {busy ? "Creating…" : "Create customer"}
        </button>
      </div>
    </form>
  );
}

export default function PlatformAdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    const res = await platformAdminApi.get<Customer[]>("/platform-admin/customers");
    setCustomers(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = customers.filter((c) => {
    const haystack = `${c.companyName} ${c.contactName} ${c.contactEmail} ${c.mine?.name ?? ""}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Customers</h1>
        {!creating && (
          <button onClick={() => setCreating(true)} className="text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white font-semibold">
            + New customer
          </button>
        )}
      </div>

      {creating && (
        <NewCustomerForm
          onCancel={() => setCreating(false)}
          onCreated={(c) => {
            setCustomers((prev) => [c, ...prev]);
            setCreating(false);
          }}
        />
      )}

      <input
        placeholder="Search by company, contact or mine name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm border border-slate-300 rounded-md px-3 py-2 text-sm"
      />

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Company</th>
              <th className="text-left px-4 py-2.5">Contact</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Mine</th>
              <th className="text-left px-4 py-2.5">License</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No customers yet.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const badge = licenseBadge(c);
                return (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link to={`/platform-admin/customers/${c.id}`} className="font-semibold text-slate-900 hover:underline">
                        {c.companyName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <div>{c.contactName}</div>
                      <div className="text-xs text-slate-400">{c.contactEmail}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[c.status]}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{c.mine?.name ?? <span className="text-slate-300">Not linked</span>}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
