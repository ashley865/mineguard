import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  CcmaCase,
  CcmaCaseStatus,
  CcmaCaseType,
  DisciplinaryCase,
  DisciplinaryOutcome,
  DisciplinaryStatus,
  GrievanceCase,
  GrievanceStatus,
  UnionAgreement,
  UnionAgreementStatus,
  Worker,
} from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import FileDropzone from "../components/FileDropzone";
import DataTable, { DataTableColumn } from "../components/DataTable";
import SummaryCards from "../components/SummaryCards";
import { AuditHistoryButton } from "../components/AuditHistoryPanel";
import CaseRiskModal from "../components/CaseRiskModal";
import LoadError from "../components/LoadError";

const disciplinaryOutcomes: DisciplinaryOutcome[] = ["PENDING", "VERBAL_WARNING", "WRITTEN_WARNING", "FINAL_WRITTEN_WARNING", "DISMISSAL", "NOT_GUILTY", "WITHDRAWN"];
const disciplinaryStatuses: DisciplinaryStatus[] = ["OPEN", "SCHEDULED", "CONCLUDED", "APPEALED"];
const grievanceStatuses: GrievanceStatus[] = ["OPEN", "UNDER_INVESTIGATION", "RESOLVED", "ESCALATED", "WITHDRAWN"];
const ccmaTypes: CcmaCaseType[] = ["UNFAIR_DISMISSAL", "UNFAIR_LABOUR_PRACTICE", "DISCRIMINATION", "WAGE_DISPUTE", "OTHER"];
const ccmaStatuses: CcmaCaseStatus[] = ["REFERRED", "CONCILIATION", "ARBITRATION", "SETTLED", "AWARD_ISSUED", "WITHDRAWN"];
const unionStatuses: UnionAgreementStatus[] = ["ACTIVE", "EXPIRED", "UNDER_NEGOTIATION"];

async function downloadAttachment(url: string, fileName: string) {
  const res = await api.get(url, { responseType: "blob" });
  const blobUrl = window.URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}

function AttachmentField({ fileName, onFile, t }: { fileName?: string | null; onFile: (f: File | null) => void; t: (k: string) => string }) {
  return (
    <div>
      <label className={labelClass}>{t("labourRelations.attachment")}</label>
      {fileName && <p className="text-xs text-mine-400 mb-1">{t("labourRelations.currentFile")}: {fileName}</p>}
      <FileDropzone accept="image/*,.pdf,.doc,.docx" onFiles={(files) => onFile(files.item(0))} />
    </div>
  );
}

