import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Incident, InsuranceClaim, InsuranceClaimStatus, InsurancePolicy, InsurancePolicyStatus, InsurancePolicyType } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import DataTable, { DataTableColumn } from "../components/DataTable";
import SummaryCards from "../components/SummaryCards";
import LoadError from "../components/LoadError";

const policyTypes: InsurancePolicyType[] = ["PROPERTY", "EQUIPMENT", "LIABILITY", "BUSINESS_INTERRUPTION", "MARINE_TRANSIT", "DIRECTORS_OFFICERS", "OTHER"];
const policyStatuses: InsurancePolicyStatus[] = ["ACTIVE", "EXPIRED", "CANCELLED", "PENDING_RENEWAL"];
const claimStatuses: InsuranceClaimStatus[] = ["LODGED", "UNDER_ASSESSMENT", "APPROVED", "REJECTED", "SETTLED", "CLOSED"];

function PolicyForm({ initial, onSubmit, onCancel }: {
  initial?: InsurancePolicy;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [policyNumber, setPolicyNumber] = useState(initial?.policyNumber ?? "");
  const [insurer, setInsurer] = useState(initial?.insurer ?? "");
  const [policyType, setPolicyType] = useState<InsurancePolicyType>(initial?.policyType ?? "PROPERTY");
  const [coverageAmount, setCoverageAmount] = useState(initial?.coverageAmount?.toString() ?? "");
  const [premiumAmount, setPremiumAmount] = useState(initial?.premiumAmount?.toString() ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate?.slice(0, 10) ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<InsurancePolicyStatus>(initial?.status ?? "ACTIVE");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        policyNumber,
        insurer,
        policyType,
        coverageAmount: coverageAmount ? Number(coverageAmount) : null,
        premiumAmount: premiumAmount ? Number(premiumAmount) : null,
        startDate,
        expiryDate,
        status,
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
          <label className={labelClass}>{t("insurance.policyNumber")}</label>
          <input className={inputClass} value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("insurance.insurer")}</label>
          <input className={inputClass} value={insurer} onChange={(e) => setInsurer(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("insurance.policyType")}</label>
          <select className={selectClass} value={policyType} onChange={(e) => setPolicyType(e.target.value as InsurancePolicyType)}>
            {policyTypes.map((pt) => <option key={pt} value={pt}>{t(`insurance.policyTypes.${pt}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as InsurancePolicyStatus)}>
            {policyStatuses.map((s) => <option key={s} value={s}>{t(`insurance.policyStatuses.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("insurance.coverageAmount")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={coverageAmount} onChange={(e) => setCoverageAmount(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("insurance.premiumAmount")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={premiumAmount} onChange={(e) => setPremiumAmount(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("insurance.startDate")}</label>
          <DateField value={startDate} onChange={setStartDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("insurance.expiryDate")}</label>
          <DateField value={expiryDate} onChange={setExpiryDate} required />
        </div>
      </div>
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

function ClaimForm({ policies, incidents, initial, onSubmit, onCancel }: {
  policies: InsurancePolicy[];
  incidents: Incident[];
  initial?: InsuranceClaim;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [policyId, setPolicyId] = useState(initial?.policyId ?? policies[0]?.id ?? "");
  const [incidentId, setIncidentId] = useState(initial?.incidentId ?? "");
  const [claimNumber, setClaimNumber] = useState(initial?.claimNumber ?? "");
  const [dateOfLoss, setDateOfLoss] = useState(initial?.dateOfLoss?.slice(0, 10) ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amountClaimed, setAmountClaimed] = useState(initial?.amountClaimed?.toString() ?? "");
  const [amountSettled, setAmountSettled] = useState(initial?.amountSettled?.toString() ?? "");
  const [status, setStatus] = useState<InsuranceClaimStatus>(initial?.status ?? "LODGED");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        policyId,
        incidentId: incidentId || null,
        claimNumber: claimNumber || undefined,
        dateOfLoss,
        description,
        amountClaimed: amountClaimed ? Number(amountClaimed) : null,
        amountSettled: amountSettled ? Number(amountSettled) : null,
        status,
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
          <label className={labelClass}>{t("insurance.policy")}</label>
          <select className={selectClass} value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
            {policies.map((p) => <option key={p.id} value={p.id}>{p.policyNumber} ({p.insurer})</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("insurance.relatedIncident")}</label>
          <select className={selectClass} value={incidentId} onChange={(e) => setIncidentId(e.target.value)}>
            <option value="">{t("insurance.noIncident")}</option>
            {incidents.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("insurance.claimNumber")}</label>
          <input className={inputClass} value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("insurance.dateOfLoss")}</label>
          <DateField value={dateOfLoss} onChange={setDateOfLoss} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("insurance.description")}</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("insurance.amountClaimed")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={amountClaimed} onChange={(e) => setAmountClaimed(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("insurance.amountSettled")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={amountSettled} onChange={(e) => setAmountSettled(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as InsuranceClaimStatus)}>
          {claimStatuses.map((s) => <option key={s} value={s}>{t(`insurance.claimStatuses.${s}`)}</option>)}
        </select>
      </div>
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

export default function Insurance() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [policyModal, setPolicyModal] = useState<null | "create" | InsurancePolicy>(null);
  const [claimModal, setClaimModal] = useState<null | "create" | InsuranceClaim>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [p, c, i] = await Promise.all([
        api.get<InsurancePolicy[]>("/insurance/policies"),
        api.get<InsuranceClaim[]>("/insurance/claims"),
        api.get<Incident[]>("/incidents"),
      ]);
      setPolicies(p.data);
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

  async function createPolicy(data: any) {
    await api.post("/insurance/policies", data);
    setPolicyModal(null);
    await load();
  }
  async function updatePolicy(id: string, data: any) {
    await api.put(`/insurance/policies/${id}`, data);
    setPolicyModal(null);
    await load();
  }
  async function removePolicy(id: string) {
    if (!confirm(t("insurance.confirmDeletePolicy"))) return;
    await api.delete(`/insurance/policies/${id}`);
    await load();
  }

  async function createClaim(data: any) {
    await api.post("/insurance/claims", data);
    setClaimModal(null);
    await load();
  }
  async function updateClaim(id: string, data: any) {
    await api.put(`/insurance/claims/${id}`, data);
    setClaimModal(null);
    await load();
  }
  async function removeClaim(id: string) {
    if (!confirm(t("insurance.confirmDeleteClaim"))) return;
    await api.delete(`/insurance/claims/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const now = Date.now();
  const expiringSoonCount = policies.filter((p) => p.status === "ACTIVE" && new Date(p.expiryDate).getTime() - now < 30 * 24 * 60 * 60 * 1000).length;
  const openClaimsCount = claims.filter((c) => !["SETTLED", "CLOSED", "REJECTED"].includes(c.status)).length;
  const totalCoverage = policies.filter((p) => p.status === "ACTIVE").reduce((sum, p) => sum + (p.coverageAmount ?? 0), 0);

  const policyColumns: DataTableColumn<InsurancePolicy>[] = [
    { key: "policyNumber", header: t("insurance.policyNumber"), render: (p) => p.policyNumber, sortValue: (p) => p.policyNumber },
    { key: "insurer", header: t("insurance.insurer"), render: (p) => p.insurer, sortValue: (p) => p.insurer },
    { key: "policyType", header: t("insurance.policyType"), render: (p) => t(`insurance.policyTypes.${p.policyType}`), sortValue: (p) => p.policyType },
    { key: "expiryDate", header: t("insurance.expiryDate"), render: (p) => new Date(p.expiryDate).toLocaleDateString(), sortValue: (p) => p.expiryDate },
    { key: "status", header: t("common.status"), render: (p) => <StatusBadge status={p.status} />, sortValue: (p) => p.status },
  ];

  const claimColumns: DataTableColumn<InsuranceClaim>[] = [
    { key: "claimNumber", header: t("insurance.claimNumber"), render: (c) => c.claimNumber ?? "—", sortValue: (c) => c.claimNumber ?? "" },
    { key: "policy", header: t("insurance.policy"), render: (c) => c.policy?.policyNumber ?? "—", sortValue: (c) => c.policy?.policyNumber ?? "" },
    { key: "dateOfLoss", header: t("insurance.dateOfLoss"), render: (c) => new Date(c.dateOfLoss).toLocaleDateString(), sortValue: (c) => c.dateOfLoss },
    { key: "amountClaimed", header: t("insurance.amountClaimed"), render: (c) => (c.amountClaimed != null ? c.amountClaimed.toLocaleString() : "—"), sortValue: (c) => c.amountClaimed ?? 0 },
    { key: "status", header: t("common.status"), render: (c) => <StatusBadge status={c.status} />, sortValue: (c) => c.status },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">{t("insurance.title")}</h1>
        <p className="text-mine-300 text-sm">{t("insurance.subtitle")}</p>
      </div>

      <SummaryCards
        cards={[
          { label: t("insurance.summaryTotalCoverage"), value: totalCoverage.toLocaleString() },
          { label: t("insurance.summaryExpiringSoon"), value: expiringSoonCount, tone: expiringSoonCount > 0 ? "hazard" : "default" },
          { label: t("insurance.summaryOpenClaims"), value: openClaimsCount, tone: openClaimsCount > 0 ? "hazard" : "default" },
        ]}
      />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-mine-200">{t("insurance.policiesTitle")}</h2>
          {canEdit && <button className={buttonPrimary} onClick={() => setPolicyModal("create")}>{t("insurance.newPolicy")}</button>}
        </div>
        <DataTable
          columns={policyColumns}
          rows={policies}
          rowKey={(p) => p.id}
          emptyMessage={t("insurance.noPoliciesYet")}
          searchValue={(p) => `${p.policyNumber} ${p.insurer}`}
          exportFilename="insurance-policies"
          exportColumns={[
            { header: t("insurance.policyNumber"), value: (p) => p.policyNumber },
            { header: t("insurance.insurer"), value: (p) => p.insurer },
            { header: t("common.status"), value: (p) => p.status },
          ]}
          actions={(p) => (
            <div className="flex justify-end gap-2">
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setPolicyModal(p)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => removePolicy(p.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-mine-200">{t("insurance.claimsTitle")}</h2>
          {canEdit && policies.length > 0 && <button className={buttonPrimary} onClick={() => setClaimModal("create")}>{t("insurance.newClaim")}</button>}
        </div>
        <DataTable
          columns={claimColumns}
          rows={claims}
          rowKey={(c) => c.id}
          emptyMessage={t("insurance.noClaimsYet")}
          searchValue={(c) => `${c.claimNumber ?? ""} ${c.description}`}
          exportFilename="insurance-claims"
          exportColumns={[
            { header: t("insurance.claimNumber"), value: (c) => c.claimNumber ?? "" },
            { header: t("common.status"), value: (c) => c.status },
          ]}
          actions={(c) => (
            <div className="flex justify-end gap-2">
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setClaimModal(c)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => removeClaim(c.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {policyModal && (
        <Modal title={policyModal === "create" ? t("insurance.newPolicyTitle") : t("insurance.editPolicyTitle")} onClose={() => setPolicyModal(null)}>
          <PolicyForm
            initial={policyModal === "create" ? undefined : policyModal}
            onSubmit={(data) => (policyModal === "create" ? createPolicy(data) : updatePolicy(policyModal.id, data))}
            onCancel={() => setPolicyModal(null)}
          />
        </Modal>
      )}

      {claimModal && (
        <Modal title={claimModal === "create" ? t("insurance.newClaimTitle") : t("insurance.editClaimTitle")} onClose={() => setClaimModal(null)}>
          <ClaimForm
            policies={policies}
            incidents={incidents}
            initial={claimModal === "create" ? undefined : claimModal}
            onSubmit={(data) => (claimModal === "create" ? createClaim(data) : updateClaim(claimModal.id, data))}
            onCancel={() => setClaimModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
