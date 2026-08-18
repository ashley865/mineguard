import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";
import DateField from "../../components/DateField";
import { CyberAuditFinding, CyberCompliancePolicy, CyberCompliancePolicyStatus, CyberFindingStatus, CyberSeverity } from "../../api/types";
import { CyberTheme, SEVERITY_ORDER, SeverityPill, StatusPill, cyberButtonDanger, cyberButtonPrimary, cyberButtonSecondary } from "./cyberTheme";
import CyberTable, { CyberTableColumn } from "./CyberTable";
import CyberModal from "./CyberModal";

const policyStatuses: CyberCompliancePolicyStatus[] = ["COMPLIANT", "NON_COMPLIANT", "IN_PROGRESS", "NOT_ASSESSED"];
const findingStatuses: CyberFindingStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED_RISK"];

function PolicyForm({ theme, initial, onSubmit, onCancel }: { theme: CyberTheme; initial?: CyberCompliancePolicy; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [framework, setFramework] = useState(initial?.framework ?? "");
  const [status, setStatus] = useState<CyberCompliancePolicyStatus>(initial?.status ?? "NOT_ASSESSED");
  const [ownerName, setOwnerName] = useState(initial?.ownerName ?? "");
  const [lastReviewedAt, setLastReviewedAt] = useState(initial?.lastReviewedAt?.slice(0, 10) ?? "");
  const [nextReviewDue, setNextReviewDue] = useState(initial?.nextReviewDue?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const label = `block text-xs font-semibold mb-1 ${theme.subtext}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        name, framework: framework || undefined, status, ownerName: ownerName || undefined,
        lastReviewedAt: lastReviewedAt || undefined, nextReviewDue: nextReviewDue || undefined, notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.compliance.policyName")}</label>
          <input className={theme.input} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={label}>{t("cyber.compliance.framework")}</label>
          <input className={theme.input} value={framework} onChange={(e) => setFramework(e.target.value)} placeholder="ISO 27001, NIST CSF, POPIA…" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("common.status")}</label>
          <select className={theme.select} value={status} onChange={(e) => setStatus(e.target.value as CyberCompliancePolicyStatus)}>
            {policyStatuses.map((s) => <option key={s} value={s}>{t(`cyber.status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{t("cyber.compliance.ownerName")}</label>
          <input className={theme.input} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.compliance.lastReviewedAt")}</label>
          <DateField value={lastReviewedAt} onChange={setLastReviewedAt} />
        </div>
        <div>
          <label className={label}>{t("cyber.compliance.nextReviewDue")}</label>
          <DateField value={nextReviewDue} onChange={setNextReviewDue} />
        </div>
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

function FindingForm({
  theme, initial, policies, onSubmit, onCancel,
}: {
  theme: CyberTheme;
  initial?: CyberAuditFinding;
  policies: CyberCompliancePolicy[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [severity, setSeverity] = useState<CyberSeverity>(initial?.severity ?? "MEDIUM");
  const [status, setStatus] = useState<CyberFindingStatus>(initial?.status ?? "OPEN");
  const [policyId, setPolicyId] = useState(initial?.policyId ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const label = `block text-xs font-semibold mb-1 ${theme.subtext}`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ title, description, severity, status, policyId: policyId || undefined, dueDate: dueDate || undefined, notes: notes || undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className={label}>{t("cyber.compliance.findingTitle")}</label>
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
          <select className={theme.select} value={status} onChange={(e) => setStatus(e.target.value as CyberFindingStatus)}>
            {findingStatuses.map((s) => <option key={s} value={s}>{t(`cyber.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("cyber.compliance.linkedPolicy")}</label>
          <select className={theme.select} value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
            <option value="">{t("cyber.compliance.noPolicy")}</option>
            {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{t("cyber.compliance.dueDate")}</label>
          <DateField value={dueDate} onChange={setDueDate} />
        </div>
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

export default function ComplianceTab({ theme, canEdit, canDelete }: { theme: CyberTheme; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [policies, setPolicies] = useState<CyberCompliancePolicy[]>([]);
  const [findings, setFindings] = useState<CyberAuditFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [policyModal, setPolicyModal] = useState<null | "create" | CyberCompliancePolicy>(null);
  const [findingModal, setFindingModal] = useState<null | "create" | CyberAuditFinding>(null);

  async function load() {
    setLoading(true);
    try {
      const [p, f] = await Promise.all([
        api.get<CyberCompliancePolicy[]>("/cyber-compliance/policies"),
        api.get<CyberAuditFinding[]>("/cyber-compliance/findings"),
      ]);
      setPolicies(p.data);
      setFindings(f.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createPolicy(data: any) { await api.post("/cyber-compliance/policies", data); setPolicyModal(null); await load(); }
  async function updatePolicy(id: string, data: any) { await api.put(`/cyber-compliance/policies/${id}`, data); setPolicyModal(null); await load(); }
  async function removePolicy(id: string) {
    if (!confirm(t("cyber.compliance.confirmDeletePolicy"))) return;
    await api.delete(`/cyber-compliance/policies/${id}`);
    await load();
  }

  async function createFinding(data: any) { await api.post("/cyber-compliance/findings", data); setFindingModal(null); await load(); }
  async function updateFinding(id: string, data: any) { await api.put(`/cyber-compliance/findings/${id}`, data); setFindingModal(null); await load(); }
  async function removeFinding(id: string) {
    if (!confirm(t("cyber.compliance.confirmDeleteFinding"))) return;
    await api.delete(`/cyber-compliance/findings/${id}`);
    await load();
  }

  if (loading) return <div className={theme.subtext}>{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.compliance.tabPolicies")}</h3>
          {canEdit && <button className={cyberButtonPrimary} onClick={() => setPolicyModal("create")}>{t("cyber.compliance.newPolicy")}</button>}
        </div>
        <CyberTable
          theme={theme}
          columns={
            [
              { key: "name", header: t("cyber.compliance.policyName"), render: (p) => <span className={theme.text}>{p.name}</span>, sortValue: (p) => p.name },
              { key: "framework", header: t("cyber.compliance.framework"), render: (p) => p.framework ?? "—" },
              { key: "status", header: t("common.status"), render: (p) => <StatusPill status={p.status} /> },
              { key: "owner", header: t("cyber.compliance.ownerName"), render: (p) => p.ownerName ?? "—" },
              { key: "nextReview", header: t("cyber.compliance.nextReviewDue"), render: (p) => (p.nextReviewDue ? new Date(p.nextReviewDue).toLocaleDateString() : "—"), sortValue: (p) => p.nextReviewDue ?? "" },
            ] as CyberTableColumn<CyberCompliancePolicy>[]
          }
          rows={policies}
          rowKey={(p) => p.id}
          emptyMessage={t("cyber.compliance.noPoliciesYet")}
          searchValue={(p) => `${p.name} ${p.framework ?? ""}`}
          actions={(p) => (
            <div className="flex justify-end gap-2">
              <AuditHistoryButton entityType="CyberCompliancePolicy" entityId={p.id} />
              {canEdit && <button className={cyberButtonSecondary(theme)} onClick={() => setPolicyModal(p)}>{t("common.edit")}</button>}
              {canDelete && <button className={cyberButtonDanger} onClick={() => removePolicy(p.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-semibold ${theme.text}`}>{t("cyber.compliance.tabFindings")}</h3>
          {canEdit && <button className={cyberButtonPrimary} onClick={() => setFindingModal("create")}>{t("cyber.compliance.newFinding")}</button>}
        </div>
        <CyberTable
          theme={theme}
          columns={
            [
              { key: "title", header: t("cyber.compliance.findingTitle"), render: (f) => <span className={theme.text}>{f.title}</span>, sortValue: (f) => f.title },
              { key: "severity", header: t("cyber.severityLabel"), render: (f) => <SeverityPill severity={f.severity} />, sortValue: (f) => f.severity },
              { key: "status", header: t("common.status"), render: (f) => <StatusPill status={f.status} /> },
              { key: "policy", header: t("cyber.compliance.linkedPolicy"), render: (f) => f.policy?.name ?? "—" },
              { key: "due", header: t("cyber.compliance.dueDate"), render: (f) => (f.dueDate ? new Date(f.dueDate).toLocaleDateString() : "—"), sortValue: (f) => f.dueDate ?? "" },
            ] as CyberTableColumn<CyberAuditFinding>[]
          }
          rows={findings}
          rowKey={(f) => f.id}
          emptyMessage={t("cyber.compliance.noFindingsYet")}
          searchValue={(f) => `${f.title} ${f.description}`}
          actions={(f) => (
            <div className="flex justify-end gap-2">
              <AuditHistoryButton entityType="CyberAuditFinding" entityId={f.id} />
              {canEdit && <button className={cyberButtonSecondary(theme)} onClick={() => setFindingModal(f)}>{t("common.edit")}</button>}
              {canDelete && <button className={cyberButtonDanger} onClick={() => removeFinding(f.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {policyModal && (
        <CyberModal theme={theme} title={policyModal === "create" ? t("cyber.compliance.newPolicyTitle") : t("cyber.compliance.editPolicyTitle")} onClose={() => setPolicyModal(null)}>
          <PolicyForm theme={theme} initial={policyModal === "create" ? undefined : policyModal} onSubmit={(data) => (policyModal === "create" ? createPolicy(data) : updatePolicy(policyModal.id, data))} onCancel={() => setPolicyModal(null)} />
        </CyberModal>
      )}
      {findingModal && (
        <CyberModal theme={theme} title={findingModal === "create" ? t("cyber.compliance.newFindingTitle") : t("cyber.compliance.editFindingTitle")} onClose={() => setFindingModal(null)}>
          <FindingForm theme={theme} initial={findingModal === "create" ? undefined : findingModal} policies={policies} onSubmit={(data) => (findingModal === "create" ? createFinding(data) : updateFinding(findingModal.id, data))} onCancel={() => setFindingModal(null)} />
        </CyberModal>
      )}
    </div>
  );
}
