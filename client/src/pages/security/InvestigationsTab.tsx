import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  AlertSeverity,
  InvestigationEvidence,
  InvestigationOutcome,
  InvestigationStatement,
  InvestigationStatus,
  SecurityInvestigation,
  Site,
} from "../../api/types";
import { SeverityBadge, StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";
import LoadError from "../../components/LoadError";

const severities: AlertSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statuses: InvestigationStatus[] = ["OPEN", "IN_PROGRESS", "CLOSED"];
const outcomes: InvestigationOutcome[] = ["SUBSTANTIATED", "UNSUBSTANTIATED", "INCONCLUSIVE", "REFERRED_EXTERNAL"];

function InvestigationForm({ sites, onSubmit, onCancel }: {
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState<AlertSeverity>("MEDIUM");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ siteId, title, summary, severity });
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("investigations.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("investigations.severity")}</label>
          <select className={selectClass} value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity)}>
            {severities.map((s) => <option key={s} value={s}>{t(`badges.severity.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("investigations.title")}</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </div>
      <div>
        <label className={labelClass}>{t("investigations.summary")}</label>
        <textarea className={inputClass} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} required />
      </div>
      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function EditForm({ investigation, onSubmit, onCancel }: {
  investigation: SecurityInvestigation;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<InvestigationStatus>(investigation.status);
  const [outcome, setOutcome] = useState<InvestigationOutcome | "">(investigation.outcome ?? "");
  const [findings, setFindings] = useState(investigation.findings ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ status, outcome: outcome || null, findings: findings || null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as InvestigationStatus)}>
            {statuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("investigations.outcome")}</label>
          <select className={selectClass} value={outcome} onChange={(e) => setOutcome(e.target.value as InvestigationOutcome | "")}>
            <option value="">{t("common.none")}</option>
            {outcomes.map((o) => <option key={o} value={o}>{t(`investigations.outcomes.${o}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("investigations.findings")}</label>
        <textarea className={inputClass} rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function DetailModal({ investigation, onClose, canEdit }: {
  investigation: SecurityInvestigation;
  onClose: () => void;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const [evidence, setEvidence] = useState<InvestigationEvidence[]>([]);
  const [statements, setStatements] = useState<InvestigationStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [evidenceDesc, setEvidenceDesc] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [witnessName, setWitnessName] = useState("");
  const [witnessRole, setWitnessRole] = useState("");
  const [statementText, setStatementText] = useState("");
  const [savingStatement, setSavingStatement] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [e, s] = await Promise.all([
        api.get<InvestigationEvidence[]>(`/security-investigations/${investigation.id}/evidence`),
        api.get<InvestigationStatement[]>(`/security-investigations/${investigation.id}/statements`),
      ]);
      setEvidence(e.data);
      setStatements(s.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function uploadEvidence(e: FormEvent) {
    e.preventDefault();
    if (!evidenceDesc.trim()) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("description", evidenceDesc);
      if (evidenceFile) form.append("file", evidenceFile);
      await api.post(`/security-investigations/${investigation.id}/evidence`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEvidenceDesc("");
      setEvidenceFile(null);
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function removeEvidence(id: string) {
    if (!confirm(t("investigations.confirmDeleteEvidence"))) return;
    await api.delete(`/security-investigations/evidence/${id}`);
    await load();
  }

  async function addStatement(e: FormEvent) {
    e.preventDefault();
    if (!witnessName.trim() || !statementText.trim()) return;
    setSavingStatement(true);
    try {
      await api.post(`/security-investigations/${investigation.id}/statements`, {
        witnessName, role: witnessRole || null, statement: statementText,
      });
      setWitnessName("");
      setWitnessRole("");
      setStatementText("");
      await load();
    } finally {
      setSavingStatement(false);
    }
  }

  async function removeStatement(id: string) {
    if (!confirm(t("investigations.confirmDeleteStatement"))) return;
    await api.delete(`/security-investigations/statements/${id}`);
    await load();
  }

  return (
    <Modal title={investigation.title} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2 items-center">
          <StatusBadge status={investigation.status} />
          {investigation.severity && <SeverityBadge severity={investigation.severity} />}
          {investigation.outcome && <span className="text-xs text-mine-300">{t(`investigations.outcomes.${investigation.outcome}`)}</span>}
        </div>
        <p className="text-sm text-mine-200">{investigation.summary}</p>
        {investigation.findings && (
          <div className="text-sm">
            <div className="text-xs font-semibold text-mine-400 uppercase mb-1">{t("investigations.findings")}</div>
            <p className="text-mine-200">{investigation.findings}</p>
          </div>
        )}

        {loading ? (
          <div className="text-mine-300 text-sm">{t("common.loading")}</div>
        ) : loadError ? (
          <LoadError onRetry={load} />
        ) : (
          <>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-mine-400 uppercase">{t("investigations.evidenceTitle")}</div>
              <div className="space-y-2">
                {evidence.map((ev) => (
                  <div key={ev.id} className={`${cardClass} p-3 flex items-start justify-between gap-3`}>
                    <div>
                      <p className="text-sm text-mine-100">{ev.description}</p>
                      <p className="text-[10px] text-mine-400">{ev.addedBy?.name ?? "—"} · {new Date(ev.collectedAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ev.fileName && (
                        <a className="text-xs text-mine-300 hover:text-mine-50 underline" href={`${API_URL}/api/security-investigations/evidence/${ev.id}/file`} target="_blank" rel="noreferrer">
                          {t("investigations.viewFile")}
                        </a>
                      )}
                      {canEdit && <button className={buttonDanger} onClick={() => removeEvidence(ev.id)}>{t("common.delete")}</button>}
                    </div>
                  </div>
                ))}
                {evidence.length === 0 && <p className="text-xs text-mine-400">{t("investigations.noEvidence")}</p>}
              </div>
              {canEdit && (
                <form onSubmit={uploadEvidence} className="flex flex-wrap gap-2 items-center pt-1">
                  <input className={`${inputClass} flex-1 min-w-[160px]`} placeholder={t("investigations.evidenceDescPlaceholder") ?? ""} value={evidenceDesc} onChange={(e) => setEvidenceDesc(e.target.value)} />
                  <input type="file" className="text-xs text-mine-300" onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)} />
                  <button type="submit" className={buttonSecondary} disabled={uploading}>{uploading ? t("common.saving") : t("investigations.addEvidence")}</button>
                </form>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-mine-400 uppercase">{t("investigations.statementsTitle")}</div>
              <div className="space-y-2">
                {statements.map((st) => (
                  <div key={st.id} className={`${cardClass} p-3`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-mine-100">{st.witnessName}{st.role ? ` · ${st.role}` : ""}</p>
                        <p className="text-sm text-mine-200 mt-1">{st.statement}</p>
                        <p className="text-[10px] text-mine-400 mt-1">{new Date(st.statementDate).toLocaleString()}</p>
                      </div>
                      {canEdit && <button className={buttonDanger} onClick={() => removeStatement(st.id)}>{t("common.delete")}</button>}
                    </div>
                  </div>
                ))}
                {statements.length === 0 && <p className="text-xs text-mine-400">{t("investigations.noStatements")}</p>}
              </div>
              {canEdit && (
                <form onSubmit={addStatement} className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputClass} placeholder={t("investigations.witnessName") ?? ""} value={witnessName} onChange={(e) => setWitnessName(e.target.value)} />
                    <input className={inputClass} placeholder={t("investigations.witnessRole") ?? ""} value={witnessRole} onChange={(e) => setWitnessRole(e.target.value)} />
                  </div>
                  <textarea className={inputClass} rows={2} placeholder={t("investigations.statementPlaceholder") ?? ""} value={statementText} onChange={(e) => setStatementText(e.target.value)} />
                  <div className="flex justify-end">
                    <button type="submit" className={buttonSecondary} disabled={savingStatement}>{savingStatement ? t("common.saving") : t("investigations.addStatement")}</button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function InvestigationsTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<SecurityInvestigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<SecurityInvestigation | null>(null);
  const [detailModal, setDetailModal] = useState<SecurityInvestigation | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<SecurityInvestigation[]>("/security-investigations");
      setItems(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/security-investigations", data);
    setCreateModal(false);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/security-investigations/${id}`, data);
    setEditModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("investigations.confirmDelete"))) return;
    await api.delete(`/security-investigations/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const openCount = items.filter((i) => i.status === "OPEN").length;
  const inProgressCount = items.filter((i) => i.status === "IN_PROGRESS").length;
  const closedCount = items.filter((i) => i.status === "CLOSED").length;

  const columns: DataTableColumn<SecurityInvestigation>[] = [
    { key: "title", header: t("investigations.title"), render: (i) => <button className="font-medium text-left hover:underline" onClick={() => setDetailModal(i)}>{i.title}</button>, sortValue: (i) => i.title },
    { key: "site", header: t("common.site"), render: (i) => i.site?.name ?? "—", sortValue: (i) => i.site?.name ?? "" },
    { key: "severity", header: t("investigations.severity"), render: (i) => i.severity ? <SeverityBadge severity={i.severity} /> : "—" },
    { key: "lead", header: t("investigations.leadInvestigator"), render: (i) => i.leadInvestigator?.name ?? "—" },
    { key: "evidence", header: t("investigations.evidenceTitle"), render: (i) => `${i._count?.evidenceItems ?? 0} / ${i._count?.statements ?? 0}` },
    { key: "opened", header: t("investigations.colOpened"), render: (i) => new Date(i.openedAt).toLocaleDateString(), sortValue: (i) => i.openedAt },
    { key: "status", header: t("common.status"), render: (i) => <StatusBadge status={i.status} />, sortValue: (i) => i.status },
  ];

  return (
    <div className="space-y-4">
      <p className="text-mine-300 text-sm">{t("investigations.subtitle")}</p>

      <SummaryCards
        cards={[
          { label: t("investigations.summaryOpen"), value: openCount },
          { label: t("investigations.summaryInProgress"), value: inProgressCount, tone: inProgressCount > 0 ? "hazard" : "default" },
          { label: t("investigations.summaryClosed"), value: closedCount },
        ]}
      />

      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setCreateModal(true)}>{t("investigations.new")}</button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(i) => i.id}
        emptyMessage={t("investigations.noneYet")}
        searchValue={(i) => `${i.title} ${i.summary}`}
        actions={(i) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="SecurityInvestigation" entityId={i.id} />
            {canEdit && (
              <>
                <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setEditModal(i)}>{t("common.edit")}</button>
                <button className={buttonDanger} onClick={() => remove(i.id)}>{t("common.delete")}</button>
              </>
            )}
          </div>
        )}
      />

      {createModal && (
        <Modal title={t("investigations.newTitle")} onClose={() => setCreateModal(false)} size="lg">
          <InvestigationForm sites={sites} onSubmit={create} onCancel={() => setCreateModal(false)} />
        </Modal>
      )}

      {editModal && (
        <Modal title={t("investigations.editTitle")} onClose={() => setEditModal(null)}>
          <EditForm investigation={editModal} onSubmit={(data) => update(editModal.id, data)} onCancel={() => setEditModal(null)} />
        </Modal>
      )}

      {detailModal && <DetailModal investigation={detailModal} onClose={() => setDetailModal(null)} canEdit={canEdit} />}
    </div>
  );
}
