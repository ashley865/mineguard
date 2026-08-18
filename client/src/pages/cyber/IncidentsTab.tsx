import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";
import DateField from "../../components/DateField";
import { CyberAlert, CyberAlertStatus, CyberDomain, CyberIncident, CyberIncidentStatus, CyberSeverity } from "../../api/types";
import { CyberTheme, SEVERITY_ORDER, SeverityPill, StatusPill, cyberButtonDanger, cyberButtonPrimary, cyberButtonSecondary } from "./cyberTheme";
import CyberTable, { CyberTableColumn } from "./CyberTable";
import CyberModal from "./CyberModal";

const domains: CyberDomain[] = ["ENDPOINT", "IDENTITY", "NETWORK", "VULNERABILITY", "EMAIL", "BACKUP", "OT_IOT", "COMPLIANCE", "OTHER"];
const alertStatuses: CyberAlertStatus[] = ["NEW", "INVESTIGATING", "CONTAINED", "RESOLVED", "FALSE_POSITIVE"];
const incidentStatuses: CyberIncidentStatus[] = ["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED"];

function AlertForm({
  theme, initial, assignableUsers, incidents, onSubmit, onCancel,
}: {
  theme: CyberTheme;
  initial?: CyberAlert;
  assignableUsers: { id: string; name: string }[];
  incidents: CyberIncident[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [domain, setDomain] = useState<CyberDomain>(initial?.domain ?? "OTHER");
  const [severity, setSeverity] = useState<CyberSeverity>(initial?.severity ?? "MEDIUM");
  const [status, setStatus] = useState<CyberAlertStatus>(initial?.status ?? "NEW");
  const [source, setSource] = useState(initial?.source ?? "");
  const [affectedAssetName, setAffectedAssetName] = useState(initial?.affectedAssetName ?? "");
  const [assignedToId, setAssignedToId] = useState(initial?.assignedTo?.id ?? "");
  const [incidentId, setIncidentId] = useState(initial?.incidentId ?? "");
  const [saving, setSaving] = useState(false);
  const label = `block text-xs font-semibold mb-1 ${theme.subtext}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        title, description, domain, severity, status, source: source || undefined,
        affectedAssetName: affectedAssetName || undefined, assignedToId: assignedToId || undefined,
        incidentId: incidentId || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className={label}>{t("cyber.alerts.title")}</label>
        <input className={theme.input} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className={label}>{t("common.description")}</label>
        <textarea className={theme.input} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.alerts.domain")}</label>
          <select className={theme.select} value={domain} onChange={(e) => setDomain(e.target.value as CyberDomain)}>
            {domains.map((d) => <option key={d} value={d}>{t(`cyber.domain.${d}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{t("cyber.severityLabel")}</label>
          <select className={theme.select} value={severity} onChange={(e) => setSeverity(e.target.value as CyberSeverity)}>
            {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{t(`cyber.severity.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("common.status")}</label>
          <select className={theme.select} value={status} onChange={(e) => setStatus(e.target.value as CyberAlertStatus)}>
            {alertStatuses.map((s) => <option key={s} value={s}>{t(`cyber.status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{t("cyber.alerts.source")}</label>
          <input className={theme.input} value={source} onChange={(e) => setSource(e.target.value)} placeholder={t("cyber.alerts.sourcePlaceholder") ?? ""} />
        </div>
      </div>
      <div>
        <label className={label}>{t("cyber.vulnerabilities.affectedAssetName")}</label>
        <input className={theme.input} value={affectedAssetName} onChange={(e) => setAffectedAssetName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.assignedTo")}</label>
          <select className={theme.select} value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
            <option value="">{t("cyber.unassigned")}</option>
            {assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{t("cyber.alerts.linkedIncident")}</label>
          <select className={theme.select} value={incidentId} onChange={(e) => setIncidentId(e.target.value)}>
            <option value="">{t("cyber.alerts.noIncident")}</option>
            {incidents.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={cyberButtonSecondary(theme)} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={cyberButtonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function IncidentForm({
  theme, initial, assignableUsers, onSubmit, onCancel,
}: {
  theme: CyberTheme;
  initial?: CyberIncident;
  assignableUsers: { id: string; name: string }[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [severity, setSeverity] = useState<CyberSeverity>(initial?.severity ?? "MEDIUM");
  const [status, setStatus] = useState<CyberIncidentStatus>(initial?.status ?? "OPEN");
  const [affectedAssets, setAffectedAssets] = useState(initial?.affectedAssets ?? "");
  const [riskScore, setRiskScore] = useState(initial?.riskScore?.toString() ?? "");
  const [assignedToId, setAssignedToId] = useState(initial?.assignedTo?.id ?? "");
  const [saving, setSaving] = useState(false);
  const label = `block text-xs font-semibold mb-1 ${theme.subtext}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        title, description, severity, status, affectedAssets: affectedAssets || undefined,
        riskScore: riskScore ? Number(riskScore) : undefined, assignedToId: assignedToId || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className={label}>{t("cyber.incidents.title")}</label>
        <input className={theme.input} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className={label}>{t("common.description")}</label>
        <textarea className={theme.input} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.severityLabel")}</label>
          <select className={theme.select} value={severity} onChange={(e) => setSeverity(e.target.value as CyberSeverity)}>
            {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{t(`cyber.severity.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{t("common.status")}</label>
          <select className={theme.select} value={status} onChange={(e) => setStatus(e.target.value as CyberIncidentStatus)}>
            {incidentStatuses.map((s) => <option key={s} value={s}>{t(`cyber.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={label}>{t("cyber.incidents.affectedAssets")}</label>
        <input className={theme.input} value={affectedAssets} onChange={(e) => setAffectedAssets(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.incidents.riskScore")}</label>
          <input className={theme.input} type="number" min="0" max="100" value={riskScore} onChange={(e) => setRiskScore(e.target.value)} />
        </div>
        <div>
          <label className={label}>{t("cyber.assignedTo")}</label>
          <select className={theme.select} value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
            <option value="">{t("cyber.unassigned")}</option>
            {assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={cyberButtonSecondary(theme)} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={cyberButtonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function IncidentsTab({ theme, canEdit, canDelete, canApprove }: { theme: CyberTheme; canEdit: boolean; canDelete: boolean; canApprove: boolean }) {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<CyberAlert[]>([]);
  const [incidents, setIncidents] = useState<CyberIncident[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertModal, setAlertModal] = useState<null | "create" | CyberAlert>(null);
  const [incidentModal, setIncidentModal] = useState<null | "create" | CyberIncident>(null);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [a, i, u] = await Promise.all([
        api.get<CyberAlert[]>("/cyber-alerts"),
        api.get<CyberIncident[]>("/cyber-incidents"),
        api.get<{ id: string; name: string }[]>("/cyber-identity/assignable-users"),
      ]);
      setAlerts(a.data);
      setIncidents(i.data);
      setAssignableUsers(u.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createAlert(data: any) {
    await api.post("/cyber-alerts", data);
    setAlertModal(null);
    await load();
  }
  async function updateAlert(id: string, data: any) {
    await api.put(`/cyber-alerts/${id}`, data);
    setAlertModal(null);
    await load();
  }
  async function removeAlert(id: string) {
    if (!confirm(t("cyber.alerts.confirmDelete"))) return;
    await api.delete(`/cyber-alerts/${id}`);
    await load();
  }

  async function createIncident(data: any) {
    await api.post("/cyber-incidents", data);
    setIncidentModal(null);
    await load();
  }
  async function updateIncident(id: string, data: any) {
    await api.put(`/cyber-incidents/${id}`, data);
    setIncidentModal(null);
    await load();
  }
  async function setIncidentStatus(id: string, status: CyberIncidentStatus) {
    await api.put(`/cyber-incidents/${id}`, { status });
    await load();
  }
  async function removeIncident(id: string) {
    if (!confirm(t("cyber.incidents.confirmDelete"))) return;
    await api.delete(`/cyber-incidents/${id}`);
    await load();
  }

  if (loading) return <div className={theme.subtext}>{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.incidents.tabIncidents")}</h3>
          {canEdit && <button className={cyberButtonPrimary} onClick={() => setIncidentModal("create")}>{t("cyber.incidents.new")}</button>}
        </div>
        <CyberTable
          theme={theme}
          columns={
            [
              { key: "title", header: t("cyber.incidents.title"), render: (i) => <span className={theme.text}>{i.title}</span>, sortValue: (i) => i.title },
              { key: "severity", header: t("cyber.severityLabel"), render: (i) => <SeverityPill severity={i.severity} />, sortValue: (i) => i.severity },
              { key: "status", header: t("common.status"), render: (i) => <StatusPill status={i.status} /> },
              { key: "alerts", header: t("cyber.incidents.linkedAlerts"), render: (i) => i.alerts.length },
              { key: "risk", header: t("cyber.incidents.riskScore"), render: (i) => i.riskScore ?? "—", sortValue: (i) => i.riskScore ?? 0 },
              { key: "assignedTo", header: t("cyber.assignedTo"), render: (i) => i.assignedTo?.name ?? "—" },
              { key: "created", header: t("cyber.createdAt"), render: (i) => new Date(i.createdAt).toLocaleDateString(), sortValue: (i) => i.createdAt },
            ] as CyberTableColumn<CyberIncident>[]
          }
          rows={incidents}
          rowKey={(i) => i.id}
          emptyMessage={t("cyber.incidents.noneYet")}
          searchValue={(i) => `${i.title} ${i.affectedAssets ?? ""}`}
          actions={(i) => (
            <div className="flex justify-end gap-2 flex-wrap">
              <AuditHistoryButton entityType="CyberIncident" entityId={i.id} />
              <button className={cyberButtonSecondary(theme)} onClick={() => setExpandedIncident(expandedIncident === i.id ? null : i.id)}>
                {expandedIncident === i.id ? t("cyber.incidents.hideDetails") : t("cyber.incidents.viewDetails")}
              </button>
              {canEdit && <button className={cyberButtonSecondary(theme)} onClick={() => setIncidentModal(i)}>{t("common.edit")}</button>}
              {canEdit && i.status === "OPEN" && (
                <button className={cyberButtonSecondary(theme)} onClick={() => setIncidentStatus(i.id, "CONTAINED")}>{t("cyber.incidents.markContained")}</button>
              )}
              {canEdit && i.status !== "RESOLVED" && (i.severity !== "CRITICAL" || canApprove) && (
                <button className={cyberButtonPrimary} onClick={() => setIncidentStatus(i.id, "RESOLVED")}>{t("cyber.incidents.markResolved")}</button>
              )}
              {canDelete && <button className={cyberButtonDanger} onClick={() => removeIncident(i.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
        {expandedIncident && (
          (() => {
            const inc = incidents.find((i) => i.id === expandedIncident);
            if (!inc) return null;
            return (
              <div className={`${theme.panel} p-4 space-y-2`}>
                <div className={`text-xs font-semibold ${theme.text}`}>{inc.title}</div>
                <p className={`text-xs ${theme.subtext}`}>{inc.description}</p>
                {inc.aiSummary && <p className={`text-xs italic ${theme.subtext}`}>{t("cyber.ai.summary")}: {inc.aiSummary}</p>}
                <div className="space-y-1 pt-2">
                  {inc.alerts.map((a) => (
                    <div key={a.id} className={`flex items-center justify-between text-xs border-t ${theme.rowBorder} pt-1.5 first:border-t-0 first:pt-0`}>
                      <span className={theme.text}>{a.title}</span>
                      <div className="flex items-center gap-2">
                        <SeverityPill severity={a.severity} />
                        <StatusPill status={a.status} />
                      </div>
                    </div>
                  ))}
                  {inc.alerts.length === 0 && <div className={`text-xs ${theme.mutedText}`}>{t("cyber.incidents.noLinkedAlerts")}</div>}
                </div>
              </div>
            );
          })()
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.alerts.tabAlerts")}</h3>
          {canEdit && <button className={cyberButtonPrimary} onClick={() => setAlertModal("create")}>{t("cyber.alerts.new")}</button>}
        </div>
        <CyberTable
          theme={theme}
          columns={
            [
              { key: "title", header: t("cyber.alerts.title"), render: (a) => <span className={theme.text}>{a.title}</span>, sortValue: (a) => a.title },
              { key: "domain", header: t("cyber.alerts.domain"), render: (a) => t(`cyber.domain.${a.domain}`), sortValue: (a) => a.domain },
              { key: "severity", header: t("cyber.severityLabel"), render: (a) => <SeverityPill severity={a.severity} />, sortValue: (a) => a.severity },
              { key: "status", header: t("common.status"), render: (a) => <StatusPill status={a.status} /> },
              { key: "incident", header: t("cyber.alerts.linkedIncident"), render: (a) => a.incident?.title ?? "—" },
              { key: "detected", header: t("cyber.alerts.detectedAt"), render: (a) => new Date(a.detectedAt).toLocaleDateString(), sortValue: (a) => a.detectedAt },
            ] as CyberTableColumn<CyberAlert>[]
          }
          rows={alerts}
          rowKey={(a) => a.id}
          emptyMessage={t("cyber.alerts.noneYet")}
          searchValue={(a) => `${a.title} ${a.affectedAssetName ?? ""}`}
          actions={(a) => (
            <div className="flex justify-end gap-2">
              <AuditHistoryButton entityType="CyberAlert" entityId={a.id} />
              {canEdit && <button className={cyberButtonSecondary(theme)} onClick={() => setAlertModal(a)}>{t("common.edit")}</button>}
              {canDelete && <button className={cyberButtonDanger} onClick={() => removeAlert(a.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {alertModal && (
        <CyberModal theme={theme} title={alertModal === "create" ? t("cyber.alerts.newTitle") : t("cyber.alerts.editTitle")} onClose={() => setAlertModal(null)}>
          <AlertForm
            theme={theme}
            initial={alertModal === "create" ? undefined : alertModal}
            assignableUsers={assignableUsers}
            incidents={incidents}
            onSubmit={(data) => (alertModal === "create" ? createAlert(data) : updateAlert(alertModal.id, data))}
            onCancel={() => setAlertModal(null)}
          />
        </CyberModal>
      )}
      {incidentModal && (
        <CyberModal theme={theme} title={incidentModal === "create" ? t("cyber.incidents.newTitle") : t("cyber.incidents.editTitle")} onClose={() => setIncidentModal(null)}>
          <IncidentForm
            theme={theme}
            initial={incidentModal === "create" ? undefined : incidentModal}
            assignableUsers={assignableUsers}
            onSubmit={(data) => (incidentModal === "create" ? createIncident(data) : updateIncident(incidentModal.id, data))}
            onCancel={() => setIncidentModal(null)}
          />
        </CyberModal>
      )}
    </div>
  );
}
