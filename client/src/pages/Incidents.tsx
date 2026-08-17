import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AiIncidentInvestigationResponse, AlertSeverity, Incident, IncidentStatus, Site, Zone } from "../api/types";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import LoadError from "../components/LoadError";

function IncidentInvestigationModal({ incidentId, onClose }: { incidentId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [data, setData] = useState<AiIncidentInvestigationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.post<AiIncidentInvestigationResponse>(`/ai/incident-investigation/${incidentId}`);
      setData(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title={t("incidents.aiInvestigation.title")} onClose={onClose}>
      {loading && <div className="text-mine-300">{t("common.loading")}</div>}
      {loadError && <LoadError onRetry={load} />}
      {!loading && data && !data.configured && (
        <div className="text-xs font-medium text-mine-300 bg-mine-800/60 border border-mine-700 rounded-md p-3">
          {t("ai.notConfigured")}
        </div>
      )}
      {!loading && data?.configured && data.result && (
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-mine-300 mb-2">{t("incidents.aiInvestigation.likelyCauses")}</h3>
            <ul className="space-y-2">
              {data.result.likelyCauses.map((c, i) => (
                <li key={i} className="text-sm">
                  <span className="font-semibold">{c.cause}</span>
                  <p className="text-xs text-mine-300 mt-0.5">{c.detail}</p>
                </li>
              ))}
              {data.result.likelyCauses.length === 0 && <li className="text-xs text-mine-400">{t("incidents.aiInvestigation.none")}</li>}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-mine-300 mb-2">{t("incidents.aiInvestigation.followUpQuestions")}</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-mine-200">
              {data.result.followUpQuestions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </div>
          {data.result.similarPastIncidents && (
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-mine-300 mb-2">{t("incidents.aiInvestigation.similarPast")}</h3>
              <p className="text-sm text-mine-200">{data.result.similarPastIncidents}</p>
            </div>
          )}
          <p className="text-[10px] text-mine-500 border-t border-mine-800 pt-2">{data.disclaimer}</p>
        </div>
      )}
    </Modal>
  );
}

function IncidentForm({ sites, zones, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
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
        <label className={labelClass}>{t("incidents.titleField")}</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("incidents.severity")}</label>
          <select className={selectClass} value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity)}>
            <option value="LOW">{t("incidents.low")}</option>
            <option value="MEDIUM">{t("incidents.medium")}</option>
            <option value="HIGH">{t("incidents.high")}</option>
            <option value="CRITICAL">{t("incidents.critical")}</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("incidents.zoneOptional")}</label>
        <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
          <option value="">{t("incidents.wholeSite")}</option>
          {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("incidents.reporting") : t("incidents.reportIncidentBtn")}</button>
      </div>
    </form>
  );
}

export default function Incidents() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isExecutive = user?.role === "EXECUTIVE";
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [investigatingId, setInvestigatingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [i, s, z] = await Promise.all([
        api.get<Incident[]>("/incidents"),
        api.get<Site[]>("/sites"),
        api.get<Zone[]>("/zones"),
      ]);
      setIncidents(i.data);
      setSites(s.data);
      setZones(z.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
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

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    await api.post(`/incidents/${id}/review`, { decision, note: reviewNotes[id] || undefined });
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("incidents.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("incidents.title")}</h1>
          <p className="text-mine-300 text-sm">{t("incidents.subtitle")}</p>
        </div>
        {sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("incidents.reportIncident")}</button>
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
                  {incident.reviewStatus !== "PENDING" && (
                    <StatusBadge status={incident.reviewStatus} />
                  )}
                  <span className="text-xs text-mine-400">{new Date(incident.createdAt).toLocaleString()}</span>
                </div>
                <div className="font-semibold">{incident.title}</div>
                <div className="text-sm text-mine-300 mt-1">{incident.description}</div>
                <div className="text-xs text-mine-400 mt-1">
                  {incident.site?.name}{incident.zone?.name ? ` · ${incident.zone.name}` : ""}
                  {incident.reportedBy?.name ? ` · ${t("incidents.reportedBy", { name: incident.reportedBy.name })}` : ""}
                </div>
                {incident.reviewedBy && (
                  <div className="text-xs text-mine-500 mt-1">{t("common.reviewedBy", { name: incident.reviewedBy.name })}</div>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0 items-end">
                <div className="flex gap-2">
                  <button className="text-xs font-bold text-hazard-600 hover:text-hazard-500 bg-hazard-500/10 hover:bg-hazard-500/20 rounded-full px-3 py-1 transition-colors" onClick={() => setInvestigatingId(incident.id)}>
                    {t("incidents.aiInvestigation.button")}
                  </button>
                  {incident.status === "OPEN" && (
                    <button className={buttonSecondary} onClick={() => setStatus(incident.id, "INVESTIGATING")}>
                      {t("incidents.investigate")}
                    </button>
                  )}
                  {incident.status !== "RESOLVED" && (
                    <button className={buttonPrimary} onClick={() => setStatus(incident.id, "RESOLVED")}>
                      {t("incidents.resolve")}
                    </button>
                  )}
                </div>
                {isExecutive && incident.reviewStatus === "PENDING" && (
                  <div className="flex gap-2 items-center">
                    <input
                      className="w-32 bg-mine-800 border border-mine-700 rounded-md px-2 py-1 text-xs"
                      placeholder={t("common.reviewNotePlaceholder") ?? ""}
                      value={reviewNotes[incident.id] ?? ""}
                      onChange={(e) => setReviewNotes((prev) => ({ ...prev, [incident.id]: e.target.value }))}
                    />
                    <button className={`${buttonPrimary} text-xs px-3 py-1`} onClick={() => review(incident.id, "APPROVED")}>
                      {t("common.approve")}
                    </button>
                    <button className={`${buttonSecondary} text-xs px-3 py-1`} onClick={() => review(incident.id, "REJECTED")}>
                      {t("common.reject")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {incidents.length === 0 && (
          <div className={`${cardClass} p-6 text-center text-mine-400`}>{t("incidents.noIncidentsReported")}</div>
        )}
      </div>

      {modal && (
        <Modal title={t("incidents.reportIncidentTitle")} onClose={() => setModal(false)}>
          <IncidentForm sites={sites} zones={zones} onSubmit={createIncident} onCancel={() => setModal(false)} />
        </Modal>
      )}

      {investigatingId && (
        <IncidentInvestigationModal incidentId={investigatingId} onClose={() => setInvestigatingId(null)} />
      )}
    </div>
  );
}
