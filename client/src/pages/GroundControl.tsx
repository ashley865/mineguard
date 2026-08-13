import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  GeotechnicalEventType,
  GeotechnicalMonitoringPoint,
  GeotechnicalPointType,
  GeotechnicalReading,
  GroundControlDistrict,
  RockfallIncident,
  SeismicEvent,
  Site,
  Zone,
} from "../api/types";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import DataTable, { DataTableColumn } from "../components/DataTable";
import SummaryCards from "../components/SummaryCards";
import { AuditHistoryButton } from "../components/AuditHistoryPanel";

const pointTypes: GeotechnicalPointType[] = ["EXTENSOMETER", "CONVERGENCE_STATION", "TILTMETER", "PIEZOMETER", "OTHER"];
const eventTypes: GeotechnicalEventType[] = ["ROCKFALL", "ROCKBURST"];

function DistrictForm({ sites, zones, onSubmit, onCancel }: { sites: Site[]; zones: Zone[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState("");
  const [name, setName] = useState("");
  const [requiredSupportStandard, setRequiredSupportStandard] = useState("");
  const [saving, setSaving] = useState(false);
  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ siteId, zoneId: zoneId || null, name, requiredSupportStandard: requiredSupportStandard || undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">—</option>
            {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("groundControl.districtName")}</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("groundControl.requiredSupportStandard")}</label>
        <textarea className={inputClass} rows={2} value={requiredSupportStandard} onChange={(e) => setRequiredSupportStandard(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function DistrictsTab({ sites, zones, canEdit, canDelete }: { sites: Site[]; zones: Zone[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [districts, setDistricts] = useState<GroundControlDistrict[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<GroundControlDistrict[]>("/ground-control/districts");
    setDistricts(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/ground-control/districts", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/ground-control/districts/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("groundControl.districtsHint")}</p>
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("groundControl.newDistrict")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "name", header: t("groundControl.districtName"), render: (d) => <span className="font-medium">{d.name}</span>, sortValue: (d) => d.name },
            { key: "site", header: t("common.site"), render: (d) => `${d.site?.name ?? ""}${d.zone ? ` / ${d.zone.name}` : ""}`, sortValue: (d) => d.site?.name ?? "" },
            { key: "standard", header: t("groundControl.requiredSupportStandard"), render: (d) => d.requiredSupportStandard ?? "—" },
          ] as DataTableColumn<GroundControlDistrict>[]
        }
        rows={districts}
        rowKey={(d) => d.id}
        emptyMessage={t("groundControl.noDistricts")}
        searchValue={(d) => `${d.name} ${d.site?.name ?? ""}`}
        actions={(d) => (canDelete ? <button className={buttonDanger} onClick={() => remove(d.id)}>{t("common.delete")}</button> : null)}
      />
      {modal && (
        <Modal title={t("groundControl.newDistrictTitle")} onClose={() => setModal(false)}>
          <DistrictForm sites={sites} zones={zones} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function PointForm({ districts, onSubmit, onCancel }: { districts: GroundControlDistrict[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [districtId, setDistrictId] = useState(districts[0]?.id ?? "");
  const [pointType, setPointType] = useState<GeotechnicalPointType>("EXTENSOMETER");
  const [locationDescription, setLocationDescription] = useState("");
  const [installedDate, setInstalledDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ districtId, pointType, locationDescription, installedDate: installedDate || null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("groundControl.district")}</label>
          <select className={selectClass} value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("groundControl.pointType")}</label>
          <select className={selectClass} value={pointType} onChange={(e) => setPointType(e.target.value as GeotechnicalPointType)}>
            {pointTypes.map((p) => <option key={p} value={p}>{t(`groundControl.pointTypes.${p}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("groundControl.locationDescription")}</label>
        <input className={inputClass} value={locationDescription} onChange={(e) => setLocationDescription(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>{t("groundControl.installedDate")}</label>
        <DateField value={installedDate} onChange={setInstalledDate} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function ReadingsModal({ point, onClose }: { point: GeotechnicalMonitoringPoint; onClose: () => void }) {
  const { t } = useTranslation();
  const [readings, setReadings] = useState<GeotechnicalReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingDate, setReadingDate] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("mm");
  const [alertThreshold, setAlertThreshold] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<GeotechnicalReading[]>("/ground-control/readings", { params: { pointId: point.id } });
    setReadings(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/ground-control/readings", {
        pointId: point.id,
        readingDate,
        value: Number(value),
        unit,
        alertThreshold: alertThreshold ? Number(alertThreshold) : null,
      });
      setReadingDate("");
      setValue("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t("groundControl.readingsFor", { name: point.locationDescription })} onClose={onClose}>
      <div className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3 border border-mine-800 rounded-md p-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>{t("groundControl.readingDate")}</label>
              <DateField value={readingDate} onChange={setReadingDate} required />
            </div>
            <div>
              <label className={labelClass}>{t("groundControl.value")}</label>
              <input className={inputClass} type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t("inventory.unit")}</label>
              <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("groundControl.alertThreshold")}</label>
            <input className={inputClass} type="number" step="any" value={alertThreshold} onChange={(e) => setAlertThreshold(e.target.value)} />
          </div>
          <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
        </form>
        {loading && <div className="text-mine-300 text-sm">{t("common.loading")}</div>}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {readings.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1.5">
              <span>{new Date(r.readingDate).toLocaleDateString()}</span>
              <span className={r.exceedsThreshold ? "text-danger-500 font-semibold" : "text-mine-300"}>{r.value} {r.unit}</span>
            </div>
          ))}
          {!loading && readings.length === 0 && <div className="text-mine-400 text-sm">{t("groundControl.noReadings")}</div>}
        </div>
      </div>
    </Modal>
  );
}

function MonitoringTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [districts, setDistricts] = useState<GroundControlDistrict[]>([]);
  const [points, setPoints] = useState<GeotechnicalMonitoringPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [readingsPoint, setReadingsPoint] = useState<GeotechnicalMonitoringPoint | null>(null);

  async function load() {
    setLoading(true);
    const [d, p] = await Promise.all([
      api.get<GroundControlDistrict[]>("/ground-control/districts"),
      api.get<GeotechnicalMonitoringPoint[]>("/ground-control/points"),
    ]);
    setDistricts(d.data);
    setPoints(p.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/ground-control/points", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/ground-control/points/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("groundControl.pointsHint")}</p>
      {canEdit && districts.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("groundControl.newPoint")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "location", header: t("groundControl.locationDescription"), render: (p) => <span className="font-medium">{p.locationDescription}</span>, sortValue: (p) => p.locationDescription },
            { key: "type", header: t("groundControl.pointType"), render: (p) => t(`groundControl.pointTypes.${p.pointType}`), sortValue: (p) => p.pointType },
            { key: "district", header: t("groundControl.district"), render: (p) => p.district?.name ?? "—", sortValue: (p) => p.district?.name ?? "" },
          ] as DataTableColumn<GeotechnicalMonitoringPoint>[]
        }
        rows={points}
        rowKey={(p) => p.id}
        emptyMessage={t("groundControl.noPoints")}
        searchValue={(p) => `${p.locationDescription} ${p.district?.name ?? ""}`}
        actions={(p) => (
          <div className="flex justify-end gap-2">
            <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setReadingsPoint(p)}>{t("groundControl.readings")}</button>
            {canDelete && <button className={buttonDanger} onClick={() => remove(p.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={t("groundControl.newPointTitle")} onClose={() => setModal(false)}>
          <PointForm districts={districts} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
      {readingsPoint && <ReadingsModal point={readingsPoint} onClose={() => setReadingsPoint(null)} />}
    </div>
  );
}

function SeismicEventForm({ sites, zones, onSubmit, onCancel }: { sites: Site[]; zones: Zone[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [magnitude, setMagnitude] = useState("");
  const [locationDescription, setLocationDescription] = useState("");
  const [damageObserved, setDamageObserved] = useState(false);
  const [damageDescription, setDamageDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        zoneId: zoneId || null,
        eventDate,
        magnitude: Number(magnitude),
        locationDescription: locationDescription || undefined,
        damageObserved,
        damageDescription: damageObserved ? damageDescription || undefined : undefined,
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
          <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">—</option>
            {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("groundControl.eventDate")}</label>
          <DateField value={eventDate} onChange={setEventDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("groundControl.magnitude")}</label>
          <input className={inputClass} type="number" step="any" value={magnitude} onChange={(e) => setMagnitude(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("groundControl.locationDescription")}</label>
        <input className={inputClass} value={locationDescription} onChange={(e) => setLocationDescription(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={damageObserved} onChange={(e) => setDamageObserved(e.target.checked)} />
        {t("groundControl.damageObserved")}
      </label>
      {damageObserved && (
        <div>
          <label className={labelClass}>{t("groundControl.damageDescription")}</label>
          <textarea className={inputClass} rows={2} value={damageDescription} onChange={(e) => setDamageDescription(e.target.value)} />
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function SeismicEventsTab({ sites, zones, canEdit, canDelete }: { sites: Site[]; zones: Zone[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<SeismicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<SeismicEvent[]>("/ground-control/seismic-events");
    setEvents(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/ground-control/seismic-events", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/ground-control/seismic-events/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  const damageCount = events.filter((ev) => ev.damageObserved).length;

  return (
    <div className="space-y-4">
      <SummaryCards cards={[{ label: t("groundControl.summaryDamageObserved"), value: damageCount, tone: damageCount > 0 ? "danger" : "default" }]} />

      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("groundControl.newSeismicEvent")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "date", header: t("groundControl.eventDate"), render: (ev) => new Date(ev.eventDate).toLocaleDateString(), sortValue: (ev) => ev.eventDate },
            { key: "magnitude", header: t("groundControl.magnitude"), render: (ev) => ev.magnitude, sortValue: (ev) => ev.magnitude },
            { key: "location", header: t("groundControl.locationDescription"), render: (ev) => ev.locationDescription ?? "—" },
            { key: "damage", header: t("groundControl.damageObserved"), render: (ev) => (ev.damageObserved ? <span className="text-danger-500">{t("common.yes")}</span> : t("common.no")), sortValue: (ev) => (ev.damageObserved ? 1 : 0) },
          ] as DataTableColumn<SeismicEvent>[]
        }
        rows={events}
        rowKey={(ev) => ev.id}
        emptyMessage={t("groundControl.noSeismicEvents")}
        actions={(ev) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="SeismicEvent" entityId={ev.id} />
            {canDelete && <button className={buttonDanger} onClick={() => remove(ev.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={t("groundControl.newSeismicEventTitle")} onClose={() => setModal(false)}>
          <SeismicEventForm sites={sites} zones={zones} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function RockfallForm({ sites, zones, districts, onSubmit, onCancel }: {
  sites: Site[]; zones: Zone[]; districts: GroundControlDistrict[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [eventType, setEventType] = useState<GeotechnicalEventType>("ROCKFALL");
  const [eventDate, setEventDate] = useState("");
  const [supportInPlace, setSupportInPlace] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ siteId, zoneId: zoneId || null, districtId: districtId || null, eventType, eventDate, supportInPlace: supportInPlace || undefined, description });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">—</option>
            {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("groundControl.eventType")}</label>
          <select className={selectClass} value={eventType} onChange={(e) => setEventType(e.target.value as GeotechnicalEventType)}>
            {eventTypes.map((et) => <option key={et} value={et}>{t(`groundControl.eventTypes.${et}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("groundControl.district")}</label>
          <select className={selectClass} value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            <option value="">—</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("groundControl.eventDate")}</label>
        <DateField value={eventDate} onChange={setEventDate} required />
      </div>
      <div>
        <label className={labelClass}>{t("groundControl.supportInPlace")}</label>
        <input className={inputClass} value={supportInPlace} onChange={(e) => setSupportInPlace(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function RockfallIncidentsTab({ sites, zones, canEdit, canDelete }: { sites: Site[]; zones: Zone[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [incidents, setIncidents] = useState<RockfallIncident[]>([]);
  const [districts, setDistricts] = useState<GroundControlDistrict[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const [i, d] = await Promise.all([
      api.get<RockfallIncident[]>("/ground-control/rockfall-incidents"),
      api.get<GroundControlDistrict[]>("/ground-control/districts"),
    ]);
    setIncidents(i.data);
    setDistricts(d.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/ground-control/rockfall-incidents", data);
    setModal(false);
    await load();
  }

  async function signOff(id: string) {
    await api.post(`/ground-control/rockfall-incidents/${id}/sign-off`);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/ground-control/rockfall-incidents/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  const unauthorizedCount = incidents.filter((r) => !r.reEntryAuthorized).length;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("groundControl.rockfallHint")}</p>

      <SummaryCards cards={[{ label: t("groundControl.summaryUnauthorizedReEntry"), value: unauthorizedCount, tone: unauthorizedCount > 0 ? "danger" : "default" }]} />

      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("groundControl.newRockfallIncident")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "date", header: t("groundControl.eventDate"), render: (r) => new Date(r.eventDate).toLocaleDateString(), sortValue: (r) => r.eventDate },
            { key: "type", header: t("groundControl.eventType"), render: (r) => t(`groundControl.eventTypes.${r.eventType}`), sortValue: (r) => r.eventType },
            { key: "site", header: t("common.site"), render: (r) => r.site?.name ?? "—", sortValue: (r) => r.site?.name ?? "" },
            {
              key: "reEntry",
              header: t("groundControl.reEntry"),
              render: (r) =>
                r.reEntryAuthorized ? (
                  <span className="text-success-500">{t("groundControl.authorizedBy", { name: r.signOffBy?.name })}</span>
                ) : canEdit ? (
                  <button className="text-xs text-mine-300 hover:text-mine-50 underline" onClick={() => signOff(r.id)}>{t("groundControl.authorizeReEntry")}</button>
                ) : (
                  <span className="text-danger-500">{t("groundControl.notAuthorized")}</span>
                ),
              sortValue: (r) => (r.reEntryAuthorized ? 1 : 0),
            },
          ] as DataTableColumn<RockfallIncident>[]
        }
        rows={incidents}
        rowKey={(r) => r.id}
        emptyMessage={t("groundControl.noRockfallIncidents")}
        actions={(r) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="RockfallIncident" entityId={r.id} />
            {canDelete && <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={t("groundControl.newRockfallIncidentTitle")} onClose={() => setModal(false)}>
          <RockfallForm sites={sites} zones={zones} districts={districts} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

export default function GroundControl() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"districts" | "monitoring" | "seismic" | "rockfall">("districts");
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get<Site[]>("/sites"), api.get<Zone[]>("/zones")]).then(([s, z]) => {
      setSites(s.data);
      setZones(z.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("groundControl.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("groundControl.subtitle")}</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className={tab === "districts" ? buttonPrimary : buttonSecondary} onClick={() => setTab("districts")}>{t("groundControl.tabDistricts")}</button>
        <button className={tab === "monitoring" ? buttonPrimary : buttonSecondary} onClick={() => setTab("monitoring")}>{t("groundControl.tabMonitoring")}</button>
        <button className={tab === "seismic" ? buttonPrimary : buttonSecondary} onClick={() => setTab("seismic")}>{t("groundControl.tabSeismic")}</button>
        <button className={tab === "rockfall" ? buttonPrimary : buttonSecondary} onClick={() => setTab("rockfall")}>{t("groundControl.tabRockfall")}</button>
      </div>
      {tab === "districts" && <DistrictsTab sites={sites} zones={zones} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "monitoring" && <MonitoringTab canEdit={canEdit} canDelete={canDelete} />}
      {tab === "seismic" && <SeismicEventsTab sites={sites} zones={zones} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "rockfall" && <RockfallIncidentsTab sites={sites} zones={zones} canEdit={canEdit} canDelete={canDelete} />}
    </div>
  );
}
