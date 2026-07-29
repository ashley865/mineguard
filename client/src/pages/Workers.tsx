import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Site, Worker, WorkerStatus, Zone } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

function WorkerForm({ sites, zones, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  initial?: Partial<Worker>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [employeeId, setEmployeeId] = useState(initial?.employeeId ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [status, setStatus] = useState<WorkerStatus>(initial?.status ?? "OFF_SHIFT");
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name, employeeId, role, phone, status, siteId, zoneId: zoneId || null });
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to save worker");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Name</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>Employee ID</label>
          <input className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Role</label>
          <input className={inputClass} value={role} onChange={(e) => setRole(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Site</label>
          <select className={inputClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Zone</label>
          <select className={inputClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">Unassigned</option>
            {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Status</label>
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as WorkerStatus)}>
          <option value="ON_SHIFT">On shift</option>
          <option value="OFF_SHIFT">Off shift</option>
          <option value="EMERGENCY">Emergency</option>
        </select>
      </div>
      {error && <div className="text-danger-400 text-sm">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

export default function Workers() {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR";
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | Worker>(null);

  async function load() {
    setLoading(true);
    const [w, s, z] = await Promise.all([
      api.get<Worker[]>("/workers"),
      api.get<Site[]>("/sites"),
      api.get<Zone[]>("/zones"),
    ]);
    setWorkers(w.data);
    setSites(s.data);
    setZones(z.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createWorker(data: any) {
    await api.post("/workers", data);
    setModal(null);
    await load();
  }

  async function updateWorker(id: string, data: any) {
    await api.put(`/workers/${id}`, data);
    setModal(null);
    await load();
  }

  async function deleteWorker(id: string) {
    if (!confirm("Remove this worker record?")) return;
    await api.delete(`/workers/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">Loading workers…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Workers</h1>
          <p className="text-mine-300 text-sm">Personnel assigned across sites and zones</p>
        </div>
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal("create")}>+ New Worker</button>
        )}
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Employee ID</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-left px-4 py-2">Site / Zone</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{w.name}</td>
                <td className="px-4 py-2 text-mine-300">{w.employeeId}</td>
                <td className="px-4 py-2 text-mine-300">{w.role}</td>
                <td className="px-4 py-2 text-mine-300">
                  {w.site?.name}{w.zone?.name ? ` · ${w.zone.name}` : ""}
                </td>
                <td className="px-4 py-2"><StatusBadge status={w.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-white" onClick={() => setModal(w)}>Edit</button>
                      <button className={buttonDanger} onClick={() => deleteWorker(w.id)}>Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {workers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">No workers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? "New Worker" : "Edit Worker"} onClose={() => setModal(null)}>
          <WorkerForm
            sites={sites}
            zones={zones}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? createWorker(data) : updateWorker(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
