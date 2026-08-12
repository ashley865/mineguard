import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Learnership, LearnershipStatus, Worker, WorkplaceSkillsPlan } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";

const learnershipStatuses: LearnershipStatus[] = ["APPLIED", "ENROLLED", "IN_PROGRESS", "COMPLETED", "WITHDRAWN"];

function WspForm({ onSubmit, onCancel }: { onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [planYear, setPlanYear] = useState(new Date().getFullYear().toString());
  const [setaName, setSetaName] = useState("MQA");
  const [levyPayable, setLevyPayable] = useState("");
  const [levyGrantClaimed, setLevyGrantClaimed] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        planYear: Number(planYear),
        setaName,
        levyPayable: levyPayable ? Number(levyPayable) : null,
        levyGrantClaimed: levyGrantClaimed ? Number(levyGrantClaimed) : null,
        status,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("skillsDevelopment.planYear")}</label>
          <input className={inputClass} type="number" value={planYear} onChange={(e) => setPlanYear(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("skillsDevelopment.setaName")}</label>
          <input className={inputClass} value={setaName} onChange={(e) => setSetaName(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("skillsDevelopment.levyPayable")}</label>
          <input className={inputClass} type="number" step="any" value={levyPayable} onChange={(e) => setLevyPayable(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("skillsDevelopment.levyGrantClaimed")}</label>
          <input className={inputClass} type="number" step="any" value={levyGrantClaimed} onChange={(e) => setLevyGrantClaimed(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="DRAFT">{t("skillsDevelopment.wspStatuses.DRAFT")}</option>
          <option value="SUBMITTED">{t("skillsDevelopment.wspStatuses.SUBMITTED")}</option>
          <option value="APPROVED">{t("skillsDevelopment.wspStatuses.APPROVED")}</option>
          <option value="GRANT_PAID">{t("skillsDevelopment.wspStatuses.GRANT_PAID")}</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function LearnershipForm({ workers, onSubmit, onCancel }: { workers: Worker[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState("");
  const [learnerName, setLearnerName] = useState("");
  const [programme, setProgramme] = useState("");
  const [provider, setProvider] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<LearnershipStatus>("APPLIED");
  const [fundingSource, setFundingSource] = useState("");
  const [saving, setSaving] = useState(false);

  function pickWorker(id: string) {
    setWorkerId(id);
    const w = workers.find((wk) => wk.id === id);
    if (w) setLearnerName(w.name);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        workerId: workerId || null,
        learnerName,
        programme,
        provider: provider || undefined,
        startDate,
        endDate: endDate || null,
        status,
        fundingSource: fundingSource || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("skillsDevelopment.linkedWorker")}</label>
          <select className={selectClass} value={workerId} onChange={(e) => pickWorker(e.target.value)}>
            <option value="">{t("skillsDevelopment.externalLearner")}</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({t(`workers.categories.${w.category}`)})</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("skillsDevelopment.learnerName")}</label>
          <input className={inputClass} value={learnerName} onChange={(e) => setLearnerName(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("skillsDevelopment.programme")}</label>
          <input className={inputClass} value={programme} onChange={(e) => setProgramme(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("skillsDevelopment.provider")}</label>
          <input className={inputClass} value={provider} onChange={(e) => setProvider(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.startDate")}</label>
          <DateField value={startDate} onChange={setStartDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.endDate")}</label>
          <DateField value={endDate} onChange={setEndDate} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as LearnershipStatus)}>
            {learnershipStatuses.map((s) => <option key={s} value={s}>{t(`skillsDevelopment.learnershipStatuses.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("skillsDevelopment.fundingSource")}</label>
          <input className={inputClass} value={fundingSource} onChange={(e) => setFundingSource(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function SkillsDevelopmentTab({ workers }: { workers: Worker[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [plans, setPlans] = useState<WorkplaceSkillsPlan[]>([]);
  const [learnerships, setLearnerships] = useState<Learnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [wspModal, setWspModal] = useState(false);
  const [learnershipModal, setLearnershipModal] = useState(false);

  async function load() {
    setLoading(true);
    const [p, l] = await Promise.all([
      api.get<WorkplaceSkillsPlan[]>("/skills-development/wsp"),
      api.get<Learnership[]>("/skills-development/learnerships"),
    ]);
    setPlans(p.data);
    setLearnerships(l.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createWsp(data: any) {
    await api.post("/skills-development/wsp", data);
    setWspModal(false);
    await load();
  }

  async function removeWsp(id: string) {
    await api.delete(`/skills-development/wsp/${id}`);
    await load();
  }

  async function createLearnership(data: any) {
    await api.post("/skills-development/learnerships", data);
    setLearnershipModal(false);
    await load();
  }

  async function removeLearnership(id: string) {
    await api.delete(`/skills-development/learnerships/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-mine-200">{t("skillsDevelopment.wspTitle")}</h2>
          {canEdit && <button className={buttonPrimary} onClick={() => setWspModal(true)}>{t("skillsDevelopment.newWsp")}</button>}
        </div>
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">{t("skillsDevelopment.planYear")}</th>
                <th className="text-left px-4 py-2">{t("skillsDevelopment.setaName")}</th>
                <th className="text-left px-4 py-2">{t("skillsDevelopment.levyPayable")}</th>
                <th className="text-left px-4 py-2">{t("skillsDevelopment.levyGrantClaimed")}</th>
                <th className="text-left px-4 py-2">{t("common.status")}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                  <td className="px-4 py-2 font-medium">{p.planYear}</td>
                  <td className="px-4 py-2 text-mine-300">{p.setaName}</td>
                  <td className="px-4 py-2 text-mine-300">{p.levyPayable ?? "—"}</td>
                  <td className="px-4 py-2 text-mine-300">{p.levyGrantClaimed ?? "—"}</td>
                  <td className="px-4 py-2 text-mine-300">{t(`skillsDevelopment.wspStatuses.${p.status}`)}</td>
                  <td className="px-4 py-2 text-right">
                    {canDelete && <button className={buttonDanger} onClick={() => removeWsp(p.id)}>{t("common.delete")}</button>}
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("skillsDevelopment.noWsp")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-mine-200">{t("skillsDevelopment.learnershipsTitle")}</h2>
          {canEdit && <button className={buttonPrimary} onClick={() => setLearnershipModal(true)}>{t("skillsDevelopment.newLearnership")}</button>}
        </div>
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">{t("skillsDevelopment.learnerName")}</th>
                <th className="text-left px-4 py-2">{t("skillsDevelopment.programme")}</th>
                <th className="text-left px-4 py-2">{t("common.startDate")}</th>
                <th className="text-left px-4 py-2">{t("common.status")}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {learnerships.map((l) => (
                <tr key={l.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                  <td className="px-4 py-2 font-medium">{l.learnerName}</td>
                  <td className="px-4 py-2 text-mine-300">{l.programme}</td>
                  <td className="px-4 py-2 text-mine-300">{new Date(l.startDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2"><StatusBadge status={l.status} /></td>
                  <td className="px-4 py-2 text-right">
                    {canDelete && <button className={buttonDanger} onClick={() => removeLearnership(l.id)}>{t("common.delete")}</button>}
                  </td>
                </tr>
              ))}
              {learnerships.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("skillsDevelopment.noLearnerships")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {wspModal && (
        <Modal title={t("skillsDevelopment.newWspTitle")} onClose={() => setWspModal(false)}>
          <WspForm onSubmit={createWsp} onCancel={() => setWspModal(false)} />
        </Modal>
      )}
      {learnershipModal && (
        <Modal title={t("skillsDevelopment.newLearnershipTitle")} onClose={() => setLearnershipModal(false)}>
          <LearnershipForm workers={workers} onSubmit={createLearnership} onCancel={() => setLearnershipModal(false)} />
        </Modal>
      )}
    </div>
  );
}
