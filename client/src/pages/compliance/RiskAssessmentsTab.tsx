import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { RiskAssessment, RiskAssessmentStatus, RiskLevel, Site, Zone } from "../../api/types";
import { SeverityBadge, StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../../components/ui";

const riskLevels: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statuses: RiskAssessmentStatus[] = ["DRAFT", "APPROVED", "UNDER_REVIEW", "EXPIRED"];

function RiskForm({ sites, zones, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  initial?: Partial<RiskAssessment>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [hazard, setHazard] = useState(initial?.hazard ?? "");
  const [initialRiskLevel, setInitialRiskLevel] = useState<RiskLevel>(initial?.initialRiskLevel ?? "MEDIUM");
  const [residualRiskLevel, setResidualRiskLevel] = useState<RiskLevel>(initial?.residualRiskLevel ?? "LOW");
  const [controlMeasures, setControlMeasures] = useState(initial?.controlMeasures ?? "");
  const [assessor, setAssessor] = useState(initial?.assessor ?? "");
  const [status, setStatus] = useState<RiskAssessmentStatus>(initial?.status ?? "DRAFT");
  const [assessmentDate, setAssessmentDate] = useState(initial?.assessmentDate?.slice(0, 10) ?? "");
  const [reviewDate, setReviewDate] = useState(initial?.reviewDate?.slice(0, 10) ?? "");
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [saving, setSaving] = useState(false);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        title,
        hazard,
        initialRiskLevel,
        residualRiskLevel,
        controlMeasures,
        assessor,
        status,
        assessmentDate,
        reviewDate,
        siteId,
        zoneId: zoneId || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("compliance.risk.titleField")}</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("compliance.risk.hazard")}</label>
        <input className={inputClass} value={hazard} onChange={(e) => setHazard(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.risk.initialRisk")}</label>
          <select className={inputClass} value={initialRiskLevel} onChange={(e) => setInitialRiskLevel(e.target.value as RiskLevel)}>
            {riskLevels.map((r) => <option key={r} value={r}>{t(`badges.severity.${r}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("compliance.risk.residualRisk")}</label>
          <select className={inputClass} value={residualRiskLevel} onChange={(e) => setResidualRiskLevel(e.target.value as RiskLevel)}>
            {riskLevels.map((r) => <option key={r} value={r}>{t(`badges.severity.${r}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("compliance.risk.controlMeasures")}</label>
        <textarea className={inputClass} value={controlMeasures} onChange={(e) => setControlMeasures(e.target.value)} rows={2} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.risk.assessor")}</label>
          <input className={inputClass} value={assessor} onChange={(e) => setAssessor(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as RiskAssessmentStatus)}>
            {statuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.risk.assessmentDate")}</label>
          <input className={inputClass} type="date" value={assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("compliance.risk.reviewDate")}</label>
          <input className={inputClass} type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={inputClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={inputClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">{t("common.unassigned")}</option>
            {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function RiskAssessmentsTab({ sites, zones }: { sites: Site[]; zones: Zone[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | RiskAssessment>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<RiskAssessment[]>("/risk-assessments");
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/risk-assessments", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/risk-assessments/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("compliance.risk.confirmDelete"))) return;
    await api.delete(`/risk-assessments/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("compliance.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("compliance.risk.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("compliance.risk.colTitle")}</th>
              <th className="text-left px-4 py-2">{t("compliance.risk.colHazard")}</th>
              <th className="text-left px-4 py-2">{t("compliance.risk.colInitial")}</th>
              <th className="text-left px-4 py-2">{t("compliance.risk.colResidual")}</th>
              <th className="text-left px-4 py-2">{t("compliance.risk.colStatus")}</th>
              <th className="text-left px-4 py-2">{t("compliance.risk.colReviewDate")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{item.title}</td>
                <td className="px-4 py-2 text-mine-300">{item.hazard}</td>
                <td className="px-4 py-2"><SeverityBadge severity={item.initialRiskLevel} /></td>
                <td className="px-4 py-2"><SeverityBadge severity={item.residualRiskLevel} /></td>
                <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-2 text-mine-300">{new Date(item.reviewDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-white" onClick={() => setModal(item)}>{t("common.edit")}</button>
                      <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-mine-400">{t("compliance.risk.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("compliance.risk.newTitle") : t("compliance.risk.editTitle")} onClose={() => setModal(null)}>
          <RiskForm
            sites={sites}
            zones={zones}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
