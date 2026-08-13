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
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";

const disciplinaryOutcomes: DisciplinaryOutcome[] = ["PENDING", "VERBAL_WARNING", "WRITTEN_WARNING", "FINAL_WRITTEN_WARNING", "DISMISSAL", "NOT_GUILTY", "WITHDRAWN"];
const disciplinaryStatuses: DisciplinaryStatus[] = ["OPEN", "SCHEDULED", "CONCLUDED", "APPEALED"];
const grievanceStatuses: GrievanceStatus[] = ["OPEN", "UNDER_INVESTIGATION", "RESOLVED", "ESCALATED", "WITHDRAWN"];
const ccmaTypes: CcmaCaseType[] = ["UNFAIR_DISMISSAL", "UNFAIR_LABOUR_PRACTICE", "DISCRIMINATION", "WAGE_DISPUTE", "OTHER"];
const ccmaStatuses: CcmaCaseStatus[] = ["REFERRED", "CONCILIATION", "ARBITRATION", "SETTLED", "AWARD_ISSUED", "WITHDRAWN"];
const unionStatuses: UnionAgreementStatus[] = ["ACTIVE", "EXPIRED", "UNDER_NEGOTIATION"];

function DisciplinaryForm({ workers, onSubmit, onCancel }: { workers: Worker[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [chargeDescription, setChargeDescription] = useState("");
  const [hearingDate, setHearingDate] = useState("");
  const [chairperson, setChairperson] = useState("");
  const [outcome, setOutcome] = useState<DisciplinaryOutcome>("PENDING");
  const [status, setStatus] = useState<DisciplinaryStatus>("OPEN");
  const [sanctionDetails, setSanctionDetails] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        workerId, chargeDescription, hearingDate: hearingDate || null, chairperson: chairperson || undefined,
        outcome, status, sanctionDetails: sanctionDetails || undefined,
      });
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
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function DisciplinaryTab({ workers, canEdit, canDelete }: { workers: Worker[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [cases, setCases] = useState<DisciplinaryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<DisciplinaryCase[]>("/labour-relations/disciplinary");
    setCases(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/labour-relations/disciplinary", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/labour-relations/disciplinary/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("labourRelations.newDisciplinaryCase")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("workers.title")}</th>
              <th className="text-left px-4 py-2">{t("labourRelations.chargeDescription")}</th>
              <th className="text-left px-4 py-2">{t("labourRelations.outcome")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{c.worker?.name}</td>
                <td className="px-4 py-2 text-mine-300">{c.chargeDescription}</td>
                <td className="px-4 py-2 text-mine-300">{t(`labourRelations.disciplinaryOutcomes.${c.outcome}`)}</td>
                <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(c.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {cases.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("labourRelations.noDisciplinaryCases")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("labourRelations.newDisciplinaryCaseTitle")} onClose={() => setModal(false)}>
          <DisciplinaryForm workers={workers} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function GrievanceForm({ workers, onSubmit, onCancel }: { workers: Worker[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [raisedAgainst, setRaisedAgainst] = useState("");
  const [description, setDescription] = useState("");
  const [dateRaised, setDateRaised] = useState("");
  const [status, setStatus] = useState<GrievanceStatus>("OPEN");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ workerId, raisedAgainst: raisedAgainst || undefined, description, dateRaised, status });
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
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function GrievancesTab({ workers, canEdit, canDelete }: { workers: Worker[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [cases, setCases] = useState<GrievanceCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<GrievanceCase[]>("/labour-relations/grievances");
    setCases(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/labour-relations/grievances", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/labour-relations/grievances/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("labourRelations.newGrievance")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("labourRelations.raisedBy")}</th>
              <th className="text-left px-4 py-2">{t("common.description")}</th>
              <th className="text-left px-4 py-2">{t("labourRelations.dateRaised")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{c.worker?.name}</td>
                <td className="px-4 py-2 text-mine-300">{c.description}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(c.dateRaised).toLocaleDateString()}</td>
                <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(c.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {cases.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("labourRelations.noGrievances")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("labourRelations.newGrievanceTitle")} onClose={() => setModal(false)}>
          <GrievanceForm workers={workers} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function CcmaForm({ workers, onSubmit, onCancel }: { workers: Worker[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState("");
  const [referralNumber, setReferralNumber] = useState("");
  const [caseType, setCaseType] = useState<CcmaCaseType>("UNFAIR_DISMISSAL");
  const [conciliationDate, setConciliationDate] = useState("");
  const [status, setStatus] = useState<CcmaCaseStatus>("REFERRED");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ workerId: workerId || null, referralNumber: referralNumber || undefined, caseType, conciliationDate: conciliationDate || null, status });
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
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as CcmaCaseStatus)}>
            {ccmaStatuses.map((s) => <option key={s} value={s}>{t(`labourRelations.ccmaCaseStatuses.${s}`)}</option>)}
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

function CcmaTab({ workers, canEdit, canDelete }: { workers: Worker[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [cases, setCases] = useState<CcmaCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<CcmaCase[]>("/labour-relations/ccma-cases");
    setCases(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/labour-relations/ccma-cases", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/labour-relations/ccma-cases/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("labourRelations.newCcmaCase")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("labourRelations.referralNumber")}</th>
              <th className="text-left px-4 py-2">{t("workers.title")}</th>
              <th className="text-left px-4 py-2">{t("labourRelations.caseType")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{c.referralNumber ?? "—"}</td>
                <td className="px-4 py-2 text-mine-300">{c.worker?.name ?? "—"}</td>
                <td className="px-4 py-2 text-mine-300">{t(`labourRelations.ccmaCaseTypes.${c.caseType}`)}</td>
                <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(c.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {cases.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("labourRelations.noCcmaCases")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("labourRelations.newCcmaCaseTitle")} onClose={() => setModal(false)}>
          <CcmaForm workers={workers} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function UnionAgreementForm({ onSubmit, onCancel }: { onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [unionName, setUnionName] = useState("");
  const [membershipCount, setMembershipCount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [status, setStatus] = useState<UnionAgreementStatus>("ACTIVE");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ unionName, membershipCount: membershipCount ? Number(membershipCount) : null, effectiveDate, expiryDate: expiryDate || null, status });
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
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<UnionAgreement[]>("/labour-relations/union-agreements");
    setAgreements(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/labour-relations/union-agreements", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/labour-relations/union-agreements/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("labourRelations.newUnionAgreement")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("labourRelations.unionName")}</th>
              <th className="text-left px-4 py-2">{t("labourRelations.membershipCount")}</th>
              <th className="text-left px-4 py-2">{t("common.startDate")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {agreements.map((a) => (
              <tr key={a.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{a.unionName}</td>
                <td className="px-4 py-2 text-mine-300">{a.membershipCount ?? "—"}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(a.effectiveDate).toLocaleDateString()}</td>
                <td className="px-4 py-2"><StatusBadge status={a.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(a.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {agreements.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("labourRelations.noUnionAgreements")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("labourRelations.newUnionAgreementTitle")} onClose={() => setModal(false)}>
          <UnionAgreementForm onSubmit={create} onCancel={() => setModal(false)} />
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

  useEffect(() => {
    api.get<Worker[]>("/workers").then((res) => {
      setWorkers(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

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
