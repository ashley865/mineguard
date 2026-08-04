import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { EmergencyContact, EmergencyContactCategory, EmergencyEvacuation, EvacuationDrill, EvacuationDrillType, Site } from "../api/types";
import Modal from "../components/Modal";
import { StatusBadge } from "../components/Badges";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";

const categories: EmergencyContactCategory[] = [
  "MINE_RESCUE",
  "MEDICAL",
  "AMBULANCE",
  "FIRE",
  "POLICE",
  "SECURITY",
  "INTERNAL_MANAGEMENT",
  "OTHER",
];
const drillTypes: EvacuationDrillType[] = ["FIRE", "GAS_LEAK", "SEISMIC", "GENERAL"];

function ContactForm({ sites, onSubmit, onCancel }: {
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<EmergencyContactCategory>("OTHER");
  const [priority, setPriority] = useState("0");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ siteId: siteId || null, name, role, phone, category, priority: Number(priority) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("common.site")}</label>
        <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">{t("documents.companyWide")}</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.name")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("emergency.role")}</label>
          <input className={inputClass} value={role} onChange={(e) => setRole(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.phone")}</label>
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("emergency.category")}</label>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as EmergencyContactCategory)}>
            {categories.map((c) => <option key={c} value={c}>{t(`emergency.categories.${c}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("emergency.priority")}</label>
        <input className={inputClass} type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function DrillForm({ sites, onSubmit, onCancel }: {
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [drillDate, setDrillDate] = useState("");
  const [drillType, setDrillType] = useState<EvacuationDrillType>("FIRE");
  const [totalParticipants, setTotalParticipants] = useState("");
  const [musterTimeSeconds, setMusterTimeSeconds] = useState("");
  const [issuesIdentified, setIssuesIdentified] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        drillDate,
        drillType,
        totalParticipants: totalParticipants ? Number(totalParticipants) : null,
        musterTimeSeconds: musterTimeSeconds ? Number(musterTimeSeconds) : null,
        issuesIdentified: issuesIdentified || undefined,
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
          <label className={labelClass}>{t("emergency.drillType")}</label>
          <select className={selectClass} value={drillType} onChange={(e) => setDrillType(e.target.value as EvacuationDrillType)}>
            {drillTypes.map((d) => <option key={d} value={d}>{t(`emergency.drillTypes.${d}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("emergency.drillDate")}</label>
        <DateField value={drillDate} onChange={setDrillDate} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("emergency.totalParticipants")}</label>
          <input className={inputClass} type="number" value={totalParticipants} onChange={(e) => setTotalParticipants(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("emergency.musterTimeSeconds")}</label>
          <input className={inputClass} type="number" value={musterTimeSeconds} onChange={(e) => setMusterTimeSeconds(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("emergency.issuesIdentified")}</label>
        <textarea className={inputClass} rows={2} value={issuesIdentified} onChange={(e) => setIssuesIdentified(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function ContactsTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<EmergencyContact[]>("/emergency/contacts");
    setContacts(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/emergency/contacts", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("emergency.confirmDeleteContact"))) return;
    await api.delete(`/emergency/contacts/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("emergency.newContact")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("common.name")}</th>
              <th className="text-left px-4 py-2">{t("emergency.role")}</th>
              <th className="text-left px-4 py-2">{t("common.phone")}</th>
              <th className="text-left px-4 py-2">{t("emergency.category")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2 text-mine-300">{c.role}</td>
                <td className="px-4 py-2 text-mine-300">{c.phone}</td>
                <td className="px-4 py-2 text-mine-300">{t(`emergency.categories.${c.category}`)}</td>
                <td className="px-4 py-2 text-mine-300">{c.site?.name ?? t("documents.companyWide")}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && (
                    <button className={buttonDanger} onClick={() => remove(c.id)}>{t("common.delete")}</button>
                  )}
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("emergency.noneYetContacts")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("emergency.newContactTitle")} onClose={() => setModal(false)}>
          <ContactForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function DrillsTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [drills, setDrills] = useState<EvacuationDrill[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<EvacuationDrill[]>("/emergency/drills");
    setDrills(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/emergency/drills", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("emergency.confirmDeleteDrill"))) return;
    await api.delete(`/emergency/drills/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("emergency.newDrill")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("emergency.drillDate")}</th>
              <th className="text-left px-4 py-2">{t("emergency.drillType")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("emergency.totalParticipants")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {drills.map((d) => (
              <tr key={d.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{new Date(d.drillDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{t(`emergency.drillTypes.${d.drillType}`)}</td>
                <td className="px-4 py-2 text-mine-300">{d.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{d.totalParticipants ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && (
                    <button className={buttonDanger} onClick={() => remove(d.id)}>{t("common.delete")}</button>
                  )}
                </td>
              </tr>
            ))}
            {drills.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("emergency.noneYetDrills")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("emergency.newDrillTitle")} onClose={() => setModal(false)}>
          <DrillForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function EvacuationsTab() {
  const { t } = useTranslation();
  const [evacuations, setEvacuations] = useState<EmergencyEvacuation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<EmergencyEvacuation[]>("/emergency/evacuations").then((res) => {
      setEvacuations(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className={`${cardClass} overflow-x-auto`}>
      <table className="w-full text-sm">
        <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-2">{t("common.site")}</th>
            <th className="text-left px-4 py-2">{t("emergency.assemblyPoint")}</th>
            <th className="text-left px-4 py-2">{t("emergency.triggeredAt")}</th>
            <th className="text-left px-4 py-2">{t("common.status")}</th>
          </tr>
        </thead>
        <tbody>
          {evacuations.map((e) => (
            <tr key={e.id} className="border-t border-mine-800 hover:bg-mine-800/30">
              <td className="px-4 py-2 font-medium">{e.site?.name}</td>
              <td className="px-4 py-2 text-mine-300">{e.assemblyPoint}</td>
              <td className="px-4 py-2 text-mine-300">
                {new Date(e.triggeredAt).toLocaleString()}
                {e.triggeredBy?.name ? ` · ${e.triggeredBy.name}` : ""}
              </td>
              <td className="px-4 py-2"><StatusBadge status={e.status} /></td>
            </tr>
          ))}
          {evacuations.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-6 text-center text-mine-400">{t("emergency.noneYetEvacuations")}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function EmergencyResponse() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"contacts" | "drills" | "evacuations">("contacts");
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
        <h1 className="text-xl font-bold">{t("emergency.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("emergency.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className={tab === "contacts" ? buttonPrimary : buttonSecondary} onClick={() => setTab("contacts")}>
          {t("emergency.tabContacts")}
        </button>
        <button className={tab === "drills" ? buttonPrimary : buttonSecondary} onClick={() => setTab("drills")}>
          {t("emergency.tabDrills")}
        </button>
        <button className={tab === "evacuations" ? buttonPrimary : buttonSecondary} onClick={() => setTab("evacuations")}>
          {t("emergency.tabEvacuations")}
        </button>
      </div>

      {tab === "contacts" && <ContactsTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "drills" && <DrillsTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "evacuations" && <EvacuationsTab />}
    </div>
  );
}
