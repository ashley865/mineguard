import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ClosureRehabilitationPlan, RehabilitationStatus, Site } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";

const rehabStatuses: RehabilitationStatus[] = ["PLANNED", "IN_PROGRESS", "COMPLETED", "VERIFIED"];

function PlanForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: ClosureRehabilitationPlan;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [planReferenceNumber, setPlanReferenceNumber] = useState(initial?.planReferenceNumber ?? "");
  const [financialProvisionAmount, setFinancialProvisionAmount] = useState(initial?.financialProvisionAmount?.toString() ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "ZAR");
  const [guaranteeInstrument, setGuaranteeInstrument] = useState(initial?.guaranteeInstrument ?? "");
  const [nextAssessmentDue, setNextAssessmentDue] = useState(initial?.nextAssessmentDue?.slice(0, 10) ?? "");
  const [targetClosureDate, setTargetClosureDate] = useState(initial?.targetClosureDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<RehabilitationStatus>(initial?.status ?? "PLANNED");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        planReferenceNumber: planReferenceNumber || undefined,
        financialProvisionAmount: financialProvisionAmount ? Number(financialProvisionAmount) : null,
        currency,
        guaranteeInstrument: guaranteeInstrument || undefined,
        nextAssessmentDue: nextAssessmentDue || null,
        targetClosureDate: targetClosureDate || null,
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
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("closureRehabilitation.planReferenceNumber")}</label>
          <input className={inputClass} value={planReferenceNumber} onChange={(e) => setPlanReferenceNumber(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("closureRehabilitation.financialProvisionAmount")}</label>
          <input className={inputClass} type="number" step="any" value={financialProvisionAmount} onChange={(e) => setFinancialProvisionAmount(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("marketplace.currency")}</label>
          <input className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as RehabilitationStatus)}>
            {rehabStatuses.map((s) => <option key={s} value={s}>{t(`closureRehabilitation.statuses.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("closureRehabilitation.guaranteeInstrument")}</label>
        <input className={inputClass} value={guaranteeInstrument} onChange={(e) => setGuaranteeInstrument(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("closureRehabilitation.nextAssessmentDue")}</label>
          <DateField value={nextAssessmentDue} onChange={setNextAssessmentDue} />
        </div>
        <div>
          <label className={labelClass}>{t("closureRehabilitation.targetClosureDate")}</label>
          <DateField value={targetClosureDate} onChange={setTargetClosureDate} />
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

function ProgressModal({ plan, onClose, onChanged }: { plan: ClosureRehabilitationPlan; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [hectaresRehabilitated, setHectaresRehabilitated] = useState("");
  const [percentComplete, setPercentComplete] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/closure-rehabilitation/${plan.id}/progress`, {
        hectaresRehabilitated: hectaresRehabilitated ? Number(hectaresRehabilitated) : null,
        percentComplete: percentComplete ? Number(percentComplete) : null,
        description,
      });
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t("closureRehabilitation.progressFor", { ref: plan.planReferenceNumber ?? plan.site?.name })} onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {(plan.progressUpdates ?? []).map((p) => (
            <div key={p.id} className="text-xs border-t border-mine-800 pt-1.5">
              <span className="text-mine-500">{new Date(p.updateDate).toLocaleDateString()}</span> — {p.description}
              {p.percentComplete != null && <span className="text-mine-300"> ({p.percentComplete}%)</span>}
            </div>
          ))}
          {(plan.progressUpdates ?? []).length === 0 && <div className="text-mine-400 text-sm">{t("closureRehabilitation.noProgress")}</div>}
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-mine-800 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("closureRehabilitation.hectaresRehabilitated")}</label>
              <input className={inputClass} type="number" step="any" value={hectaresRehabilitated} onChange={(e) => setHectaresRehabilitated(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("closureRehabilitation.percentComplete")}</label>
              <input className={inputClass} type="number" min={0} max={100} value={percentComplete} onChange={(e) => setPercentComplete(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("common.description")}</label>
            <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
        </form>
      </div>
    </Modal>
  );
}

export default function ClosureRehabilitationTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [plans, setPlans] = useState<ClosureRehabilitationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | ClosureRehabilitationPlan>(null);
  const [progressPlan, setProgressPlan] = useState<ClosureRehabilitationPlan | null>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<ClosureRehabilitationPlan[]>("/closure-rehabilitation");
    setPlans(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/closure-rehabilitation", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/closure-rehabilitation/${id}`, data);
    setModal(null);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("closureRehabilitation.hint")}</p>
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("closureRehabilitation.newPlan")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("closureRehabilitation.financialProvisionAmount")}</th>
              <th className="text-left px-4 py-2">{t("closureRehabilitation.targetClosureDate")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{p.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{p.financialProvisionAmount != null ? `${p.currency} ${p.financialProvisionAmount.toLocaleString()}` : "—"}</td>
                <td className="px-4 py-2 text-mine-300">{p.targetClosureDate ? new Date(p.targetClosureDate).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setProgressPlan(p)}>{t("closureRehabilitation.progress")}</button>
                    {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(p)}>{t("common.edit")}</button>}
                  </div>
                </td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("closureRehabilitation.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("closureRehabilitation.newPlanTitle") : t("closureRehabilitation.editPlanTitle")} onClose={() => setModal(null)}>
          <PlanForm
            sites={sites}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {progressPlan && <ProgressModal plan={progressPlan} onClose={() => setProgressPlan(null)} onChanged={load} />}
    </div>
  );
}
