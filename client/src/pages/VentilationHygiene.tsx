import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  ExposurePollutant,
  ExposureSampleType,
  OccupationalExposureRecord,
  RefugeBay,
  RefugeBayStatus,
  Site,
  VentilationDistrict,
  VentilationReading,
  Worker,
  Zone,
} from "../api/types";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";

const pollutants: ExposurePollutant[] = ["DUST_RESPIRABLE", "DUST_INHALABLE", "NOISE", "METHANE", "CARBON_MONOXIDE", "DIESEL_PARTICULATE", "SILICA", "OTHER"];
const sampleTypes: ExposureSampleType[] = ["PERSONAL", "AREA"];
const refugeBayStatuses: RefugeBayStatus[] = ["OPERATIONAL", "OUT_OF_SERVICE"];

function DistrictForm({ sites, zones, onSubmit, onCancel }: { sites: Site[]; zones: Zone[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState("");
  const [name, setName] = useState("");
  const [requiredAirflowQuantity, setRequiredAirflowQuantity] = useState("");
  const [unit, setUnit] = useState("m3/s");
  const [saving, setSaving] = useState(false);
  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ siteId, zoneId: zoneId || null, name, requiredAirflowQuantity: requiredAirflowQuantity ? Number(requiredAirflowQuantity) : null, unit });
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
        <label className={labelClass}>{t("ventilation.districtName")}</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilation.requiredAirflow")}</label>
          <input className={inputClass} type="number" step="any" value={requiredAirflowQuantity} onChange={(e) => setRequiredAirflowQuantity(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("inventory.unit")}</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function ReadingsModal({ district, onClose }: { district: VentilationDistrict; onClose: () => void }) {
  const { t } = useTranslation();
  const [readings, setReadings] = useState<VentilationReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingDate, setReadingDate] = useState("");
  const [airflowQuantity, setAirflowQuantity] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<VentilationReading[]>("/ventilation/readings", { params: { districtId: district.id } });
    setReadings(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/ventilation/readings", { districtId: district.id, readingDate, airflowQuantity: Number(airflowQuantity), unit: district.unit });
      setReadingDate("");
      setAirflowQuantity("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t("ventilation.readingsFor", { name: district.name })} onClose={onClose}>
      <div className="space-y-4">
        {district.requiredAirflowQuantity != null && (
          <div className="text-xs text-mine-400">{t("ventilation.requiredAirflow")}: <span className="text-mine-100 font-semibold">{district.requiredAirflowQuantity} {district.unit}</span></div>
        )}
        <form onSubmit={handleSubmit} className="flex items-end gap-3 border border-mine-800 rounded-md p-3">
          <div className="flex-1">
            <label className={labelClass}>{t("groundControl.readingDate")}</label>
            <DateField value={readingDate} onChange={setReadingDate} required />
          </div>
          <div className="flex-1">
            <label className={labelClass}>{t("ventilation.airflowQuantity")}</label>
            <input className={inputClass} type="number" step="any" value={airflowQuantity} onChange={(e) => setAirflowQuantity(e.target.value)} required />
          </div>
          <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
        </form>
        {loading && <div className="text-mine-300 text-sm">{t("common.loading")}</div>}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {readings.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1.5">
              <span>{new Date(r.readingDate).toLocaleDateString()}</span>
              <span className={r.withinRequirement ? "text-mine-300" : "text-danger-500 font-semibold"}>{r.airflowQuantity} {r.unit}</span>
            </div>
          ))}
          {!loading && readings.length === 0 && <div className="text-mine-400 text-sm">{t("groundControl.noReadings")}</div>}
        </div>
      </div>
    </Modal>
  );
}

