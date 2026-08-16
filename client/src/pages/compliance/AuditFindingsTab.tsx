import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { AuditFinding, AuditFindingStatus, RiskLevel, Site } from "../../api/types";
import { StatusBadge, SeverityBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";
import LoadError from "../../components/LoadError";

const statuses: AuditFindingStatus[] = ["OPEN", "IN_PROGRESS", "AWAITING_VERIFICATION", "VERIFIED", "CLOSED", "OVERDUE"];
const severities: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

interface ResponsiblePerson {
  id: string;
  name: string;
}

function FindingForm({ sites, people, initial, onSubmit, onCancel }: {
  sites: Site[];
  people: ResponsiblePerson[];
  initial?: Partial<AuditFinding>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [findingNumber, setFindingNumber] = useState(initial?.findingNumber ?? "");
  const [requirementViolated, setRequirementViolated] = useState(initial?.requirementViolated ?? "");
  const [severity, setSeverity] = useState<RiskLevel>(initial?.severity ?? "MEDIUM");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [evidence, setEvidence] = useState(initial?.evidence ?? "");
  const [responsiblePersonId, setResponsiblePersonId] = useState(initial?.responsiblePersonId ?? "");
  const [correctiveAction, setCorrectiveAction] = useState(initial?.correctiveAction ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<AuditFindingStatus>(initial?.status ?? "OPEN");
  const [verificationNotes, setVerificationNotes] = useState(initial?.verificationNotes ?? "");
  const [closureDate, setClosureDate] = useState(initial?.closureDate?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        findingNumber,
        requirementViolated,
        severity,
        description,
        evidence: evidence || null,
        responsiblePersonId: responsiblePersonId || null,
        correctiveAction,
        dueDate,
        status,
        verificationNotes: verificationNotes || null,
        closureDate: closureDate || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.audit.findingNumber")}</label>
          <input className={inputClass} value={findingNumber} onChange={(e) => setFindingNumber(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("compliance.audit.requirementViolated")}</label>
        <textarea className={inputClass} rows={2} value={requirementViolated} onChange={(e) => setRequirementViolated(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("compliance.audit.description")}</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.audit.severity")}</label>
          <select className={selectClass} value={severity} onChange={(e) => setSeverity(e.target.value as RiskLevel)}>
            {severities.map((s) => <option key={s} value={s}>{t(`badges.severity.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("compliance.audit.responsiblePerson")}</label>
          <select className={selectClass} value={responsiblePersonId} onChange={(e) => setResponsiblePersonId(e.target.value)}>
            <option value="">{t("common.unassigned")}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("compliance.audit.correctiveAction")}</label>
        <textarea className={inputClass} rows={2} value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("compliance.audit.evidence")}</label>
        <textarea className={inputClass} rows={2} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder={t("compliance.audit.evidencePlaceholder") ?? ""} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.audit.dueDate")}</label>
          <DateField value={dueDate} onChange={setDueDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as AuditFindingStatus)}>
            {statuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("compliance.audit.verificationNotes")}</label>
        <textarea className={inputClass} rows={2} value={verificationNotes} onChange={(e) => setVerificationNotes(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("compliance.audit.closureDate")}</label>
        <DateField value={closureDate} onChange={setClosureDate} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function AuditFindingsTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<AuditFinding[]>([]);
  const [people, setPeople] = useState<ResponsiblePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | AuditFinding>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [findings, ppl] = await Promise.all([
        api.get<AuditFinding[]>("/audit-findings"),
        api.get<ResponsiblePerson[]>("/audit-findings/responsible-people"),
      ]);
      setItems(findings.data);
      setPeople(ppl.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/audit-findings", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/audit-findings/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("compliance.audit.confirmDelete"))) return;
    await api.delete(`/audit-findings/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("compliance.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const openCount = items.filter((i) => i.status === "OPEN").length;
  const overdueCount = items.filter((i) => i.status === "OVERDUE" || (i.status !== "CLOSED" && i.status !== "VERIFIED" && new Date(i.dueDate) < new Date())).length;
  const criticalCount = items.filter((i) => i.severity === "CRITICAL" && i.status !== "CLOSED").length;

  const columns: DataTableColumn<AuditFinding>[] = [
    { key: "findingNumber", header: t("compliance.audit.colFindingNumber"), render: (i) => <span className="font-medium">{i.findingNumber}</span>, sortValue: (i) => i.findingNumber },
    { key: "requirement", header: t("compliance.audit.colRequirement"), render: (i) => <div className="truncate max-w-xs" title={i.requirementViolated}>{i.requirementViolated}</div> },
    { key: "severity", header: t("compliance.audit.severity"), render: (i) => <SeverityBadge severity={i.severity} />, sortValue: (i) => i.severity },
    { key: "responsible", header: t("compliance.audit.colResponsible"), render: (i) => i.responsiblePerson?.name ?? t("common.unassigned"), sortValue: (i) => i.responsiblePerson?.name ?? "" },
    { key: "dueDate", header: t("compliance.audit.dueDate"), render: (i) => new Date(i.dueDate).toLocaleDateString(), sortValue: (i) => i.dueDate },
    { key: "status", header: t("common.status"), render: (i) => <StatusBadge status={i.status} />, sortValue: (i) => i.status },
  ];

  return (
    <div className="space-y-4">
      <p className="text-mine-300 text-sm">{t("compliance.audit.subtitle")}</p>

      <SummaryCards
        cards={[
          { label: t("compliance.audit.summaryOpen"), value: openCount },
          { label: t("compliance.audit.summaryOverdue"), value: overdueCount, tone: overdueCount > 0 ? "danger" : "default" },
          { label: t("compliance.audit.summaryCritical"), value: criticalCount, tone: criticalCount > 0 ? "danger" : "default" },
        ]}
      />

      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("compliance.audit.new")}</button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(i) => i.id}
        emptyMessage={t("compliance.audit.noneYet")}
        searchValue={(i) => `${i.findingNumber} ${i.requirementViolated} ${i.responsiblePerson?.name ?? ""}`}
        searchPlaceholder={t("compliance.audit.searchPlaceholder") ?? undefined}
        exportFilename="audit-findings"
        exportColumns={[
          { header: t("compliance.audit.colFindingNumber"), value: (i) => i.findingNumber },
          { header: t("compliance.audit.colRequirement"), value: (i) => i.requirementViolated },
          { header: t("compliance.audit.severity"), value: (i) => i.severity },
          { header: t("compliance.audit.colResponsible"), value: (i) => i.responsiblePerson?.name ?? "" },
          { header: t("compliance.audit.dueDate"), value: (i) => i.dueDate },
          { header: t("common.status"), value: (i) => i.status },
        ]}
        actions={(item) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="AuditFinding" entityId={item.id} />
            {canEdit && (
              <>
                <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(item)}>{t("common.edit")}</button>
                <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
              </>
            )}
          </div>
        )}
      />

      {modal && (
        <Modal title={modal === "create" ? t("compliance.audit.newTitle") : t("compliance.audit.editTitle")} onClose={() => setModal(null)} size="lg">
          <FindingForm
            sites={sites}
            people={people}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
