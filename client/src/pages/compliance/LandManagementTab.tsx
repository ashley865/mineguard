import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { LandAgreement, LandAgreementStatus, LandTenureType, ResettlementCase, ResettlementStatus, Site } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";

const tenureTypes: LandTenureType[] = ["SURFACE_RIGHTS_LEASE", "SERVITUDE", "PERMISSION_TO_OCCUPY", "RESETTLEMENT_AGREEMENT", "OTHER"];
const agreementStatuses: LandAgreementStatus[] = ["DRAFT", "NEGOTIATING", "SIGNED", "EXPIRED", "TERMINATED"];
const resettlementStatuses: ResettlementStatus[] = ["IDENTIFIED", "CONSULTATION", "COMPENSATION_AGREED", "RELOCATED", "LIVELIHOOD_RESTORED", "CLOSED"];

function AgreementForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: LandAgreement;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? "");
  const [parcelReference, setParcelReference] = useState(initial?.parcelReference ?? "");
  const [counterpartyName, setCounterpartyName] = useState(initial?.counterpartyName ?? "");
  const [tenureType, setTenureType] = useState<LandTenureType>(initial?.tenureType ?? "SURFACE_RIGHTS_LEASE");
  const [areaHectares, setAreaHectares] = useState(initial?.areaHectares?.toString() ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate?.slice(0, 10) ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate?.slice(0, 10) ?? "");
  const [annualPaymentAmount, setAnnualPaymentAmount] = useState(initial?.annualPaymentAmount?.toString() ?? "");
  const [status, setStatus] = useState<LandAgreementStatus>(initial?.status ?? "DRAFT");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId: siteId || null,
        parcelReference: parcelReference || undefined,
        counterpartyName,
        tenureType,
        areaHectares: areaHectares ? Number(areaHectares) : null,
        startDate: startDate || null,
        expiryDate: expiryDate || null,
        annualPaymentAmount: annualPaymentAmount ? Number(annualPaymentAmount) : null,
        status,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("landManagement.counterpartyName")}</label>
        <input className={inputClass} value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("landManagement.tenureType")}</label>
          <select className={selectClass} value={tenureType} onChange={(e) => setTenureType(e.target.value as LandTenureType)}>
            {tenureTypes.map((tt) => <option key={tt} value={tt}>{t(`landManagement.tenureTypes.${tt}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">{t("landManagement.mineWide")}</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("landManagement.parcelReference")}</label>
          <input className={inputClass} value={parcelReference} onChange={(e) => setParcelReference(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("landManagement.areaHectares")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={areaHectares} onChange={(e) => setAreaHectares(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("landManagement.startDate")}</label>
          <DateField value={startDate} onChange={setStartDate} />
        </div>
        <div>
          <label className={labelClass}>{t("landManagement.expiryDate")}</label>
          <DateField value={expiryDate} onChange={setExpiryDate} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("landManagement.annualPaymentAmount")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={annualPaymentAmount} onChange={(e) => setAnnualPaymentAmount(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as LandAgreementStatus)}>
            {agreementStatuses.map((s) => <option key={s} value={s}>{t(`landManagement.agreementStatuses.${s}`)}</option>)}
          </select>
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

function ResettlementForm({ agreements, initial, onSubmit, onCancel }: {
  agreements: LandAgreement[];
  initial?: ResettlementCase;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [landAgreementId, setLandAgreementId] = useState(initial?.landAgreementId ?? "");
  const [householdName, setHouseholdName] = useState(initial?.householdName ?? "");
  const [householdSize, setHouseholdSize] = useState(initial?.householdSize?.toString() ?? "");
  const [status, setStatus] = useState<ResettlementStatus>(initial?.status ?? "IDENTIFIED");
  const [compensationAmount, setCompensationAmount] = useState(initial?.compensationAmount?.toString() ?? "");
  const [compensationPaidAt, setCompensationPaidAt] = useState(initial?.compensationPaidAt?.slice(0, 10) ?? "");
  const [relocationDate, setRelocationDate] = useState(initial?.relocationDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        landAgreementId: landAgreementId || null,
        householdName,
        householdSize: householdSize ? Number(householdSize) : null,
        status,
        compensationAmount: compensationAmount ? Number(compensationAmount) : null,
        compensationPaidAt: compensationPaidAt || null,
        relocationDate: relocationDate || null,
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
          <label className={labelClass}>{t("landManagement.householdName")}</label>
          <input className={inputClass} value={householdName} onChange={(e) => setHouseholdName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("landManagement.householdSize")}</label>
          <input className={inputClass} type="number" min={0} value={householdSize} onChange={(e) => setHouseholdSize(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("landManagement.relatedAgreement")}</label>
        <select className={selectClass} value={landAgreementId} onChange={(e) => setLandAgreementId(e.target.value)}>
          <option value="">{t("landManagement.noAgreement")}</option>
          {agreements.map((a) => <option key={a.id} value={a.id}>{a.counterpartyName}{a.parcelReference ? ` (${a.parcelReference})` : ""}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ResettlementStatus)}>
            {resettlementStatuses.map((s) => <option key={s} value={s}>{t(`landManagement.resettlementStatuses.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("landManagement.compensationAmount")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={compensationAmount} onChange={(e) => setCompensationAmount(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("landManagement.compensationPaidAt")}</label>
          <DateField value={compensationPaidAt} onChange={setCompensationPaidAt} />
        </div>
        <div>
          <label className={labelClass}>{t("landManagement.relocationDate")}</label>
          <DateField value={relocationDate} onChange={setRelocationDate} />
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

export default function LandManagementTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [agreements, setAgreements] = useState<LandAgreement[]>([]);
  const [cases, setCases] = useState<ResettlementCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [agreementModal, setAgreementModal] = useState<null | "create" | LandAgreement>(null);
  const [caseModal, setCaseModal] = useState<null | "create" | ResettlementCase>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [ag, cs] = await Promise.all([
        api.get<LandAgreement[]>("/land-management/agreements"),
        api.get<ResettlementCase[]>("/land-management/resettlement-cases"),
      ]);
      setAgreements(ag.data);
      setCases(cs.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createAgreement(data: any) {
    await api.post("/land-management/agreements", data);
    setAgreementModal(null);
    await load();
  }
  async function updateAgreement(id: string, data: any) {
    await api.put(`/land-management/agreements/${id}`, data);
    setAgreementModal(null);
    await load();
  }
  async function removeAgreement(id: string) {
    if (!confirm(t("landManagement.confirmDeleteAgreement"))) return;
    await api.delete(`/land-management/agreements/${id}`);
    await load();
  }

  async function createCase(data: any) {
    await api.post("/land-management/resettlement-cases", data);
    setCaseModal(null);
    await load();
  }
  async function updateCase(id: string, data: any) {
    await api.put(`/land-management/resettlement-cases/${id}`, data);
    setCaseModal(null);
    await load();
  }
  async function removeCase(id: string) {
    if (!confirm(t("landManagement.confirmDeleteCase"))) return;
    await api.delete(`/land-management/resettlement-cases/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const agreementColumns: DataTableColumn<LandAgreement>[] = [
    { key: "counterpartyName", header: t("landManagement.counterpartyName"), render: (a) => a.counterpartyName, sortValue: (a) => a.counterpartyName },
    { key: "tenureType", header: t("landManagement.tenureType"), render: (a) => t(`landManagement.tenureTypes.${a.tenureType}`), sortValue: (a) => a.tenureType },
    { key: "site", header: t("common.site"), render: (a) => a.site?.name ?? t("landManagement.mineWide"), sortValue: (a) => a.site?.name ?? "" },
    { key: "expiryDate", header: t("landManagement.expiryDate"), render: (a) => (a.expiryDate ? new Date(a.expiryDate).toLocaleDateString() : "—"), sortValue: (a) => a.expiryDate ?? "" },
    { key: "status", header: t("common.status"), render: (a) => <StatusBadge status={a.status} />, sortValue: (a) => a.status },
  ];

  const caseColumns: DataTableColumn<ResettlementCase>[] = [
    { key: "householdName", header: t("landManagement.householdName"), render: (c) => c.householdName, sortValue: (c) => c.householdName },
    { key: "landAgreement", header: t("landManagement.relatedAgreement"), render: (c) => c.landAgreement?.counterpartyName ?? "—", sortValue: (c) => c.landAgreement?.counterpartyName ?? "" },
    { key: "status", header: t("common.status"), render: (c) => <StatusBadge status={c.status} />, sortValue: (c) => c.status },
    { key: "compensationAmount", header: t("landManagement.compensationAmount"), render: (c) => (c.compensationAmount != null ? c.compensationAmount.toLocaleString() : "—"), sortValue: (c) => c.compensationAmount ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("landManagement.agreementsTitle")}</h2>
            <p className="text-xs text-mine-400">{t("landManagement.agreementsHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setAgreementModal("create")}>{t("landManagement.newAgreement")}</button>}
        </div>
        <DataTable
          columns={agreementColumns}
          rows={agreements}
          rowKey={(a) => a.id}
          emptyMessage={t("landManagement.noAgreementsYet")}
          searchValue={(a) => `${a.counterpartyName} ${a.parcelReference ?? ""}`}
          exportFilename="land-agreements"
          exportColumns={[
            { header: t("landManagement.counterpartyName"), value: (a) => a.counterpartyName },
            { header: t("landManagement.tenureType"), value: (a) => a.tenureType },
            { header: t("common.status"), value: (a) => a.status },
          ]}
          actions={(a) => (
            <div className="flex justify-end gap-2">
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setAgreementModal(a)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => removeAgreement(a.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("landManagement.casesTitle")}</h2>
            <p className="text-xs text-mine-400">{t("landManagement.casesHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setCaseModal("create")}>{t("landManagement.newCase")}</button>}
        </div>
        <DataTable
          columns={caseColumns}
          rows={cases}
          rowKey={(c) => c.id}
          emptyMessage={t("landManagement.noCasesYet")}
          searchValue={(c) => c.householdName}
          exportFilename="resettlement-cases"
          exportColumns={[
            { header: t("landManagement.householdName"), value: (c) => c.householdName },
            { header: t("common.status"), value: (c) => c.status },
          ]}
          actions={(c) => (
            <div className="flex justify-end gap-2">
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setCaseModal(c)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => removeCase(c.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {agreementModal && (
        <Modal title={agreementModal === "create" ? t("landManagement.newAgreementTitle") : t("landManagement.editAgreementTitle")} onClose={() => setAgreementModal(null)}>
          <AgreementForm
            sites={sites}
            initial={agreementModal === "create" ? undefined : agreementModal}
            onSubmit={(data) => (agreementModal === "create" ? createAgreement(data) : updateAgreement(agreementModal.id, data))}
            onCancel={() => setAgreementModal(null)}
          />
        </Modal>
      )}

      {caseModal && (
        <Modal title={caseModal === "create" ? t("landManagement.newCaseTitle") : t("landManagement.editCaseTitle")} onClose={() => setCaseModal(null)}>
          <ResettlementForm
            agreements={agreements}
            initial={caseModal === "create" ? undefined : caseModal}
            onSubmit={(data) => (caseModal === "create" ? createCase(data) : updateCase(caseModal.id, data))}
            onCancel={() => setCaseModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