function DisciplinaryForm({ workers, initial, onSubmit, onCancel }: {
  workers: Worker[];
  initial?: Partial<DisciplinaryCase>;
  onSubmit: (form: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(initial?.workerId ?? workers[0]?.id ?? "");
  const [chargeDescription, setChargeDescription] = useState(initial?.chargeDescription ?? "");
  const [hearingDate, setHearingDate] = useState(initial?.hearingDate?.slice(0, 10) ?? "");
  const [chairperson, setChairperson] = useState(initial?.chairperson ?? "");
  const [outcome, setOutcome] = useState<DisciplinaryOutcome>(initial?.outcome ?? "PENDING");
  const [status, setStatus] = useState<DisciplinaryStatus>(initial?.status ?? "OPEN");
  const [sanctionDetails, setSanctionDetails] = useState(initial?.sanctionDetails ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.append("workerId", workerId);
      form.append("chargeDescription", chargeDescription);
      if (hearingDate) form.append("hearingDate", hearingDate);
      if (chairperson) form.append("chairperson", chairperson);
      form.append("outcome", outcome);
      form.append("status", status);
      if (sanctionDetails) form.append("sanctionDetails", sanctionDetails);
      if (notes) form.append("notes", notes);
      if (file) form.append("attachment", file);
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("workers.title")}</label>
        <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)} required>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({t(`workers.categories.${w.category}`)})</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("labourRelations.chargeDescription")}</label>
        <textarea className={inputClass} rows={2} value={chargeDescription} onChange={(e) => setChargeDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("labourRelations.hearingDate")}</label>
          <DateField value={hearingDate} onChange={setHearingDate} />
        </div>
        <div>
          <label className={labelClass}>{t("labourRelations.chairperson")}</label>
          <input className={inputClass} value={chairperson} onChange={(e) => setChairperson(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("labourRelations.outcome")}</label>
          <select className={selectClass} value={outcome} onChange={(e) => setOutcome(e.target.value as DisciplinaryOutcome)}>
            {disciplinaryOutcomes.map((o) => <option key={o} value={o}>{t(`labourRelations.disciplinaryOutcomes.${o}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as DisciplinaryStatus)}>
            {disciplinaryStatuses.map((s) => <option key={s} value={s}>{t(`labourRelations.disciplinaryStatuses.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("labourRelations.sanctionDetails")}</label>
        <textarea className={inputClass} rows={2} value={sanctionDetails} onChange={(e) => setSanctionDetails(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <AttachmentField fileName={initial?.fileName} onFile={setFile} t={t} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function DisciplinaryTab({ workers, canEdit, canDelete }: { workers: Worker[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canUseAi = user?.role === "ADMIN" || user?.title === "HR_MANAGER";
  const [cases, setCases] = useState<DisciplinaryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | DisciplinaryCase>(null);
  const [riskCase, setRiskCase] = useState<{ id: string; label: string } | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<DisciplinaryCase[]>("/labour-relations/disciplinary");
      setCases(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(form: FormData) {
    await api.post("/labour-relations/disciplinary", form, { headers: { "Content-Type": "multipart/form-data" } });
    setModal(null);
    await load();
  }

  async function update(id: string, form: FormData) {
    await api.put(`/labour-relations/disciplinary/${id}`, form, { headers: { "Content-Type": "multipart/form-data" } });
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/labour-relations/disciplinary/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const openCount = cases.filter((c) => c.status === "OPEN" || c.status === "SCHEDULED").length;
  const dismissalCount = cases.filter((c) => c.outcome === "DISMISSAL").length;

  const columns: DataTableColumn<DisciplinaryCase>[] = [
    { key: "worker", header: t("workers.title"), render: (c) => <span className="font-medium">{c.worker?.name}</span>, sortValue: (c) => c.worker?.name ?? "" },
    { key: "charge", header: t("labourRelations.chargeDescription"), render: (c) => <div className="truncate max-w-xs" title={c.chargeDescription}>{c.chargeDescription}</div> },
    { key: "outcome", header: t("labourRelations.outcome"), render: (c) => t(`labourRelations.disciplinaryOutcomes.${c.outcome}`), sortValue: (c) => c.outcome },
    { key: "status", header: t("common.status"), render: (c) => <StatusBadge status={c.status} />, sortValue: (c) => c.status },
  ];

  return (
    <div className="space-y-4">
      <SummaryCards
        cards={[
          { label: t("labourRelations.summaryOpenCases"), value: openCount },
          { label: t("labourRelations.summaryDismissals"), value: dismissalCount, tone: dismissalCount > 0 ? "hazard" : "default" },
        ]}
      />
      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("labourRelations.newDisciplinaryCase")}</button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={cases}
        rowKey={(c) => c.id}
        emptyMessage={t("labourRelations.noDisciplinaryCases")}
        searchValue={(c) => `${c.worker?.name ?? ""} ${c.chargeDescription}`}
        exportFilename="disciplinary-cases"
        exportColumns={[
          { header: t("workers.title"), value: (c) => c.worker?.name ?? "" },
          { header: t("labourRelations.chargeDescription"), value: (c) => c.chargeDescription },
          { header: t("labourRelations.outcome"), value: (c) => c.outcome },
          { header: t("common.status"), value: (c) => c.status },
        ]}
        actions={(c) => (
          <div className="flex justify-end gap-2">
            {c.fileName && (
              <button className="text-xs text-hazard-400 hover:text-hazard-300" onClick={() => downloadAttachment(`/labour-relations/disciplinary/${c.id}/attachment`, c.fileName!)}>📎</button>
            )}
            {canUseAi && (
              <button
                className="text-xs font-bold text-hazard-600 hover:text-hazard-500"
                onClick={() => setRiskCase({ id: c.id, label: c.worker?.name ?? c.chargeDescription })}
              >
                {t("ai.caseRisk.assess")}
              </button>
            )}
            <AuditHistoryButton entityType="DisciplinaryCase" entityId={c.id} />
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(c)}>{t("common.edit")}</button>}
            {canDelete && <button className={buttonDanger} onClick={() => remove(c.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={modal === "create" ? t("labourRelations.newDisciplinaryCaseTitle") : t("labourRelations.editDisciplinaryCaseTitle")} onClose={() => setModal(null)}>
          <DisciplinaryForm
            workers={workers}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(form) => (modal === "create" ? create(form) : update(modal.id, form))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {riskCase && (
        <CaseRiskModal caseType="DISCIPLINARY" caseId={riskCase.id} caseLabel={riskCase.label} onClose={() => setRiskCase(null)} />
      )}
    </div>
  );
}

function GrievanceForm({ workers, initial, onSubmit, onCancel }: {
  workers: Worker[];
  initial?: Partial<GrievanceCase>;
  onSubmit: (form: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(initial?.workerId ?? workers[0]?.id ?? "");
  const [raisedAgainst, setRaisedAgainst] = useState(initial?.raisedAgainst ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [dateRaised, setDateRaised] = useState(initial?.dateRaised?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<GrievanceStatus>(initial?.status ?? "OPEN");
  const [resolution, setResolution] = useState(initial?.resolution ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.append("workerId", workerId);
      if (raisedAgainst) form.append("raisedAgainst", raisedAgainst);
      form.append("description", description);
      form.append("dateRaised", dateRaised);
      form.append("status", status);
      if (resolution) form.append("resolution", resolution);
      if (file) form.append("attachment", file);
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("labourRelations.raisedBy")}</label>
        <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)} required>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({t(`workers.categories.${w.category}`)})</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("labourRelations.raisedAgainst")}</label>
        <input className={inputClass} value={raisedAgainst} onChange={(e) => setRaisedAgainst(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("labourRelations.dateRaised")}</label>
          <DateField value={dateRaised} onChange={setDateRaised} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as GrievanceStatus)}>
            {grievanceStatuses.map((s) => <option key={s} value={s}>{t(`labourRelations.grievanceStatuses.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("labourRelations.resolution")}</label>
        <textarea className={inputClass} rows={2} value={resolution} onChange={(e) => setResolution(e.target.value)} />
      </div>
      <AttachmentField fileName={initial?.fileName} onFile={setFile} t={t} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function GrievancesTab({ workers, canEdit, canDelete }: { workers: Worker[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canUseAi = user?.role === "ADMIN" || user?.title === "HR_MANAGER";
  const [cases, setCases] = useState<GrievanceCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | GrievanceCase>(null);
  const [riskCase, setRiskCase] = useState<{ id: string; label: string } | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<GrievanceCase[]>("/labour-relations/grievances");
      setCases(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(form: FormData) {
    await api.post("/labour-relations/grievances", form, { headers: { "Content-Type": "multipart/form-data" } });
    setModal(null);
    await load();
  }

  async function update(id: string, form: FormData) {
    await api.put(`/labour-relations/grievances/${id}`, form, { headers: { "Content-Type": "multipart/form-data" } });
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/labour-relations/grievances/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const openCount = cases.filter((c) => c.status === "OPEN" || c.status === "UNDER_INVESTIGATION").length;

  const columns: DataTableColumn<GrievanceCase>[] = [
    { key: "worker", header: t("labourRelations.raisedBy"), render: (c) => <span className="font-medium">{c.worker?.name}</span>, sortValue: (c) => c.worker?.name ?? "" },
    { key: "description", header: t("common.description"), render: (c) => <div className="truncate max-w-xs" title={c.description}>{c.description}</div> },
    { key: "dateRaised", header: t("labourRelations.dateRaised"), render: (c) => new Date(c.dateRaised).toLocaleDateString(), sortValue: (c) => c.dateRaised },
    { key: "status", header: t("common.status"), render: (c) => <StatusBadge status={c.status} />, sortValue: (c) => c.status },
  ];

  return (
    <div className="space-y-4">
      <SummaryCards cards={[{ label: t("labourRelations.summaryOpenGrievances"), value: openCount }]} />
      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("labourRelations.newGrievance")}</button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={cases}
        rowKey={(c) => c.id}
        emptyMessage={t("labourRelations.noGrievances")}
        searchValue={(c) => `${c.worker?.name ?? ""} ${c.description}`}
        exportFilename="grievances"
        exportColumns={[
          { header: t("labourRelations.raisedBy"), value: (c) => c.worker?.name ?? "" },
          { header: t("common.description"), value: (c) => c.description },
          { header: t("labourRelations.dateRaised"), value: (c) => c.dateRaised },
          { header: t("common.status"), value: (c) => c.status },
        ]}
        actions={(c) => (
          <div className="flex justify-end gap-2">
            {c.fileName && (
              <button className="text-xs text-hazard-400 hover:text-hazard-300" onClick={() => downloadAttachment(`/labour-relations/grievances/${c.id}/attachment`, c.fileName!)}>📎</button>
            )}
            {canUseAi && (
              <button
                className="text-xs font-bold text-hazard-600 hover:text-hazard-500"
                onClick={() => setRiskCase({ id: c.id, label: c.worker?.name ?? c.description })}
              >
                {t("ai.caseRisk.assess")}
              </button>
            )}
            <AuditHistoryButton entityType="GrievanceCase" entityId={c.id} />
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(c)}>{t("common.edit")}</button>}
            {canDelete && <button className={buttonDanger} onClick={() => remove(c.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={modal === "create" ? t("labourRelations.newGrievanceTitle") : t("labourRelations.editGrievanceTitle")} onClose={() => setModal(null)}>
          <GrievanceForm
            workers={workers}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(form) => (modal === "create" ? create(form) : update(modal.id, form))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {riskCase && (
        <CaseRiskModal caseType="GRIEVANCE" caseId={riskCase.id} caseLabel={riskCase.label} onClose={() => setRiskCase(null)} />
      )}
    </div>
  );
}

function CcmaForm({ workers, initial, onSubmit, onCancel }: {
  workers: Worker[];
  initial?: Partial<CcmaCase>;
  onSubmit: (form: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(initial?.workerId ?? "");
  const [referralNumber, setReferralNumber] = useState(initial?.referralNumber ?? "");
  const [caseType, setCaseType] = useState<CcmaCaseType>(initial?.caseType ?? "UNFAIR_DISMISSAL");
  const [conciliationDate, setConciliationDate] = useState(initial?.conciliationDate?.slice(0, 10) ?? "");
  const [arbitrationDate, setArbitrationDate] = useState(initial?.arbitrationDate?.slice(0, 10) ?? "");
  const [outcome, setOutcome] = useState(initial?.outcome ?? "");
  const [status, setStatus] = useState<CcmaCaseStatus>(initial?.status ?? "REFERRED");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      if (workerId) form.append("workerId", workerId);
      if (referralNumber) form.append("referralNumber", referralNumber);
      form.append("caseType", caseType);
      if (conciliationDate) form.append("conciliationDate", conciliationDate);
      if (arbitrationDate) form.append("arbitrationDate", arbitrationDate);
      if (outcome) form.append("outcome", outcome);
      form.append("status", status);
      if (file) form.append("attachment", file);
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("workers.title")}</label>
        <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
          <option value="">—</option>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("labourRelations.referralNumber")}</label>
          <input className={inputClass} value={referralNumber} onChange={(e) => setReferralNumber(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("labourRelations.caseType")}</label>
          <select className={selectClass} value={caseType} onChange={(e) => setCaseType(e.target.value as CcmaCaseType)}>
            {ccmaTypes.map((ct) => <option key={ct} value={ct}>{t(`labourRelations.ccmaCaseTypes.${ct}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("labourRelations.conciliationDate")}</label>
          <DateField value={conciliationDate} onChange={setConciliationDate} />
        </div>
        <div>
          <label className={labelClass}>{t("labourRelations.arbitrationDate")}</label>
          <DateField value={arbitrationDate} onChange={setArbitrationDate} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("labourRelations.ccmaOutcome")}</label>
          <input className={inputClass} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as CcmaCaseStatus)}>
            {ccmaStatuses.map((s) => <option key={s} value={s}>{t(`labourRelations.ccmaCaseStatuses.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <AttachmentField fileName={initial?.fileName} onFile={setFile} t={t} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function CcmaTab({ workers, canEdit, canDelete }: { workers: Worker[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canUseAi = user?.role === "ADMIN" || user?.title === "HR_MANAGER";
  const [cases, setCases] = useState<CcmaCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | CcmaCase>(null);
  const [riskCase, setRiskCase] = useState<{ id: string; label: string } | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<CcmaCase[]>("/labour-relations/ccma-cases");
      setCases(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(form: FormData) {
    await api.post("/labour-relations/ccma-cases", form, { headers: { "Content-Type": "multipart/form-data" } });
    setModal(null);
    await load();
  }

  async function update(id: string, form: FormData) {
    await api.put(`/labour-relations/ccma-cases/${id}`, form, { headers: { "Content-Type": "multipart/form-data" } });
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/labour-relations/ccma-cases/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const ccmaColumns: DataTableColumn<CcmaCase>[] = [
    { key: "referral", header: t("labourRelations.referralNumber"), render: (c) => c.referralNumber ?? "—", sortValue: (c) => c.referralNumber ?? "" },
    { key: "worker", header: t("workers.title"), render: (c) => c.worker?.name ?? "—", sortValue: (c) => c.worker?.name ?? "" },
    { key: "type", header: t("labourRelations.caseType"), render: (c) => t(`labourRelations.ccmaCaseTypes.${c.caseType}`), sortValue: (c) => c.caseType },
    { key: "status", header: t("common.status"), render: (c) => <StatusBadge status={c.status} />, sortValue: (c) => c.status },
  ];

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("labourRelations.newCcmaCase")}</button>
        </div>
      )}
      <DataTable
        columns={ccmaColumns}
        rows={cases}
        rowKey={(c) => c.id}
        emptyMessage={t("labourRelations.noCcmaCases")}
        searchValue={(c) => `${c.referralNumber ?? ""} ${c.worker?.name ?? ""}`}
        exportFilename="ccma-cases"
        exportColumns={[
          { header: t("labourRelations.referralNumber"), value: (c) => c.referralNumber ?? "" },
          { header: t("workers.title"), value: (c) => c.worker?.name ?? "" },
          { header: t("labourRelations.caseType"), value: (c) => c.caseType },
          { header: t("common.status"), value: (c) => c.status },
        ]}
        actions={(c) => (
          <div className="flex justify-end gap-2">
            {c.fileName && (
              <button className="text-xs text-hazard-400 hover:text-hazard-300" onClick={() => downloadAttachment(`/labour-relations/ccma-cases/${c.id}/attachment`, c.fileName!)}>📎</button>
            )}
            {canUseAi && (
              <button
                className="text-xs font-bold text-hazard-600 hover:text-hazard-500"
                onClick={() => setRiskCase({ id: c.id, label: c.worker?.name ?? c.referralNumber ?? c.id })}
              >
                {t("ai.caseRisk.assess")}
              </button>
            )}
            <AuditHistoryButton entityType="CcmaCase" entityId={c.id} />
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(c)}>{t("common.edit")}</button>}
            {canDelete && <button className={buttonDanger} onClick={() => remove(c.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={modal === "create" ? t("labourRelations.newCcmaCaseTitle") : t("labourRelations.editCcmaCaseTitle")} onClose={() => setModal(null)}>
          <CcmaForm
            workers={workers}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(form) => (modal === "create" ? create(form) : update(modal.id, form))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {riskCase && <CaseRiskModal caseType="CCMA" caseId={riskCase.id} caseLabel={riskCase.label} onClose={() => setRiskCase(null)} />}
    </div>
  );
}

function UnionAgreementForm({ initial, onSubmit, onCancel }: {
  initial?: Partial<UnionAgreement>;
  onSubmit: (form: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [unionName, setUnionName] = useState(initial?.unionName ?? "");
  const [membershipCount, setMembershipCount] = useState(initial?.membershipCount?.toString() ?? "");
  const [effectiveDate, setEffectiveDate] = useState(initial?.effectiveDate?.slice(0, 10) ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<UnionAgreementStatus>(initial?.status ?? "ACTIVE");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData();
      form.append("unionName", unionName);
      if (membershipCount) form.append("membershipCount", membershipCount);
      form.append("effectiveDate", effectiveDate);
      if (expiryDate) form.append("expiryDate", expiryDate);
      form.append("status", status);
      if (file) form.append("attachment", file);
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("labourRelations.unionName")}</label>
        <input className={inputClass} value={unionName} onChange={(e) => setUnionName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("labourRelations.membershipCount")}</label>
          <input className={inputClass} type="number" value={membershipCount} onChange={(e) => setMembershipCount(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as UnionAgreementStatus)}>
            {unionStatuses.map((s) => <option key={s} value={s}>{t(`labourRelations.unionAgreementStatuses.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.startDate")}</label>
          <DateField value={effectiveDate} onChange={setEffectiveDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.endDate")}</label>
          <DateField value={expiryDate} onChange={setExpiryDate} />
        </div>
      </div>
      <AttachmentField fileName={initial?.fileName} onFile={setFile} t={t} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function UnionAgreementsTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [agreements, setAgreements] = useState<UnionAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | UnionAgreement>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<UnionAgreement[]>("/labour-relations/union-agreements");
      setAgreements(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(form: FormData) {
    await api.post("/labour-relations/union-agreements", form, { headers: { "Content-Type": "multipart/form-data" } });
    setModal(null);
    await load();
  }

  async function update(id: string, form: FormData) {
    await api.put(`/labour-relations/union-agreements/${id}`, form, { headers: { "Content-Type": "multipart/form-data" } });
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/labour-relations/union-agreements/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const unionColumns: DataTableColumn<UnionAgreement>[] = [
    { key: "name", header: t("labourRelations.unionName"), render: (a) => <span className="font-medium">{a.unionName}</span>, sortValue: (a) => a.unionName },
    { key: "membership", header: t("labourRelations.membershipCount"), render: (a) => a.membershipCount ?? "—", sortValue: (a) => a.membershipCount ?? 0 },
    { key: "effective", header: t("common.startDate"), render: (a) => new Date(a.effectiveDate).toLocaleDateString(), sortValue: (a) => a.effectiveDate },
    { key: "status", header: t("common.status"), render: (a) => <StatusBadge status={a.status} />, sortValue: (a) => a.status },
  ];

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("labourRelations.newUnionAgreement")}</button>
        </div>
      )}
      <DataTable
        columns={unionColumns}
        rows={agreements}
        rowKey={(a) => a.id}
        emptyMessage={t("labourRelations.noUnionAgreements")}
        searchValue={(a) => a.unionName}
        exportFilename="union-agreements"
        exportColumns={[
          { header: t("labourRelations.unionName"), value: (a) => a.unionName },
          { header: t("labourRelations.membershipCount"), value: (a) => a.membershipCount ?? "" },
          { header: t("common.startDate"), value: (a) => a.effectiveDate },
          { header: t("common.status"), value: (a) => a.status },
        ]}
        actions={(a) => (
          <div className="flex justify-end gap-2">
            {a.fileName && (
              <button className="text-xs text-hazard-400 hover:text-hazard-300" onClick={() => downloadAttachment(`/labour-relations/union-agreements/${a.id}/attachment`, a.fileName!)}>📎</button>
            )}
            <AuditHistoryButton entityType="UnionAgreement" entityId={a.id} />
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(a)}>{t("common.edit")}</button>}
            {canDelete && <button className={buttonDanger} onClick={() => remove(a.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={modal === "create" ? t("labourRelations.newUnionAgreementTitle") : t("labourRelations.editUnionAgreementTitle")} onClose={() => setModal(null)}>
          <UnionAgreementForm
            initial={modal === "create" ? undefined : modal}
            onSubmit={(form) => (modal === "create" ? create(form) : update(modal.id, form))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

export default function LabourRelations() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"disciplinary" | "grievances" | "ccma" | "unions">("disciplinary");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoading(true);
    setLoadError(false);
    api
      .get<Worker[]>("/workers")
      .then((res) => setWorkers(res.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("labourRelations.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("labourRelations.subtitle")}</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className={tab === "disciplinary" ? buttonPrimary : buttonSecondary} onClick={() => setTab("disciplinary")}>{t("labourRelations.tabDisciplinary")}</button>
        <button className={tab === "grievances" ? buttonPrimary : buttonSecondary} onClick={() => setTab("grievances")}>{t("labourRelations.tabGrievances")}</button>
        <button className={tab === "ccma" ? buttonPrimary : buttonSecondary} onClick={() => setTab("ccma")}>{t("labourRelations.tabCcma")}</button>
        <button className={tab === "unions" ? buttonPrimary : buttonSecondary} onClick={() => setTab("unions")}>{t("labourRelations.tabUnions")}</button>
      </div>
      {tab === "disciplinary" && <DisciplinaryTab workers={workers} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "grievances" && <GrievancesTab workers={workers} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "ccma" && <CcmaTab workers={workers} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "unions" && <UnionAgreementsTab canEdit={canEdit} canDelete={canDelete} />}
    </div>
  );
}
