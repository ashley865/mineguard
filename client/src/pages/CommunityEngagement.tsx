import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  CommunityEngagement,
  CommunityEngagementType,
  CommunityGrievance,
  CommunityGrievanceStatus,
  CommunityProject,
  CommunityProjectStatus,
  CommunitySpendRecord,
  Site,
} from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";

const projectStatuses: CommunityProjectStatus[] = ["PLANNED", "IN_PROGRESS", "COMPLETED", "DELAYED", "CANCELLED"];
const engagementTypes: CommunityEngagementType[] = ["PUBLIC_MEETING", "FOCUS_GROUP", "FORUM", "SITE_VISIT", "SURVEY", "OTHER"];
const grievanceStatuses: CommunityGrievanceStatus[] = ["OPEN", "UNDER_INVESTIGATION", "RESOLVED", "ESCALATED", "WITHDRAWN"];

function ProjectForm({ sites, onSubmit, onCancel }: { sites: Site[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [budget, setBudget] = useState("");
  const [spentToDate, setSpentToDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetCompletionDate, setTargetCompletionDate] = useState("");
  const [status, setStatus] = useState<CommunityProjectStatus>("PLANNED");
  const [beneficiaries, setBeneficiaries] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId, name, category: category || undefined, budget: budget ? Number(budget) : null,
        spentToDate: spentToDate ? Number(spentToDate) : null, startDate: startDate || null,
        targetCompletionDate: targetCompletionDate || null, status, beneficiaries: beneficiaries || undefined,
        description: description || undefined,
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
          <label className={labelClass}>{t("community.projectName")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("community.category")}</label>
        <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("community.categoryPlaceholder") ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("community.budget")}</label>
          <input className={inputClass} type="number" step="any" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("community.spentToDate")}</label>
          <input className={inputClass} type="number" step="any" value={spentToDate} onChange={(e) => setSpentToDate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.startDate")}</label>
          <DateField value={startDate} onChange={setStartDate} />
        </div>
        <div>
          <label className={labelClass}>{t("community.targetCompletionDate")}</label>
          <DateField value={targetCompletionDate} onChange={setTargetCompletionDate} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as CommunityProjectStatus)}>
          {projectStatuses.map((s) => <option key={s} value={s}>{t(`community.projectStatuses.${s}`)}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("community.beneficiaries")}</label>
        <input className={inputClass} value={beneficiaries} onChange={(e) => setBeneficiaries(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function ProjectsTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<CommunityProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<CommunityProject[]>("/community/projects");
    setProjects(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/community/projects", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/community/projects/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("community.projectsHint")}</p>
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("community.newProject")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("community.projectName")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("community.budget")} / {t("community.spentToDate")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{p.name}</td>
                <td className="px-4 py-2 text-mine-300">{p.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{p.currency} {(p.budget ?? 0).toLocaleString()} / {(p.spentToDate ?? 0).toLocaleString()}</td>
                <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(p.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {projects.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("community.noProjects")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("community.newProjectTitle")} onClose={() => setModal(false)}>
          <ProjectForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function EngagementForm({ sites, onSubmit, onCancel }: { sites: Site[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [engagementType, setEngagementType] = useState<CommunityEngagementType>("PUBLIC_MEETING");
  const [engagementDate, setEngagementDate] = useState("");
  const [location, setLocation] = useState("");
  const [attendeesCount, setAttendeesCount] = useState("");
  const [topicsDiscussed, setTopicsDiscussed] = useState("");
  const [outcomes, setOutcomes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId, engagementType, engagementDate, location: location || undefined,
        attendeesCount: attendeesCount ? Number(attendeesCount) : null,
        topicsDiscussed: topicsDiscussed || undefined, outcomes: outcomes || undefined,
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
          <label className={labelClass}>{t("community.engagementType")}</label>
          <select className={selectClass} value={engagementType} onChange={(e) => setEngagementType(e.target.value as CommunityEngagementType)}>
            {engagementTypes.map((et) => <option key={et} value={et}>{t(`community.engagementTypes.${et}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("community.engagementDate")}</label>
          <DateField value={engagementDate} onChange={setEngagementDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("community.attendeesCount")}</label>
          <input className={inputClass} type="number" value={attendeesCount} onChange={(e) => setAttendeesCount(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("community.location")}</label>
        <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("community.topicsDiscussed")}</label>
        <textarea className={inputClass} rows={2} value={topicsDiscussed} onChange={(e) => setTopicsDiscussed(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("community.outcomes")}</label>
        <textarea className={inputClass} rows={2} value={outcomes} onChange={(e) => setOutcomes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function EngagementsTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [engagements, setEngagements] = useState<CommunityEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<CommunityEngagement[]>("/community/engagements");
    setEngagements(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/community/engagements", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/community/engagements/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("community.newEngagement")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("community.engagementDate")}</th>
              <th className="text-left px-4 py-2">{t("community.engagementType")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("community.attendeesCount")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {engagements.map((e) => (
              <tr key={e.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{new Date(e.engagementDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{t(`community.engagementTypes.${e.engagementType}`)}</td>
                <td className="px-4 py-2 text-mine-300">{e.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{e.attendeesCount ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(e.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {engagements.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("community.noEngagements")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("community.newEngagementTitle")} onClose={() => setModal(false)}>
          <EngagementForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function GrievanceForm({ sites, onSubmit, onCancel }: { sites: Site[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [complainantName, setComplainantName] = useState("");
  const [complainantContact, setComplainantContact] = useState("");
  const [description, setDescription] = useState("");
  const [dateRaised, setDateRaised] = useState("");
  const [status, setStatus] = useState<CommunityGrievanceStatus>("OPEN");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ siteId, complainantName, complainantContact: complainantContact || undefined, description, dateRaised, status });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("common.site")}</label>
        <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("community.complainantName")}</label>
          <input className={inputClass} value={complainantName} onChange={(e) => setComplainantName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("community.complainantContact")}</label>
          <input className={inputClass} value={complainantContact} onChange={(e) => setComplainantContact(e.target.value)} />
        </div>
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
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as CommunityGrievanceStatus)}>
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

function GrievancesTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [grievances, setGrievances] = useState<CommunityGrievance[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<CommunityGrievance[]>("/community/grievances");
    setGrievances(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/community/grievances", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/community/grievances/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("community.grievancesHint")}</p>
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("community.newGrievance")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("community.complainantName")}</th>
              <th className="text-left px-4 py-2">{t("common.description")}</th>
              <th className="text-left px-4 py-2">{t("labourRelations.dateRaised")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {grievances.map((g) => (
              <tr key={g.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{g.complainantName}</td>
                <td className="px-4 py-2 text-mine-300">{g.description}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(g.dateRaised).toLocaleDateString()}</td>
                <td className="px-4 py-2"><StatusBadge status={g.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(g.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {grievances.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("community.noGrievances")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("community.newGrievanceTitle")} onClose={() => setModal(false)}>
          <GrievanceForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function SpendTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<CommunitySpendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [recordDate, setRecordDate] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [supplierOrBeneficiary, setSupplierOrBeneficiary] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<CommunitySpendRecord[]>("/community/spend");
    setRecords(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/community/spend", { siteId, recordDate, category, amount: Number(amount), supplierOrBeneficiary: supplierOrBeneficiary || undefined });
      setModal(false);
      setCategory("");
      setAmount("");
      setSupplierOrBeneficiary("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`/community/spend/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("community.spendHint")}</p>
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("community.newSpendRecord")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("resources.recordDate")}</th>
              <th className="text-left px-4 py-2">{t("community.spendCategory")}</th>
              <th className="text-left px-4 py-2">{t("community.amount")}</th>
              <th className="text-left px-4 py-2">{t("community.supplierOrBeneficiary")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{new Date(r.recordDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{r.category}</td>
                <td className="px-4 py-2 text-mine-300">{r.currency} {r.amount.toLocaleString()}</td>
                <td className="px-4 py-2 text-mine-300">{r.supplierOrBeneficiary ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("community.noSpendRecords")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("community.newSpendRecordTitle")} onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("common.site")}</label>
                <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("resources.recordDate")}</label>
                <DateField value={recordDate} onChange={setRecordDate} required />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t("community.spendCategory")}</label>
              <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("community.spendCategoryPlaceholder") ?? ""} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("community.amount")}</label>
                <input className={inputClass} type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div>
                <label className={labelClass}>{t("community.supplierOrBeneficiary")}</label>
                <input className={inputClass} value={supplierOrBeneficiary} onChange={(e) => setSupplierOrBeneficiary(e.target.value)} />
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

export default function CommunityEngagementPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"projects" | "engagements" | "grievances" | "spend">("projects");
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Site[]>("/sites").then((res) => {
      setSites(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("community.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("community.subtitle")}</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className={tab === "projects" ? buttonPrimary : buttonSecondary} onClick={() => setTab("projects")}>{t("community.tabProjects")}</button>
        <button className={tab === "engagements" ? buttonPrimary : buttonSecondary} onClick={() => setTab("engagements")}>{t("community.tabEngagements")}</button>
        <button className={tab === "grievances" ? buttonPrimary : buttonSecondary} onClick={() => setTab("grievances")}>{t("community.tabGrievances")}</button>
        <button className={tab === "spend" ? buttonPrimary : buttonSecondary} onClick={() => setTab("spend")}>{t("community.tabSpend")}</button>
      </div>
      {tab === "projects" && <ProjectsTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "engagements" && <EngagementsTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "grievances" && <GrievancesTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "spend" && <SpendTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
    </div>
  );
}
