import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { IodClaim, IodClaimStatus, Incident, Worker } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";
import LoadError from "../../components/LoadError";

const claimStatuses: IodClaimStatus[] = ["REPORTED", "SUBMITTED", "UNDER_ASSESSMENT", "ACCEPTED", "REJECTED", "CLOSED"];

function ClaimForm({ workers, incidents, initial, onSubmit, onCancel }: {
  workers: Worker[];
  incidents: Incident[];
  initial?: IodClaim;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(initial?.workerId ?? workers[0]?.id ?? "");
  const [incidentId, setIncidentId] = useState(initial?.incidentId ?? "");
  const [claimNumber, setClaimNumber] = useState(initial?.claimNumber ?? "");
  const [dateOfInjury, setDateOfInjury] = useState(initial?.dateOfInjury?.slice(0, 10) ?? "");
  const [natureOfInjury, setNatureOfInjury] = useState(initial?.natureOfInjury ?? "");
  const [wclForm2Filed, setWclForm2Filed] = useState(initial?.wclForm2Filed ?? false);
  const [status, setStatus] = useState<IodClaimStatus>(initial?.status ?? "REPORTED");
  const [compensationAmount, setCompensationAmount] = useState(initial?.compensationAmount?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        workerId,
        incidentId: incidentId || null,
        claimNumber: claimNumber || undefined,
        dateOfInjury,
        natureOfInjury,
        wclForm2Filed,
        wclForm2FiledAt: wclForm2Filed ? new Date().toISOString() : null,
        status,
        compensationAmount: compensationAmount ? Number(compensationAmount) : null,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("iodClaims.worker")}</label>
          <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)} required>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({t(`workers.categories.${w.category}`)})</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("iodClaims.relatedIncident")}</label>
          <select className={selectClass} value={incidentId} onChange={(e) => setIncidentId(e.target.value)}>
            <option value="">{t("iodClaims.noRelatedIncident")}</option>
            {incidents.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("iodClaims.dateOfInjury")}</label>
          <DateField value={dateOfInjury} onChange={setDateOfInjury} required />
        </div>
        <div>
          <label className={labelClass}>{t("iodClaims.claimNumber")}</label>
          <input className={inputClass} value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("iodClaims.natureOfInjury")}</label>
        <textarea className={inputClass} rows={2} value={natureOfInjury} onChange={(e) => setNatureOfInjury(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as IodClaimStatus)}>
            {claimStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("iodClaims.compensationAmount")}</label>
          <input className={inputClass} type="number" step="any" value={compensationAmount} onChange={(e) => setCompensationAmount(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={wclForm2Filed} onChange={(e) => setWclForm2Filed(e.target.checked)} />
        {t("iodClaims.wclForm2Filed")}
      </label>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function IodClaimsTab({ workers }: { workers: Worker[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [claims, setClaims] = useState<IodClaim[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | IodClaim>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [c, i] = await Promise.all([
        api.get<IodClaim[]>("/iod-claims"),
        api.get<Incident[]>("/incidents"),
      ]);
      setClaims(c.data);
      setIncidents(i.data);
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
    await api.post("/iod-claims", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/iod-claims/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("iodClaims.confirmDelete"))) return;
    await api.delete(`/iod-claims/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const openCount = claims.filter((c) => c.status !== "CLOSED" && c.status !== "REJECTED").length;
  const underAssessmentCount = claims.filter((c) => c.status === "UNDER_ASSESSMENT").length;

  const columns: DataTableColumn<IodClaim>[] = [
    { key: "worker", header: t("iodClaims.worker"), render: (c) => c.worker?.name ?? "—", sortValue: (c) => c.worker?.name ?? "" },
    { key: "dateOfInjury", header: t("iodClaims.dateOfInjury"), render: (c) => new Date(c.dateOfInjury).toLocaleDateString(), sortValue: (c) => c.dateOfInjury },
    { key: "nature", header: t("iodClaims.natureOfInjury"), render: (c) => <div className="truncate max-w-xs" title={c.natureOfInjury}>{c.natureOfInjury}</div> },
    { key: "claimNumber", header: t("iodClaims.claimNumber"), render: (c) => c.claimNumber ?? "—", sortValue: (c) => c.claimNumber ?? "" },
    { key: "status", header: t("common.status"), render: (c) => <StatusBadge status={c.status} />, sortValue: (c) => c.status },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("iodClaims.hint")}</p>

      <SummaryCards
        cards={[
          { label: t("iodClaims.summaryOpen"), value: openCount },
          { label: t("iodClaims.summaryUnderAssessment"), value: underAssessmentCount, tone: underAssessmentCount > 0 ? "hazard" : "default" },
        ]}
      />

      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("iodClaims.new")}</button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={claims}
        rowKey={(c) => c.id}
        emptyMessage={t("iodClaims.noneYet")}
        searchValue={(c) => `${c.worker?.name ?? ""} ${c.natureOfInjury} ${c.claimNumber ?? ""}`}
        exportFilename="iod-claims"
        exportColumns={[
          { header: t("iodClaims.worker"), value: (c) => c.worker?.name ?? "" },
          { header: t("iodClaims.dateOfInjury"), value: (c) => c.dateOfInjury },
          { header: t("iodClaims.natureOfInjury"), value: (c) => c.natureOfInjury },
          { header: t("iodClaims.claimNumber"), value: (c) => c.claimNumber ?? "" },
          { header: t("common.status"), value: (c) => c.status },
        ]}
        actions={(c) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="IodClaim" entityId={c.id} />
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(c)}>{t("common.edit")}</button>}
            {canDelete && <button className={buttonDanger} onClick={() => remove(c.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />

      {modal && (
        <Modal title={modal === "create" ? t("iodClaims.newTitle") : t("iodClaims.editTitle")} onClose={() => setModal(null)}>
          <ClaimForm
            workers={workers}
            incidents={incidents}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
