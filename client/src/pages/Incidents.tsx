import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { AlertSeverity, Incident, IncidentStatus, Site, Zone } from "../api/types";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

function IncidentForm({ sites, zones, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<AlertSeverity>("MEDIUM");
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState("");
  const [saving, setSaving] = useState(false);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ title, description, severity, siteId, zoneId: zoneId || null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Title</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Severity</label>
          <select className={inputClass} value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Site</label>
          <select className={inputClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Zone (optional)</label>
        <select className={inputClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
          <option value="">Whole site</option>
          {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? "Reporting…" : "Report Incident"}</button>
      </div>
    </form>
  );
}

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const [i, s, z] = await Promise.all([
      api.get<Incident[]>("/incidents"),
      api.get<Site[]>("/sites"),
      api.get<Zone[]>("/zones"),
    ]);
    setIncidents(i.data);
    setSites(s.data);
    setZones(z.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createIncident(data: any) {
    await api.post("/incidents", data);
    setModal(false);
    await load();
  }

  async function setStatus(id: string, status: IncidentStatus) {
    await api.put(`/incidents/${id}`, { status });
    await load();
  }

  if (loading) return <div className="text-mine-300">Loading incidents…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Incidents</h1>
          <p className="text-mine-300 text-sm">Manually reported safety incidents and their resolution status</p>
        </div>
        {sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal(true)}>+ Report Incident</button>
        )}
      </div>

      <div className="space-y-3">
        {incidents.map((incident) => (
          <div key={incident.id} className={`${cardClass} p-4`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge severity={incident.severity} />
                  <StatusBadge status={incident.status} />
                  <span className="text-xs text-mine-400">{new Date(incident.createdAt).toLocaleString()}</span>
                </div>
                <div className="font-semibold">{incident.title}</div>
                <div className="text-sm text-mine-300 mt-1">{incident.description}</div>
                <div className="text-xs text-mine-400 mt-1">
                  {incident.site?.name}{incident.zone?.name ? ` · ${incident.zone.name}` : ""}
                  {incident.reportedBy?.name ? ` · reported by ${incident.reportedBy.name}` : ""}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {incident.status === "OPEN" && (
                  <button className={buttonSecondary} onClick={() => setStatus(incident.id, "INVESTIGATING")}>
                    Investigate
                  </button>
                )}
                {incident.status !== "RESOLVED" && (
                  <button className={buttonPrimary} onClick={() => setStatus(incident.id, "RESOLVED")}>
                    Resolve
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {incidents.length === 0 && (
          <div className={`${cardClass} p-6 text-center text-mine-400`}>No incidents reported.</div>
        )}
      </div>

      {modal && (
        <Modal title="Report Incident" onClose={() => setModal(false)}>
          <IncidentForm sites={sites} zones={zones} onSubmit={createIncident} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
