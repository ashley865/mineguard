import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  BaSetStatus,
  BreathingApparatusSet,
  MutualAidAgreement,
  RescueCallout,
  RescueDrill,
  RescueDrillResult,
  RescueTeamMember,
  RescueTeamRole,
  Site,
  Worker,
} from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";

const teamRoles: RescueTeamRole[] = ["TEAM_LEADER", "MEMBER"];
const baStatuses: BaSetStatus[] = ["SERVICEABLE", "OUT_OF_SERVICE", "DUE_FOR_SERVICE"];
const drillResults: RescueDrillResult[] = ["PASS", "FAIL", "PARTIAL"];

function TeamMemberForm({ sites, workers, onSubmit, onCancel }: { sites: Site[]; workers: Worker[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [role, setRole] = useState<RescueTeamRole>("MEMBER");
  const [certificationNumber, setCertificationNumber] = useState("");
  const [certificationExpiry, setCertificationExpiry] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ siteId, workerId, role, certificationNumber: certificationNumber || undefined, certificationExpiry: certificationExpiry || null });
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
          <label className={labelClass}>{t("workers.title")}</label>
          <select className={selectClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("mineRescue.role")}</label>
          <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value as RescueTeamRole)}>
            {teamRoles.map((r) => <option key={r} value={r}>{t(`mineRescue.roles.${r}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("mineRescue.certificationNumber")}</label>
          <input className={inputClass} value={certificationNumber} onChange={(e) => setCertificationNumber(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("mineRescue.certificationExpiry")}</label>
        <DateField value={certificationExpiry} onChange={setCertificationExpiry} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function TeamTab({ sites, workers, canEdit, canDelete }: { sites: Site[]; workers: Worker[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<RescueTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<RescueTeamMember[]>("/mine-rescue/team-members");
    setMembers(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/mine-rescue/team-members", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/mine-rescue/team-members/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("mineRescue.newTeamMember")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("workers.title")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("mineRescue.role")}</th>
              <th className="text-left px-4 py-2">{t("mineRescue.certificationExpiry")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{m.worker?.name}</td>
                <td className="px-4 py-2 text-mine-300">{m.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{t(`mineRescue.roles.${m.role}`)}</td>
                <td className="px-4 py-2 text-mine-300">{m.certificationExpiry ? new Date(m.certificationExpiry).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-2"><StatusBadge status={m.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(m.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {members.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("mineRescue.noTeamMembers")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("mineRescue.newTeamMemberTitle")} onClose={() => setModal(false)}>
          <TeamMemberForm sites={sites} workers={workers} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function BaSetForm({ sites, onSubmit, onCancel }: { sites: Site[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [setNumber, setSetNumber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [nextServiceDue, setNextServiceDue] = useState("");
  const [nextPressureTestDue, setNextPressureTestDue] = useState("");
  const [status, setStatus] = useState<BaSetStatus>("SERVICEABLE");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId, setNumber, manufacturer: manufacturer || undefined,
        nextServiceDue: nextServiceDue || null, nextPressureTestDue: nextPressureTestDue || null, status,
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
          <label className={labelClass}>{t("mineRescue.setNumber")}</label>
          <input className={inputClass} value={setNumber} onChange={(e) => setSetNumber(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("mineRescue.manufacturer")}</label>
        <input className={inputClass} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("mineRescue.nextServiceDue")}</label>
          <DateField value={nextServiceDue} onChange={setNextServiceDue} />
        </div>
        <div>
          <label className={labelClass}>{t("mineRescue.nextPressureTestDue")}</label>
          <DateField value={nextPressureTestDue} onChange={setNextPressureTestDue} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as BaSetStatus)}>
          {baStatuses.map((s) => <option key={s} value={s}>{t(`mineRescue.baStatuses.${s}`)}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function BaSetsTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [sets, setSets] = useState<BreathingApparatusSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<BreathingApparatusSet[]>("/mine-rescue/ba-sets");
    setSets(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/mine-rescue/ba-sets", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/mine-rescue/ba-sets/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("mineRescue.newBaSet")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("mineRescue.setNumber")}</th>
              <th className="text-left px-4 py-2">{t("mineRescue.nextServiceDue")}</th>
              <th className="text-left px-4 py-2">{t("mineRescue.nextPressureTestDue")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sets.map((s) => (
              <tr key={s.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{s.setNumber}</td>
                <td className="px-4 py-2 text-mine-300">{s.nextServiceDue ? new Date(s.nextServiceDue).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-2 text-mine-300">{s.nextPressureTestDue ? new Date(s.nextPressureTestDue).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(s.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {sets.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("mineRescue.noBaSets")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("mineRescue.newBaSetTitle")} onClose={() => setModal(false)}>
          <BaSetForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function DrillForm({ sites, onSubmit, onCancel }: { sites: Site[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [drillDate, setDrillDate] = useState("");
  const [scenario, setScenario] = useState("");
  const [result, setResult] = useState<RescueDrillResult>("PASS");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ siteId, drillDate, scenario, result, durationMinutes: durationMinutes ? Number(durationMinutes) : null });
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
          <label className={labelClass}>{t("mineRescue.drillDate")}</label>
          <DateField value={drillDate} onChange={setDrillDate} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("mineRescue.scenario")}</label>
        <textarea className={inputClass} rows={2} value={scenario} onChange={(e) => setScenario(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("mineRescue.result")}</label>
          <select className={selectClass} value={result} onChange={(e) => setResult(e.target.value as RescueDrillResult)}>
            {drillResults.map((r) => <option key={r} value={r}>{t(`badges.status.${r}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("mineRescue.durationMinutes")}</label>
          <input className={inputClass} type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function DrillsTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [drills, setDrills] = useState<RescueDrill[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<RescueDrill[]>("/mine-rescue/drills");
    setDrills(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/mine-rescue/drills", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/mine-rescue/drills/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("mineRescue.newDrill")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("mineRescue.drillDate")}</th>
              <th className="text-left px-4 py-2">{t("mineRescue.scenario")}</th>
              <th className="text-left px-4 py-2">{t("mineRescue.result")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {drills.map((d) => (
              <tr key={d.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{new Date(d.drillDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{d.scenario}</td>
                <td className="px-4 py-2"><StatusBadge status={d.result} /></td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(d.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {drills.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-mine-400">{t("mineRescue.noDrills")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("mineRescue.newDrillTitle")} onClose={() => setModal(false)}>
          <DrillForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function MutualAidTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [agreements, setAgreements] = useState<MutualAidAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [partnerOrganization, setPartnerOrganization] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<MutualAidAgreement[]>("/mine-rescue/mutual-aid");
    setAgreements(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/mine-rescue/mutual-aid", { siteId, partnerOrganization, effectiveDate, expiryDate: expiryDate || null, contactName: contactName || undefined, contactPhone: contactPhone || undefined });
      setModal(false);
      setPartnerOrganization("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`/mine-rescue/mutual-aid/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("mineRescue.newMutualAid")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("mineRescue.partnerOrganization")}</th>
              <th className="text-left px-4 py-2">{t("common.startDate")}</th>
              <th className="text-left px-4 py-2">{t("mineRescue.contactName")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {agreements.map((a) => (
              <tr key={a.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{a.partnerOrganization}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(a.effectiveDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{a.contactName ?? "—"} {a.contactPhone ? `(${a.contactPhone})` : ""}</td>
                <td className="px-4 py-2"><StatusBadge status={a.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(a.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {agreements.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("mineRescue.noMutualAid")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("mineRescue.newMutualAidTitle")} onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>{t("common.site")}</label>
              <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("mineRescue.partnerOrganization")}</label>
              <input className={inputClass} value={partnerOrganization} onChange={(e) => setPartnerOrganization(e.target.value)} required />
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("mineRescue.contactName")}</label>
                <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>{t("mineRescue.contactPhone")}</label>
                <input className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={buttonSecondary} onClick={() => setModal(false)}>{t("common.cancel")}</button>
              <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function CalloutsTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [callouts, setCallouts] = useState<RescueCallout[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [calloutTime, setCalloutTime] = useState("");
  const [teamDispatched, setTeamDispatched] = useState("");
  const [outcome, setOutcome] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<RescueCallout[]>("/mine-rescue/callouts");
    setCallouts(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/mine-rescue/callouts", { siteId, calloutTime, teamDispatched: teamDispatched || undefined, outcome: outcome || undefined });
      setModal(false);
      setTeamDispatched("");
      setOutcome("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`/mine-rescue/callouts/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("mineRescue.newCallout")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("mineRescue.calloutTime")}</th>
              <th className="text-left px-4 py-2">{t("mineRescue.teamDispatched")}</th>
              <th className="text-left px-4 py-2">{t("mineRescue.outcome")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {callouts.map((c) => (
              <tr key={c.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{new Date(c.calloutTime).toLocaleString()}</td>
                <td className="px-4 py-2 text-mine-300">{c.teamDispatched ?? "—"}</td>
                <td className="px-4 py-2 text-mine-300">{c.outcome ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(c.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {callouts.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-mine-400">{t("mineRescue.noCallouts")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("mineRescue.newCalloutTitle")} onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>{t("common.site")}</label>
              <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("mineRescue.calloutTime")}</label>
              <input className={inputClass} type="datetime-local" value={calloutTime} onChange={(e) => setCalloutTime(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t("mineRescue.teamDispatched")}</label>
              <input className={inputClass} value={teamDispatched} onChange={(e) => setTeamDispatched(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("mineRescue.outcome")}</label>
              <textarea className={inputClass} rows={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={buttonSecondary} onClick={() => setModal(false)}>{t("common.cancel")}</button>
              <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function MineRescue() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"team" | "ba" | "drills" | "mutualAid" | "callouts">("team");
  const [sites, setSites] = useState<Site[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get<Site[]>("/sites"), api.get<Worker[]>("/workers")]).then(([s, w]) => {
      setSites(s.data);
      setWorkers(w.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("mineRescue.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("mineRescue.subtitle")}</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className={tab === "team" ? buttonPrimary : buttonSecondary} onClick={() => setTab("team")}>{t("mineRescue.tabTeam")}</button>
        <button className={tab === "ba" ? buttonPrimary : buttonSecondary} onClick={() => setTab("ba")}>{t("mineRescue.tabBa")}</button>
        <button className={tab === "drills" ? buttonPrimary : buttonSecondary} onClick={() => setTab("drills")}>{t("mineRescue.tabDrills")}</button>
        <button className={tab === "mutualAid" ? buttonPrimary : buttonSecondary} onClick={() => setTab("mutualAid")}>{t("mineRescue.tabMutualAid")}</button>
        <button className={tab === "callouts" ? buttonPrimary : buttonSecondary} onClick={() => setTab("callouts")}>{t("mineRescue.tabCallouts")}</button>
      </div>
      {tab === "team" && <TeamTab sites={sites} workers={workers} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "ba" && <BaSetsTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "drills" && <DrillsTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "mutualAid" && <MutualAidTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "callouts" && <CalloutsTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
    </div>
  );
}
