import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";
import { CyberSeverity, CyberVulnerability, CyberVulnerabilityStatus } from "../../api/types";
import DateField from "../../components/DateField";
import { CyberTheme, SEVERITY_ORDER, SeverityPill, StatusPill, cyberButtonDanger, cyberButtonPrimary, cyberButtonSecondary } from "./cyberTheme";
import CyberTable, { CyberTableColumn } from "./CyberTable";
import CyberModal from "./CyberModal";

const vulnStatuses: CyberVulnerabilityStatus[] = ["OPEN", "IN_PROGRESS", "PATCHED", "ACCEPTED_RISK", "FALSE_POSITIVE"];

function VulnerabilityForm({
  theme, initial, assignableUsers, onSubmit, onCancel,
}: {
  theme: CyberTheme;
  initial?: CyberVulnerability;
  assignableUsers: { id: string; name: string }[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [cveId, setCveId] = useState(initial?.cveId ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [cvssScore, setCvssScore] = useState(initial?.cvssScore?.toString() ?? "");
  const [severity, setSeverity] = useState<CyberSeverity>(initial?.severity ?? "MEDIUM");
  const [affectedAssetName, setAffectedAssetName] = useState(initial?.affectedAssetName ?? "");
  const [status, setStatus] = useState<CyberVulnerabilityStatus>(initial?.status ?? "OPEN");
  const [remediationDeadline, setRemediationDeadline] = useState(initial?.remediationDeadline?.slice(0, 10) ?? "");
  const [assignedToId, setAssignedToId] = useState(initial?.assignedTo?.id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const label = `block text-xs font-semibold mb-1 ${theme.subtext}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        cveId: cveId || undefined, title, description,
        cvssScore: cvssScore ? Number(cvssScore) : undefined, severity, affectedAssetName: affectedAssetName || undefined,
        status, remediationDeadline: remediationDeadline || undefined, assignedToId: assignedToId || undefined,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.vulnerabilities.cveId")}</label>
          <input className={theme.input} value={cveId} onChange={(e) => setCveId(e.target.value)} placeholder="CVE-2025-XXXXX" />
        </div>
        <div>
          <label className={label}>{t("cyber.vulnerabilities.cvssScore")}</label>
          <input className={theme.input} type="number" step="0.1" min="0" max="10" value={cvssScore} onChange={(e) => setCvssScore(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={label}>{t("cyber.vulnerabilities.title")}</label>
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
          <label className={label}>{t("cyber.vulnerabilities.affectedAssetName")}</label>
          <input className={theme.input} value={affectedAssetName} onChange={(e) => setAffectedAssetName(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("common.status")}</label>
          <select className={theme.select} value={status} onChange={(e) => setStatus(e.target.value as CyberVulnerabilityStatus)}>
            {vulnStatuses.map((s) => <option key={s} value={s}>{t(`cyber.status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{t("cyber.vulnerabilities.remediationDeadline")}</label>
          <DateField value={remediationDeadline} onChange={setRemediationDeadline} />
        </div>
      </div>
      <div>
        <label className={label}>{t("cyber.assignedTo")}</label>
        <select className={theme.select} value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
          <option value="">{t("cyber.unassigned")}</option>
          {assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div>
        <label className={label}>{t("common.notes")}</label>
        <textarea className={theme.input} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={cyberButtonSecondary(theme)} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={cyberButtonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function VulnerabilitiesTab({ theme, canEdit, canDelete }: { theme: CyberTheme; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [vulns, setVulns] = useState<CyberVulnerability[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | CyberVulnerability>(null);

  async function load() {
    setLoading(true);
    try {
      const [v, u] = await Promise.all([
        api.get<CyberVulnerability[]>("/cyber-vulnerabilities"),
        api.get<{ id: string; name: string }[]>("/cyber-identity/assignable-users"),
      ]);
      setVulns(v.data);
      setAssignableUsers(u.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/cyber-vulnerabilities", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/cyber-vulnerabilities/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("cyber.vulnerabilities.confirmDelete"))) return;
    await api.delete(`/cyber-vulnerabilities/${id}`);
    await load();
  }

  if (loading) return <div className={theme.subtext}>{t("common.loading")}</div>;

  const now = Date.now();

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <button className={cyberButtonPrimary} onClick={() => setModal("create")}>{t("cyber.vulnerabilities.new")}</button>
        </div>
      )}
      <CyberTable
        theme={theme}
        columns={
          [
            { key: "title", header: t("cyber.vulnerabilities.title"), render: (v) => (<div><div className={theme.text}>{v.title}</div>{v.cveId && <div className={`text-[10px] ${theme.mutedText}`}>{v.cveId}</div>}</div>), sortValue: (v) => v.title },
            { key: "severity", header: t("cyber.severityLabel"), render: (v) => <SeverityPill severity={v.severity} />, sortValue: (v) => v.severity },
            { key: "cvss", header: t("cyber.vulnerabilities.cvssScore"), render: (v) => v.cvssScore ?? "—", sortValue: (v) => v.cvssScore ?? 0 },
            { key: "asset", header: t("cyber.vulnerabilities.affectedAssetName"), render: (v) => v.affectedAssetName ?? "—" },
            { key: "status", header: t("common.status"), render: (v) => <StatusPill status={v.status} /> },
            {
              key: "deadline",
              header: t("cyber.vulnerabilities.remediationDeadline"),
              render: (v) => {
                const overdue = v.remediationDeadline && new Date(v.remediationDeadline).getTime() < now && (v.status === "OPEN" || v.status === "IN_PROGRESS");
                return v.remediationDeadline ? (
                  <span className={overdue ? "text-red-500 font-semibold" : theme.subtext}>{new Date(v.remediationDeadline).toLocaleDateString()}</span>
                ) : "—";
              },
              sortValue: (v) => v.remediationDeadline ?? "",
            },
            { key: "assignedTo", header: t("cyber.assignedTo"), render: (v) => v.assignedTo?.name ?? "—" },
          ] as CyberTableColumn<CyberVulnerability>[]
        }
        rows={vulns}
        rowKey={(v) => v.id}
        emptyMessage={t("cyber.vulnerabilities.noneYet")}
        searchValue={(v) => `${v.title} ${v.cveId ?? ""} ${v.affectedAssetName ?? ""}`}
        actions={(v) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="CyberVulnerability" entityId={v.id} />
            {canEdit && <button className={cyberButtonSecondary(theme)} onClick={() => setModal(v)}>{t("common.edit")}</button>}
            {canDelete && <button className={cyberButtonDanger} onClick={() => remove(v.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <CyberModal theme={theme} title={modal === "create" ? t("cyber.vulnerabilities.newTitle") : t("cyber.vulnerabilities.editTitle")} onClose={() => setModal(null)}>
          <VulnerabilityForm
            theme={theme}
            initial={modal === "create" ? undefined : modal}
            assignableUsers={assignableUsers}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </CyberModal>
      )}
    </div>
  );
}
