import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { platformAdminApi } from "../../api/platformAdminClient";
import { Customer, CustomerStatus, LicenseKey, LicenseKeyStatus, LicensePlan, PlatformAdminMine } from "../../api/types";

const inputClass = "w-full border border-slate-300 rounded-md px-3 py-2 text-sm";
const labelClass = "block text-xs font-semibold text-slate-600 mb-1";

const LICENSE_STATUS_BADGE: Record<LicenseKeyStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  SUSPENDED: "bg-red-100 text-red-700",
  REVOKED: "bg-slate-200 text-slate-500",
};

function isExpired(license: LicenseKey): boolean {
  return !!license.expiresAt && new Date(license.expiresAt).getTime() < Date.now();
}

function CustomerEditForm({ customer, onSaved }: { customer: Customer; onSaved: (c: Customer) => void }) {
  const [companyName, setCompanyName] = useState(customer.companyName);
  const [contactName, setContactName] = useState(customer.contactName);
  const [contactEmail, setContactEmail] = useState(customer.contactEmail);
  const [contactPhone, setContactPhone] = useState(customer.contactPhone ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [status, setStatus] = useState<CustomerStatus>(customer.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await platformAdminApi.put<Customer>(`/platform-admin/customers/${customer.id}`, {
        companyName,
        contactName,
        contactEmail,
        contactPhone: contactPhone || null,
        address: address || null,
        notes: notes || null,
        status,
      });
      onSaved(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <h2 className="text-sm font-bold">Customer details</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Company name</label>
          <input required className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as CustomerStatus)}>
            <option value="LEAD">Lead</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
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
        <div>
          <label className={labelClass}>Address</label>
          <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Notes</label>
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className="text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white font-semibold disabled:opacity-50">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function MineLink({ customer, onChanged }: { customer: Customer; onChanged: (c: Customer) => void }) {
  const [mines, setMines] = useState<PlatformAdminMine[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customer.mineId) {
      platformAdminApi.get<PlatformAdminMine[]>("/platform-admin/mines").then((r) => setMines(r.data));
    }
  }, [customer.mineId]);

  async function link() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await platformAdminApi.post<Customer>(`/platform-admin/customers/${customer.id}/link-mine`, { mineId: selected });
      onChanged(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Could not link mine");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    if (!confirm("Unlink this mine from this customer? Its license enforcement stops until relinked.")) return;
    setBusy(true);
    try {
      const res = await platformAdminApi.post<Customer>(`/platform-admin/customers/${customer.id}/unlink-mine`);
      onChanged(res.data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <h2 className="text-sm font-bold">Mine tenant</h2>
      {customer.mine ? (
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-semibold">{customer.mine.name}</div>
            <div className="text-xs text-slate-500">{customer.mine.location}</div>
          </div>
          <button onClick={unlink} disabled={busy} className="text-xs text-red-600 hover:underline">
            Unlink
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select className={inputClass} value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Select a mine…</option>
            {mines.map((m) => (
              <option key={m.id} value={m.id} disabled={!!m.customer}>
                {m.name} {m.customer ? `(linked to ${m.customer.companyName})` : ""}
              </option>
            ))}
          </select>
          <button onClick={link} disabled={busy || !selected} className="text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white font-semibold whitespace-nowrap disabled:opacity-50">
            Link
          </button>
        </div>
      )}
      {error && <div className="text-xs text-red-600">{error}</div>}
      <p className="text-[11px] text-slate-400">
        Until a mine is linked here, that tenant is unrestricted by licensing (grandfathered), not blocked.
      </p>
    </div>
  );
}

function IssueLicenseForm({ customerId, onIssued }: { customerId: string; onIssued: (l: LicenseKey) => void }) {
  const [plan, setPlan] = useState<LicensePlan>("PROFESSIONAL");
  const [seats, setSeats] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await platformAdminApi.post<LicenseKey>(`/platform-admin/customers/${customerId}/licenses`, {
        plan,
        seats: seats ? Number(seats) : undefined,
        expiresAt: expiresAt || undefined,
        notes: notes || undefined,
      });
      onIssued(res.data);
      setOpen(false);
      setSeats("");
      setExpiresAt("");
      setNotes("");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Could not issue license");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white font-semibold">
        + Issue license
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Plan</label>
          <select className={inputClass} value={plan} onChange={(e) => setPlan(e.target.value as LicensePlan)}>
            <option value="STARTER">Starter</option>
            <option value="PROFESSIONAL">Professional</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Seats (optional)</label>
          <input type="number" min={1} className={inputClass} value={seats} onChange={(e) => setSeats(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Expires (optional)</label>
          <input type="date" className={inputClass} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
        <div className="sm:col-span-3">
          <label className={labelClass}>Notes</label>
          <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-sm px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white font-semibold disabled:opacity-50">
          {busy ? "Issuing…" : "Issue license"}
        </button>
      </div>
    </form>
  );
}

function LicenseRow({ license, onChanged }: { license: LicenseKey; onChanged: (l: LicenseKey) => void }) {
  const [busy, setBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState(license.expiresAt ? license.expiresAt.slice(0, 10) : "");

  async function setStatus(status: LicenseKeyStatus) {
    if (status === "REVOKED" && !confirm("Revoke this license? This can't be undone — issue a new one to replace it.")) return;
    setBusy(true);
    try {
      const res = await platformAdminApi.put<LicenseKey>(`/platform-admin/licenses/${license.id}`, { status });
      onChanged(res.data);
    } finally {
      setBusy(false);
    }
  }

  async function saveExpiry() {
    setBusy(true);
    try {
      const res = await platformAdminApi.put<LicenseKey>(`/platform-admin/licenses/${license.id}`, { expiresAt: expiresAt || null });
      onChanged(res.data);
    } finally {
      setBusy(false);
    }
  }

  const expired = isExpired(license);

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-2.5 font-mono text-xs">{license.key}</td>
      <td className="px-4 py-2.5">{license.plan}</td>
      <td className="px-4 py-2.5">{license.seats ?? "—"}</td>
      <td className="px-4 py-2.5">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${expired && license.status === "ACTIVE" ? "bg-amber-100 text-amber-700" : LICENSE_STATUS_BADGE[license.status]}`}>
          {expired && license.status === "ACTIVE" ? "Expired" : license.status}
        </span>
      </td>
      <td className="px-4 py-2.5">
        {license.status === "REVOKED" ? (
          license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : "—"
        ) : (
          <div className="flex items-center gap-1.5">
            <input type="date" className="border border-slate-300 rounded-md px-2 py-1 text-xs" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            <button onClick={saveExpiry} disabled={busy} className="text-xs text-slate-600 hover:underline">
              Save
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-2.5 text-right whitespace-nowrap">
        {license.status !== "REVOKED" && (
          <div className="flex justify-end gap-2">
            {license.status === "ACTIVE" ? (
              <button onClick={() => setStatus("SUSPENDED")} disabled={busy} className="text-xs text-amber-600 hover:underline">
                Suspend
              </button>
            ) : (
              <button onClick={() => setStatus("ACTIVE")} disabled={busy} className="text-xs text-green-700 hover:underline">
                Reactivate
              </button>
            )}
            <button onClick={() => setStatus("REVOKED")} disabled={busy} className="text-xs text-red-600 hover:underline">
              Revoke
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function PlatformAdminCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);

  async function load() {
    const res = await platformAdminApi.get<Customer>(`/platform-admin/customers/${id}`);
    setCustomer(res.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!customer) return <div className="text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/platform-admin/customers" className="text-xs text-slate-500 hover:underline">
          ← All customers
        </Link>
        <h1 className="text-xl font-bold mt-1">{customer.companyName}</h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <CustomerEditForm customer={customer} onSaved={setCustomer} />
        <MineLink customer={customer} onChanged={setCustomer} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-bold">License history</h2>
          <IssueLicenseForm customerId={customer.id} onIssued={(l) => setCustomer({ ...customer, licenses: [l, ...customer.licenses], currentLicense: l })} />
        </div>
        {customer.licenses.length === 0 ? (
          <p className="text-sm text-slate-400">No licenses issued yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2">Key</th>
                  <th className="text-left px-4 py-2">Plan</th>
                  <th className="text-left px-4 py-2">Seats</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customer.licenses.map((l) => (
                  <LicenseRow
                    key={l.id}
                    license={l}
                    onChanged={(updated) =>
                      setCustomer((prev) =>
                        prev ? { ...prev, licenses: prev.licenses.map((x) => (x.id === updated.id ? updated : x)) } : prev
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
