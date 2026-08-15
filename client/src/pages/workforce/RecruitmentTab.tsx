import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  Candidate,
  CandidateSource,
  CandidateStage,
  JobRequisition,
  JobRequisitionStatus,
  Site,
  StaffCategory,
} from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";
import LoadError from "../../components/LoadError";

const staffCategories: StaffCategory[] = [
  "MINING_OPERATIONS",
  "ENGINEERING_TECHNICAL",
  "DRIVER",
  "CLEANER",
  "SECURITY",
  "ADMINISTRATION",
  "EXECUTIVE",
  "MEDICAL",
  "SAFETY_HEALTH",
  "MAINTENANCE",
  "CATERING",
  "OTHER",
];
const requisitionStatuses: JobRequisitionStatus[] = ["DRAFT", "OPEN", "ON_HOLD", "FILLED", "CANCELLED"];
const candidateSources: CandidateSource[] = ["REFERRAL", "AGENCY", "WALK_IN", "ONLINE_APPLICATION", "INTERNAL", "OTHER"];
const candidateStages: CandidateStage[] = ["APPLIED", "SHORTLISTED", "INTERVIEWED", "OFFERED", "REJECTED", "WITHDRAWN"];

function RequisitionForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: JobRequisition;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [positionTitle, setPositionTitle] = useState(initial?.positionTitle ?? "");
  const [category, setCategory] = useState<StaffCategory>(initial?.category ?? "MINING_OPERATIONS");
  const [numberOfPositions, setNumberOfPositions] = useState(initial?.numberOfPositions?.toString() ?? "1");
  const [justification, setJustification] = useState(initial?.justification ?? "");
  const [status, setStatus] = useState<JobRequisitionStatus>(initial?.status ?? "DRAFT");
  const [targetFillDate, setTargetFillDate] = useState(initial?.targetFillDate?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        positionTitle,
        category,
        numberOfPositions: Number(numberOfPositions) || 1,
        justification: justification || undefined,
        status,
        targetFillDate: targetFillDate || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("recruitment.positionTitle")}</label>
          <input className={inputClass} value={positionTitle} onChange={(e) => setPositionTitle(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("workers.category")}</label>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as StaffCategory)}>
            {staffCategories.map((c) => <option key={c} value={c}>{t(`workers.categories.${c}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("recruitment.numberOfPositions")}</label>
          <input className={inputClass} type="number" min={1} value={numberOfPositions} onChange={(e) => setNumberOfPositions(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("recruitment.justification")}</label>
        <textarea className={inputClass} rows={2} value={justification} onChange={(e) => setJustification(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as JobRequisitionStatus)}>
            {requisitionStatuses.map((s) => <option key={s} value={s}>{t(`recruitment.requisitionStatuses.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("recruitment.targetFillDate")}</label>
          <DateField value={targetFillDate} onChange={setTargetFillDate} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function CandidateForm({ requisitionId, onSubmit, onCancel }: {
  requisitionId: string;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<CandidateSource>("ONLINE_APPLICATION");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ requisitionId, fullName, idNumber: idNumber || undefined, email: email || undefined, phone: phone || undefined, source });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("recruitment.candidateName")}</label>
        <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("recruitment.idNumber")}</label>
          <input className={inputClass} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("recruitment.source")}</label>
          <select className={selectClass} value={source} onChange={(e) => setSource(e.target.value as CandidateSource)}>
            {candidateSources.map((s) => <option key={s} value={s}>{t(`recruitment.sources.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.email")}</label>
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("common.phone")}</label>
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function HireForm({ onSubmit, onCancel }: { onSubmit: (employeeId: string, role: string) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(employeeId, role);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-mine-400">{t("recruitment.hireHint")}</p>
      <div>
        <label className={labelClass}>{t("workers.employeeId")}</label>
        <input className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("common.role")}</label>
        <input className={inputClass} value={role} onChange={(e) => setRole(e.target.value)} required />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("recruitment.confirmHire")}</button>
      </div>
    </form>
  );
}

function CandidatesModal({ requisition, canEdit, canDelete, onClose }: {
  requisition: JobRequisition;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);
  const [hiring, setHiring] = useState<Candidate | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<Candidate[]>("/recruitment/candidates", { params: { requisitionId: requisition.id } });
      setCandidates(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(data: any) {
    await api.post("/recruitment/candidates", data);
    setModal(false);
    await load();
  }

  async function updateStage(id: string, stage: CandidateStage) {
    await api.put(`/recruitment/candidates/${id}`, { stage });
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("recruitment.confirmDeleteCandidate"))) return;
    await api.delete(`/recruitment/candidates/${id}`);
    await load();
  }

  async function uploadResume(id: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.item(0);
    if (!file) return;
    setUploadingFor(id);
    try {
      const form = new FormData();
      form.append("file", file);
      await api.post(`/recruitment/candidates/${id}/resume`, form, { headers: { "Content-Type": "multipart/form-data" } });
      await load();
    } finally {
      setUploadingFor(null);
      e.target.value = "";
    }
  }

  async function confirmHire(employeeId: string, role: string) {
    if (!hiring) return;
    await api.post(`/recruitment/candidates/${hiring.id}/hire`, { employeeId, role });
    setHiring(null);
    await load();
  }

  const columns: DataTableColumn<Candidate>[] = [
    { key: "name", header: t("recruitment.candidateName"), render: (c) => <span className="font-medium">{c.fullName}</span>, sortValue: (c) => c.fullName },
    { key: "source", header: t("recruitment.source"), render: (c) => t(`recruitment.sources.${c.source}`), sortValue: (c) => c.source },
    {
      key: "stage",
      header: t("recruitment.stage"),
      render: (c) =>
        c.stage === "HIRED" ? (
          <StatusBadge status={c.stage} />
        ) : (
          <select
            className={`${selectClass} text-xs py-1`}
            value={c.stage}
            onChange={(e) => updateStage(c.id, e.target.value as CandidateStage)}
            disabled={!canEdit}
          >
            {candidateStages.map((s) => <option key={s} value={s}>{t(`recruitment.stages.${s}`)}</option>)}
          </select>
        ),
      sortValue: (c) => c.stage,
    },
    { key: "applied", header: t("recruitment.appliedDate"), render: (c) => new Date(c.appliedDate).toLocaleDateString(), sortValue: (c) => c.appliedDate },
  ];

  if (loading) return <div className="text-mine-300 text-sm">{t("common.loading")}</div>;
  if (loadError) {
    return (
      <Modal title={t("recruitment.candidatesFor", { position: requisition.positionTitle })} onClose={onClose} size="lg">
        <LoadError onRetry={load} />
      </Modal>
    );
  }

  return (
    <Modal title={t("recruitment.candidatesFor", { position: requisition.positionTitle })} onClose={onClose} size="lg">
      <div className="space-y-4">
        {canEdit && (
          <div className="flex justify-end">
            <button className={buttonPrimary} onClick={() => setModal(true)}>{t("recruitment.newCandidate")}</button>
          </div>
        )}
        <DataTable
          columns={columns}
          rows={candidates}
          rowKey={(c) => c.id}
          emptyMessage={t("recruitment.noCandidates")}
          searchValue={(c) => c.fullName}
          actions={(c) => (
            <div className="flex justify-end items-center gap-2">
              {c.resumeFileName ? (
                <a className="text-xs text-mine-300 hover:text-mine-50" href={`${API_URL}/api/recruitment/candidates/${c.id}/resume`} target="_blank" rel="noreferrer">
                  {t("recruitment.viewResume")}
                </a>
              ) : canEdit ? (
                <label className="text-xs text-mine-300 hover:text-mine-50 cursor-pointer">
                  {uploadingFor === c.id ? t("common.saving") : t("recruitment.uploadResume")}
                  <input type="file" className="hidden" onChange={(e) => uploadResume(c.id, e)} disabled={uploadingFor === c.id} />
                </label>
              ) : null}
              {canEdit && c.stage !== "HIRED" && (c.stage === "OFFERED" || c.stage === "INTERVIEWED") && (
                <button className="text-xs font-bold text-success-500 hover:text-success-600" onClick={() => setHiring(c)}>
                  {t("recruitment.hire")}
                </button>
              )}
              <AuditHistoryButton entityType="Candidate" entityId={c.id} />
              {canDelete && c.stage !== "HIRED" && <button className={buttonDanger} onClick={() => remove(c.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
        {modal && (
          <Modal title={t("recruitment.newCandidateTitle")} onClose={() => setModal(false)}>
            <CandidateForm requisitionId={requisition.id} onSubmit={create} onCancel={() => setModal(false)} />
          </Modal>
        )}
        {hiring && (
          <Modal title={t("recruitment.hireTitle", { name: hiring.fullName })} onClose={() => setHiring(null)}>
            <HireForm onSubmit={confirmHire} onCancel={() => setHiring(null)} />
          </Modal>
        )}
      </div>
    </Modal>
  );
}

export default function RecruitmentTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [requisitions, setRequisitions] = useState<JobRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | JobRequisition>(null);
  const [candidatesFor, setCandidatesFor] = useState<JobRequisition | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<JobRequisition[]>("/recruitment/requisitions");
      setRequisitions(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/recruitment/requisitions", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/recruitment/requisitions/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("recruitment.confirmDeleteRequisition"))) return;
    await api.delete(`/recruitment/requisitions/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const openCount = requisitions.filter((r) => r.status === "OPEN").length;
  const inPipelineCount = requisitions.reduce((sum, r) => sum + (r._count?.candidates ?? 0), 0);

  const columns: DataTableColumn<JobRequisition>[] = [
    { key: "position", header: t("recruitment.positionTitle"), render: (r) => <span className="font-medium">{r.positionTitle}</span>, sortValue: (r) => r.positionTitle },
    { key: "site", header: t("common.site"), render: (r) => r.site?.name ?? "—", sortValue: (r) => r.site?.name ?? "" },
    { key: "category", header: t("workers.category"), render: (r) => t(`workers.categories.${r.category}`), sortValue: (r) => r.category },
    { key: "positions", header: t("recruitment.numberOfPositions"), render: (r) => r.numberOfPositions, sortValue: (r) => r.numberOfPositions },
    { key: "candidates", header: t("recruitment.candidates"), render: (r) => r._count?.candidates ?? 0, sortValue: (r) => r._count?.candidates ?? 0 },
    { key: "status", header: t("common.status"), render: (r) => <StatusBadge status={r.status} />, sortValue: (r) => r.status },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("recruitment.hint")}</p>

      <SummaryCards
        cards={[
          { label: t("recruitment.summaryOpenRequisitions"), value: openCount },
          { label: t("recruitment.summaryCandidatesInPipeline"), value: inPipelineCount },
        ]}
      />

      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("recruitment.newRequisition")}</button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={requisitions}
        rowKey={(r) => r.id}
        emptyMessage={t("recruitment.noRequisitions")}
        searchValue={(r) => `${r.positionTitle} ${r.site?.name ?? ""}`}
        exportFilename="job-requisitions"
        exportColumns={[
          { header: t("recruitment.positionTitle"), value: (r) => r.positionTitle },
          { header: t("common.site"), value: (r) => r.site?.name ?? "" },
          { header: t("workers.category"), value: (r) => r.category },
          { header: t("recruitment.numberOfPositions"), value: (r) => r.numberOfPositions },
          { header: t("common.status"), value: (r) => r.status },
        ]}
        actions={(r) => (
          <div className="flex justify-end gap-2">
            <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setCandidatesFor(r)}>
              {t("recruitment.viewCandidates")}
            </button>
            <AuditHistoryButton entityType="JobRequisition" entityId={r.id} />
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(r)}>{t("common.edit")}</button>}
            {canDelete && <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />

      {modal && (
        <Modal title={modal === "create" ? t("recruitment.newRequisitionTitle") : t("recruitment.editRequisitionTitle")} onClose={() => setModal(null)}>
          <RequisitionForm
            sites={sites}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {candidatesFor && (
        <CandidatesModal requisition={candidatesFor} canEdit={canEdit} canDelete={canDelete} onClose={() => setCandidatesFor(null)} />
      )}
    </div>
  );
}
