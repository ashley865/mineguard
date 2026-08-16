import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  EmergencyContact,
  EmergencyContactCategory,
  EmergencyEvacuation,
  EmergencyEvent,
  EmergencyEventStatus,
  EmergencyEventType,
  EvacuationDrill,
  EvacuationDrillType,
  Site,
  Zone,
} from "../api/types";
import Modal from "../components/Modal";
import { StatusBadge } from "../components/Badges";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import LoadError from "../components/LoadError";

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
const eventTypes: EmergencyEventType[] = [
  "FIRE",
  "GROUND_INSTABILITY",
  "EXPLOSION",
  "FLOODING",
  "GAS_EVENT",
  "SERIOUS_INJURY",
  "VEHICLE_INCIDENT",
  "EVACUATION",
  "OTHER",
];
const eventStatuses: EmergencyEventStatus[] = ["ACTIVE", "RESPONDING", "CONTAINED", "RESOLVED"];

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

function EventForm({ sites, zones, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  initial?: Partial<EmergencyEvent>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!initial?.id;
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [eventType, setEventType] = useState<EmergencyEventType>(initial?.eventType ?? "FIRE");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [peopleAffectedCount, setPeopleAffectedCount] = useState(initial?.peopleAffectedCount?.toString() ?? "");
  const [peopleAffectedDetails, setPeopleAffectedDetails] = useState(initial?.peopleAffectedDetails ?? "");
  const [response, setResponse] = useState(initial?.response ?? "");
  const [status, setStatus] = useState<EmergencyEventStatus>(initial?.status ?? "ACTIVE");
  const [saving, setSaving] = useState(false);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        zoneId: zoneId || null,
        eventType,
        location,
        description,
        peopleAffectedCount: peopleAffectedCount ? Number(peopleAffectedCount) : null,
        peopleAffectedDetails: peopleAffectedDetails || null,
        response: response || null,
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
          <label className={labelClass}>{t("emergency.event.eventType")}</label>
          <select className={selectClass} value={eventType} onChange={(e) => setEventType(e.target.value as EmergencyEventType)}>
            {eventTypes.map((et) => <option key={et} value={et}>{t(`emergency.event.types.${et}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }} disabled={isEdit}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("emergency.event.location")}</label>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">{t("common.unassigned")}</option>
            {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required autoFocus={!isEdit} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("emergency.event.peopleAffectedCount")}</label>
          <input className={inputClass} type="number" min="0" value={peopleAffectedCount} onChange={(e) => setPeopleAffectedCount(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as EmergencyEventStatus)}>
            {eventStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("emergency.event.peopleAffectedDetails")}</label>
        <textarea className={inputClass} rows={2} value={peopleAffectedDetails} onChange={(e) => setPeopleAffectedDetails(e.target.value)} placeholder={t("emergency.event.peopleAffectedDetailsPlaceholder") ?? ""} />
      </div>
      <div>
        <label className={labelClass}>{t("emergency.event.response")}</label>
        <textarea className={inputClass} rows={2} value={response} onChange={(e) => setResponse(e.target.value)} placeholder={t("emergency.event.responsePlaceholder") ?? ""} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function EmergencyEventsTab({ sites, zones, canEdit, canDelete }: { sites: Site[]; zones: Zone[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<EmergencyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | EmergencyEvent>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<EmergencyEvent[]>("/emergency/events");
      setEvents(res.data);
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
    await api.post("/emergency/events", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/emergency/events/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("emergency.event.confirmDelete"))) return;
    await api.delete(`/emergency/events/${id}`);
    await load();
  }

  async function triggerEvacuation(event: EmergencyEvent) {
    const assemblyPoint = window.prompt(t("emergency.event.assemblyPointPrompt") ?? "");
    if (!assemblyPoint) return;
    const res = await api.post("/emergency/evacuations", { siteId: event.siteId, assemblyPoint });
    await api.put(`/emergency/events/${event.id}`, { evacuationId: res.data.id });
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      <p className="text-mine-300 text-sm">{t("emergency.event.subtitle")}</p>

      {sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonDanger} onClick={() => setModal("create")}>{t("emergency.event.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("emergency.event.colType")}</th>
              <th className="text-left px-4 py-2">{t("emergency.event.location")}</th>
              <th className="text-left px-4 py-2">{t("emergency.event.colPeopleAffected")}</th>
              <th className="text-left px-4 py-2">{t("emergency.event.colEvacuation")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id} className="border-t border-mine-800 hover:bg-mine-800/30 align-top">
                <td className="px-4 py-2 font-medium">
                  {t(`emergency.event.types.${ev.eventType}`)}
                  <div className="text-[10px] text-mine-400">{new Date(ev.occurredAt).toLocaleString()}</div>
                </td>
                <td className="px-4 py-2 text-mine-300">
                  {ev.location}
                  <div className="text-[10px] text-mine-400">{ev.site?.name}{ev.zone ? ` · ${ev.zone.name}` : ""}</div>
                </td>
                <td className="px-4 py-2 text-mine-300">{ev.peopleAffectedCount ?? "—"}</td>
                <td className="px-4 py-2">
                  {ev.evacuation ? (
                    <StatusBadge status={ev.evacuation.status} />
                  ) : canEdit ? (
                    <button className="text-xs text-danger-500 hover:underline" onClick={() => triggerEvacuation(ev)}>
                      {t("emergency.event.triggerEvacuation")}
                    </button>
                  ) : (
                    <span className="text-mine-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-2"><StatusBadge status={ev.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(ev)}>{t("common.edit")}</button>
                      {canDelete && <button className={buttonDanger} onClick={() => remove(ev.id)}>{t("common.delete")}</button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("emergency.event.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("emergency.event.newTitle") : t("emergency.event.editTitle")} onClose={() => setModal(null)} size="lg">
          <EventForm
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

function ContactsTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<EmergencyContact[]>("/emergency/contacts");
      setContacts(res.data);
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
  if (loadError) return <LoadError onRetry={load} />;

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
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<EvacuationDrill[]>("/emergency/drills");
      setDrills(res.data);
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
  if (loadError) return <LoadError onRetry={load} />;

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
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoading(true);
    setLoadError(false);
    api
      .get<EmergencyEvacuation[]>("/emergency/evacuations")
      .then((res) => setEvacuations(res.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

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
  const [tab, setTab] = useState<"events" | "contacts" | "drills" | "evacuations">("events");
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoading(true);
    setLoadError(false);
    Promise.all([api.get<Site[]>("/sites"), api.get<Zone[]>("/zones")])
      .then(([s, z]) => {
        setSites(s.data);
        setZones(z.data);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("emergency.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("emergency.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className={tab === "events" ? buttonPrimary : buttonSecondary} onClick={() => setTab("events")}>
          {t("emergency.tabEvents")}
        </button>
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

      {tab === "events" && <EmergencyEventsTab sites={sites} zones={zones} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "contacts" && <ContactsTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "drills" && <DrillsTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "evacuations" && <EvacuationsTab />}
    </div>
  );
}
