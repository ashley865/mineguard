import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Equipment as EquipmentItem, EquipmentStatus, Site, Zone } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

function EquipmentForm({ sites, zones, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  initial?: Partial<EquipmentItem>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "");
  const [status, setStatus] = useState<EquipmentStatus>(initial?.status ?? "OPERATIONAL");
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [saving, setSaving] = useState(false);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ name, type, status, siteId, zoneId: zoneId || null });
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
          <label className={labelClass}>Type</label>
          <input className={inputClass} value={type} onChange={(e) => setType(e.target.value)} placeholder="Extraction, Ventilation…" required />
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
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as EquipmentStatus)}>
          <option value="OPERATIONAL">Operational</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="DOWN">Down</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

export default function Equipment() {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR";
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | EquipmentItem>(null);

  async function load() {
    setLoading(true);
    const [e, s, z] = await Promise.all([
      api.get<EquipmentItem[]>("/equipment"),
      api.get<Site[]>("/sites"),
      api.get<Zone[]>("/zones"),
    ]);
    setEquipment(e.data);
    setSites(s.data);
    setZones(z.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createEquipment(data: any) {
    await api.post("/equipment", data);
    setModal(null);
    await load();
  }

  async function updateEquipment(id: string, data: any) {
    await api.put(`/equipment/${id}`, data);
    setModal(null);
    await load();
  }

  async function deleteEquipment(id: string) {
    if (!confirm("Remove this equipment record?")) return;
    await api.delete(`/equipment/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">Loading equipment…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Equipment</h1>
          <p className="text-mine-300 text-sm">Operational status of mining equipment across sites</p>
        </div>
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal("create")}>+ New Equipment</button>
        )}
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Site / Zone</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((eq) => (
              <tr key={eq.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{eq.name}</td>
                <td className="px-4 py-2 text-mine-300">{eq.type}</td>
                <td className="px-4 py-2 text-mine-300">
                  {eq.site?.name}{eq.zone?.name ? ` · ${eq.zone.name}` : ""}
                </td>
                <td className="px-4 py-2"><StatusBadge status={eq.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-white" onClick={() => setModal(eq)}>Edit</button>
                      <button className={buttonDanger} onClick={() => deleteEquipment(eq.id)}>Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {equipment.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">No equipment yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? "New Equipment" : "Edit Equipment"} onClose={() => setModal(null)}>
          <EquipmentForm
            sites={sites}
            zones={zones}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? createEquipment(data) : updateEquipment(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
