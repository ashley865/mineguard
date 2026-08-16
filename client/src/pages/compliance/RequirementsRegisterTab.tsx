import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ComplianceRequirement, RequirementFrequency, RequirementStatus, RiskLevel, Site } from "../../api/types";
import { StatusBadge, SeverityBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import LoadError from "../../components/LoadError";

const frequencies: RequirementFrequency[] = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY", "ONCE_OFF", "AD_HOC"];
const statuses: RequirementStatus[] = ["PENDING", "COMPLIANT", "NON_COMPLIANT", "IN_PROGRESS", "OVERDUE", "NOT_APPLICABLE"];
const riskLevels: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

interface ResponsiblePerson {
  id: string;
  name: string;
}

function RequirementForm({ sites, people, initial, onSubmit, onCancel }: {
  sites: Site[];
  people: ResponsiblePerson[];
  initial?: Partial<ComplianceRequirement>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [regulation, setRegulation] = useState(initial?.regulation ?? "");
  const [requirement, setRequirement] = useState(initial?.requirement ?? "");
  const [applicableOperation, setApplicableOperation] = useState(initial?.applicableOperation ?? "");
  const [responsibleDepartment, setResponsibleDepartment] = useState(initial?.responsibleDepartment ?? "");
  const [responsiblePersonId, setResponsiblePersonId] = useState(initial?.responsiblePersonId ?? "");
  const [frequency, setFrequency] = useState<RequirementFrequency>(initial?.frequency ?? "ANNUALLY");
  const [evidenceRequired, setEvidenceRequired] = useState(initial?.evidenceRequired ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<RequirementStatus>(initial?.status ?? "PENDING");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(initial?.riskLevel ?? "MEDIUM");
  const [lastVerification, setLastVerification] = useState(initial?.lastVerification?.slice(0, 10) ?? "");
  const [nextReview, setNextReview] = useState(initial?.nextReview?.slice(0, 10) ?? "");
  const [relatedDocuments, setRelatedDocuments] = useState(initial?.relatedDocuments ?? "");
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        regulation,
        requirement,
        applicableOperation,
        responsibleDepartment,
        responsiblePersonId: responsiblePersonId || null,
        frequency,
        evidenceRequired,
        dueDate,
        status,
        riskLevel,
        lastVerification: lastVerification || null,
        nextReview: nextReview || null,
        relatedDocuments: relatedDocuments || null,
        siteId,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("compliance.requirement.regulation")}</label>
        <input className={inputClass} value={regulation} onChange={(e) => setRegulation(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("compliance.requirement.requirement")}</label>
        <textarea className={inputClass} rows={2} value={requirement} onChange={(e) => setRequirement(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.requirement.applicableOperation")}</label>
          <input className={inputClass} value={applicableOperation} onChange={(e) => setApplicableOperation(e.target.value)} required />
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
          <label className={labelClass}>{t("compliance.requirement.responsibleDepartment")}</label>
          <input className={inputClass} value={responsibleDepartment} onChange={(e) => setResponsibleDepartment(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("compliance.requirement.responsiblePerson")}</label>
          <select className={selectClass} value={responsiblePersonId} onChange={(e) => setResponsiblePersonId(e.target.value)}>
            <option value="">{t("common.unassigned")}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.requirement.frequency")}</label>
          <select className={selectClass} value={frequency} onChange={(e) => setFrequency(e.target.value as RequirementFrequency)}>
            {frequencies.map((f) => <option key={f} value={f}>{t(`compliance.requirement.frequencies.${f}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as RequirementStatus)}>
            {statuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("compliance.requirement.riskLevel")}</label>
          <select className={selectClass} value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}>
            {riskLevels.map((r) => <option key={r} value={r}>{t(`badges.severity.${r}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("compliance.requirement.evidenceRequired")}</label>
        <textarea className={inputClass} rows={2} value={evidenceRequired} onChange={(e) => setEvidenceRequired(e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.requirement.dueDate")}</label>
          <DateField value={dueDate} onChange={setDueDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("compliance.requirement.lastVerification")}</label>
          <DateField value={lastVerification} onChange={setLastVerification} />
        </div>
        <div>
          <label className={labelClass}>{t("compliance.requirement.nextReview")}</label>
          <DateField value={nextReview} onChange={setNextReview} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("compliance.requirement.relatedDocuments")}</label>
        <input className={inputClass} value={relatedDocuments} onChange={(e) => setRelatedDocuments(e.target.value)} placeholder={t("compliance.requirement.relatedDocumentsPlaceholder") ?? ""} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function RequirementsRegisterTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<ComplianceRequirement[]>([]);
  const [people, setPeople] = useState<ResponsiblePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | ComplianceRequirement>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [reqs, ppl] = await Promise.all([
        api.get<ComplianceRequirement[]>("/compliance-requirements"),
        api.get<ResponsiblePerson[]>("/compliance-requirements/responsible-people"),
      ]);
      setItems(reqs.data);
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
    await api.post("/compliance-requirements", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/compliance-requirements/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("compliance.requirement.confirmDelete"))) return;
    await api.delete(`/compliance-requirements/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("compliance.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      <p className="text-mine-300 text-sm">{t("compliance.requirement.subtitle")}</p>

      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("compliance.requirement.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("compliance.requirement.colRegulation")}</th>
              <th className="text-left px-4 py-2">{t("compliance.requirement.colOperation")}</th>
              <th className="text-left px-4 py-2">{t("compliance.requirement.colResponsible")}</th>
              <th className="text-left px-4 py-2">{t("compliance.requirement.dueDate")}</th>
              <th className="text-left px-4 py-2">{t("compliance.requirement.riskLevel")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{item.regulation}</td>
                <td className="px-4 py-2 text-mine-300">{item.applicableOperation}</td>
                <td className="px-4 py-2 text-mine-300">
                  {item.responsiblePerson?.name ?? t("common.unassigned")}
                  <div className="text-[10px] text-mine-400">{item.responsibleDepartment}</div>
                </td>
                <td className="px-4 py-2 text-mine-300">{new Date(item.dueDate).toLocaleDateString()}</td>
                <td className="px-4 py-2"><SeverityBadge severity={item.riskLevel} /></td>
                <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(item)}>{t("common.edit")}</button>
                      <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-mine-400">{t("compliance.requirement.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("compliance.requirement.newTitle") : t("compliance.requirement.editTitle")} onClose={() => setModal(null)} size="lg">
          <RequirementForm
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