function DistrictsTab({ sites, zones, canEdit, canDelete }: { sites: Site[]; zones: Zone[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [districts, setDistricts] = useState<VentilationDistrict[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [readingsDistrict, setReadingsDistrict] = useState<VentilationDistrict | null>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<VentilationDistrict[]>("/ventilation/districts");
    setDistricts(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/ventilation/districts", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/ventilation/districts/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("ventilation.districtsHint")}</p>
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("ventilation.newDistrict")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("ventilation.districtName")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("ventilation.requiredAirflow")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {districts.map((d) => (
              <tr key={d.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{d.name}</td>
                <td className="px-4 py-2 text-mine-300">{d.site?.name}{d.zone ? ` / ${d.zone.name}` : ""}</td>
                <td className="px-4 py-2 text-mine-300">{d.requiredAirflowQuantity ?? "—"} {d.unit}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setReadingsDistrict(d)}>{t("ventilation.readings")}</button>
                    {canDelete && <button className={buttonDanger} onClick={() => remove(d.id)}>{t("common.delete")}</button>}
                  </div>
                </td>
              </tr>
            ))}
            {districts.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-mine-400">{t("ventilation.noDistricts")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("ventilation.newDistrictTitle")} onClose={() => setModal(false)}>
          <DistrictForm sites={sites} zones={zones} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
      {readingsDistrict && <ReadingsModal district={readingsDistrict} onClose={() => setReadingsDistrict(null)} />}
    </div>
  );
}

function RefugeBayForm({ sites, zones, onSubmit, onCancel }: { sites: Site[]; zones: Zone[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState("");
  const [name, setName] = useState("");
  const [capacityPersons, setCapacityPersons] = useState("");
  const [airSupplyDurationHours, setAirSupplyDurationHours] = useState("");
  const [nextInspectionDue, setNextInspectionDue] = useState("");
  const [status, setStatus] = useState<RefugeBayStatus>("OPERATIONAL");
  const [saving, setSaving] = useState(false);
  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        zoneId: zoneId || null,
        name,
        capacityPersons: Number(capacityPersons),
        airSupplyDurationHours: airSupplyDurationHours ? Number(airSupplyDurationHours) : null,
        nextInspectionDue: nextInspectionDue || null,
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
        <label className={labelClass}>{t("ventilation.refugeBayName")}</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilation.capacityPersons")}</label>
          <input className={inputClass} type="number" value={capacityPersons} onChange={(e) => setCapacityPersons(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("ventilation.airSupplyDurationHours")}</label>
          <input className={inputClass} type="number" step="any" value={airSupplyDurationHours} onChange={(e) => setAirSupplyDurationHours(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilation.nextInspectionDue")}</label>
          <DateField value={nextInspectionDue} onChange={setNextInspectionDue} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as RefugeBayStatus)}>
            {refugeBayStatuses.map((s) => <option key={s} value={s}>{t(`ventilation.refugeBayStatuses.${s}`)}</option>)}
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

function RefugeBaysTab({ sites, zones, canEdit, canDelete }: { sites: Site[]; zones: Zone[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [bays, setBays] = useState<RefugeBay[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<RefugeBay[]>("/ventilation/refuge-bays");
    setBays(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/ventilation/refuge-bays", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/ventilation/refuge-bays/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("ventilation.newRefugeBay")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("ventilation.refugeBayName")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("ventilation.capacityPersons")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {bays.map((b) => (
              <tr key={b.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{b.name}</td>
                <td className="px-4 py-2 text-mine-300">{b.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{b.capacityPersons}</td>
                <td className="px-4 py-2 text-mine-300">{t(`ventilation.refugeBayStatuses.${b.status}`)}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(b.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {bays.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("ventilation.noRefugeBays")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("ventilation.newRefugeBayTitle")} onClose={() => setModal(false)}>
          <RefugeBayForm sites={sites} zones={zones} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function ExposureForm({ workers, onSubmit, onCancel }: { workers: Worker[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [pollutant, setPollutant] = useState<ExposurePollutant>("DUST_RESPIRABLE");
  const [sampleDate, setSampleDate] = useState("");
  const [sampleType, setSampleType] = useState<ExposureSampleType>("PERSONAL");
  const [measuredValue, setMeasuredValue] = useState("");
  const [unit, setUnit] = useState("mg/m3");
  const [occupationalExposureLimit, setOccupationalExposureLimit] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        workerId,
        pollutant,
        sampleDate,
        sampleType,
        measuredValue: Number(measuredValue),
        unit,
        occupationalExposureLimit: Number(occupationalExposureLimit),
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilation.pollutant")}</label>
          <select className={selectClass} value={pollutant} onChange={(e) => setPollutant(e.target.value as ExposurePollutant)}>
            {pollutants.map((p) => <option key={p} value={p}>{t(`ventilation.pollutants.${p}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("ventilation.sampleType")}</label>
          <select className={selectClass} value={sampleType} onChange={(e) => setSampleType(e.target.value as ExposureSampleType)}>
            {sampleTypes.map((s) => <option key={s} value={s}>{t(`ventilation.sampleTypes.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("ventilation.sampleDate")}</label>
        <DateField value={sampleDate} onChange={setSampleDate} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("ventilation.measuredValue")}</label>
          <input className={inputClass} type="number" step="any" value={measuredValue} onChange={(e) => setMeasuredValue(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("inventory.unit")}</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("ventilation.oel")}</label>
          <input className={inputClass} type="number" step="any" value={occupationalExposureLimit} onChange={(e) => setOccupationalExposureLimit(e.target.value)} required />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function ExposureTab({ workers, canEdit, canDelete }: { workers: Worker[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<OccupationalExposureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<OccupationalExposureRecord[]>("/ventilation/exposure-records");
    setRecords(res.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/ventilation/exposure-records", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/ventilation/exposure-records/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("ventilation.exposureHint")}</p>
      {canEdit && workers.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("ventilation.newExposureRecord")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("workers.title")}</th>
              <th className="text-left px-4 py-2">{t("ventilation.pollutant")}</th>
              <th className="text-left px-4 py-2">{t("ventilation.sampleDate")}</th>
              <th className="text-left px-4 py-2">{t("ventilation.measuredValue")}</th>
              <th className="text-left px-4 py-2">{t("ventilation.oel")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{r.worker?.name}</td>
                <td className="px-4 py-2 text-mine-300">{t(`ventilation.pollutants.${r.pollutant}`)}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(r.sampleDate).toLocaleDateString()}</td>
                <td className={`px-4 py-2 font-medium ${r.exceedsLimit ? "text-danger-500" : "text-mine-300"}`}>{r.measuredValue} {r.unit}</td>
                <td className="px-4 py-2 text-mine-300">{r.occupationalExposureLimit} {r.unit}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("ventilation.noExposureRecords")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("ventilation.newExposureRecordTitle")} onClose={() => setModal(false)}>
          <ExposureForm workers={workers} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

export default function VentilationHygiene() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"districts" | "refuge" | "exposure">("districts");
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get<Site[]>("/sites"), api.get<Zone[]>("/zones"), api.get<Worker[]>("/workers")]).then(([s, z, w]) => {
      setSites(s.data);
      setZones(z.data);
      setWorkers(w.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("ventilation.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("ventilation.subtitle")}</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className={tab === "districts" ? buttonPrimary : buttonSecondary} onClick={() => setTab("districts")}>{t("ventilation.tabDistricts")}</button>
        <button className={tab === "refuge" ? buttonPrimary : buttonSecondary} onClick={() => setTab("refuge")}>{t("ventilation.tabRefuge")}</button>
        <button className={tab === "exposure" ? buttonPrimary : buttonSecondary} onClick={() => setTab("exposure")}>{t("ventilation.tabExposure")}</button>
      </div>
      {tab === "districts" && <DistrictsTab sites={sites} zones={zones} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "refuge" && <RefugeBaysTab sites={sites} zones={zones} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "exposure" && <ExposureTab workers={workers} canEdit={canEdit} canDelete={canDelete} />}
    </div>
  );
}
