import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  AcidMineDrainageReading,
  EnergyConsumptionRecord,
  GhgEmissionsRecord,
  PollutionControlDam,
  PollutionDamStatus,
  Site,
  WaterBalanceRecord,
} from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import LoadError from "../components/LoadError";

const damStatuses: PollutionDamStatus[] = ["ACTIVE", "DECOMMISSIONED"];

function WaterBalanceForm({ sites, onSubmit, onCancel }: { sites: Site[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [recordDate, setRecordDate] = useState("");
  const [abstractedVolume, setAbstractedVolume] = useState("");
  const [dischargedVolume, setDischargedVolume] = useState("");
  const [recycledVolume, setRecycledVolume] = useState("0");
  const [licenseLimit, setLicenseLimit] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId, recordDate, abstractedVolume: Number(abstractedVolume), dischargedVolume: Number(dischargedVolume),
        recycledVolume: Number(recycledVolume), licenseLimit: licenseLimit ? Number(licenseLimit) : null,
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
          <label className={labelClass}>{t("resources.recordDate")}</label>
          <DateField value={recordDate} onChange={setRecordDate} required />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("resources.abstractedVolume")}</label>
          <input className={inputClass} type="number" step="any" value={abstractedVolume} onChange={(e) => setAbstractedVolume(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("resources.dischargedVolume")}</label>
          <input className={inputClass} type="number" step="any" value={dischargedVolume} onChange={(e) => setDischargedVolume(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("resources.recycledVolume")}</label>
          <input className={inputClass} type="number" step="any" value={recycledVolume} onChange={(e) => setRecycledVolume(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("resources.licenseLimit")}</label>
        <input className={inputClass} type="number" step="any" value={licenseLimit} onChange={(e) => setLicenseLimit(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function WaterBalanceTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<WaterBalanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<WaterBalanceRecord[]>("/resources/water-balance");
      setRecords(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/resources/water-balance", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/resources/water-balance/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("resources.waterBalanceHint")}</p>
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("resources.newWaterBalance")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("resources.recordDate")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("resources.abstractedVolume")}</th>
              <th className="text-left px-4 py-2">{t("resources.dischargedVolume")}</th>
              <th className="text-left px-4 py-2">{t("resources.recycledVolume")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{new Date(r.recordDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{r.site?.name}</td>
                <td className={`px-4 py-2 ${!r.withinLimit ? "text-danger-500 font-semibold" : "text-mine-300"}`}>{r.abstractedVolume} {r.unit}</td>
                <td className="px-4 py-2 text-mine-300">{r.dischargedVolume} {r.unit}</td>
                <td className="px-4 py-2 text-mine-300">{r.recycledVolume} {r.unit}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("resources.noWaterBalance")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("resources.newWaterBalanceTitle")} onClose={() => setModal(false)}>
          <WaterBalanceForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function DamForm({ sites, onSubmit, onCancel }: { sites: Site[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [currentLevel, setCurrentLevel] = useState("");
  const [status, setStatus] = useState<PollutionDamStatus>("ACTIVE");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ siteId, name, capacity: capacity ? Number(capacity) : null, currentLevel: currentLevel ? Number(currentLevel) : null, status });
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
          <label className={labelClass}>{t("resources.damName")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("resources.capacity")}</label>
          <input className={inputClass} type="number" step="any" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("resources.currentLevel")}</label>
          <input className={inputClass} type="number" step="any" value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as PollutionDamStatus)}>
          {damStatuses.map((s) => <option key={s} value={s}>{t(`resources.damStatuses.${s}`)}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function DamsTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [dams, setDams] = useState<PollutionControlDam[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<PollutionControlDam[]>("/resources/pollution-dams");
      setDams(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/resources/pollution-dams", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/resources/pollution-dams/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("resources.newDam")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("resources.damName")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("resources.currentLevel")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {dams.map((d) => (
              <tr key={d.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{d.name}</td>
                <td className="px-4 py-2 text-mine-300">{d.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{d.currentLevel ?? "—"} {d.capacity ? `/ ${d.capacity}` : ""} {d.unit}</td>
                <td className="px-4 py-2"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(d.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {dams.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("resources.noDams")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("resources.newDamTitle")} onClose={() => setModal(false)}>
          <DamForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

function AmdTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [readings, setReadings] = useState<AcidMineDrainageReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [monitoringPoint, setMonitoringPoint] = useState("");
  const [readingDate, setReadingDate] = useState("");
  const [ph, setPh] = useState("");
  const [sulfateConcentration, setSulfateConcentration] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<AcidMineDrainageReading[]>("/resources/amd-readings");
      setReadings(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/resources/amd-readings", { siteId, monitoringPoint, readingDate, ph: Number(ph), sulfateConcentration: sulfateConcentration ? Number(sulfateConcentration) : null });
      setModal(false);
      setMonitoringPoint("");
      setPh("");
      setSulfateConcentration("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`/resources/amd-readings/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("resources.amdHint")}</p>
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("resources.newAmdReading")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("resources.monitoringPoint")}</th>
              <th className="text-left px-4 py-2">{t("groundControl.readingDate")}</th>
              <th className="text-left px-4 py-2">{t("resources.ph")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{r.monitoringPoint}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(r.readingDate).toLocaleDateString()}</td>
                <td className={`px-4 py-2 ${!r.withinLimits ? "text-danger-500 font-semibold" : "text-mine-300"}`}>{r.ph}</td>
                <td className="px-4 py-2">{r.withinLimits ? <span className="text-success-500">{t("resources.withinLimits")}</span> : <span className="text-danger-500">{t("resources.exceedsLimits")}</span>}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {readings.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("resources.noAmdReadings")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("resources.newAmdReadingTitle")} onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("common.site")}</label>
                <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("resources.monitoringPoint")}</label>
                <input className={inputClass} value={monitoringPoint} onChange={(e) => setMonitoringPoint(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("groundControl.readingDate")}</label>
                <DateField value={readingDate} onChange={setReadingDate} required />
              </div>
              <div>
                <label className={labelClass}>{t("resources.ph")}</label>
                <input className={inputClass} type="number" step="any" value={ph} onChange={(e) => setPh(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t("resources.sulfateConcentration")}</label>
              <input className={inputClass} type="number" step="any" value={sulfateConcentration} onChange={(e) => setSulfateConcentration(e.target.value)} />
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

function EnergyTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<EnergyConsumptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [recordMonth, setRecordMonth] = useState("");
  const [gridConsumptionKwh, setGridConsumptionKwh] = useState("");
  const [renewableConsumptionKwh, setRenewableConsumptionKwh] = useState("0");
  const [dieselConsumptionLiters, setDieselConsumptionLiters] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<EnergyConsumptionRecord[]>("/resources/energy");
      setRecords(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/resources/energy", {
        siteId, recordMonth, gridConsumptionKwh: Number(gridConsumptionKwh),
        renewableConsumptionKwh: Number(renewableConsumptionKwh), dieselConsumptionLiters: dieselConsumptionLiters ? Number(dieselConsumptionLiters) : null,
      });
      setModal(false);
      setGridConsumptionKwh("");
      setDieselConsumptionLiters("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`/resources/energy/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("resources.newEnergyRecord")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("resources.recordMonth")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("resources.gridConsumption")}</th>
              <th className="text-left px-4 py-2">{t("resources.renewableConsumption")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{new Date(r.recordMonth).toLocaleDateString(undefined, { year: "numeric", month: "short" })}</td>
                <td className="px-4 py-2 text-mine-300">{r.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{r.gridConsumptionKwh.toLocaleString()} kWh</td>
                <td className="px-4 py-2 text-success-500">{r.renewableConsumptionKwh.toLocaleString()} kWh</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("resources.noEnergyRecords")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("resources.newEnergyRecordTitle")} onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("common.site")}</label>
                <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("resources.recordMonth")}</label>
                <DateField value={recordMonth} onChange={setRecordMonth} required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>{t("resources.gridConsumption")}</label>
                <input className={inputClass} type="number" step="any" value={gridConsumptionKwh} onChange={(e) => setGridConsumptionKwh(e.target.value)} required />
              </div>
              <div>
                <label className={labelClass}>{t("resources.renewableConsumption")}</label>
                <input className={inputClass} type="number" step="any" value={renewableConsumptionKwh} onChange={(e) => setRenewableConsumptionKwh(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>{t("resources.dieselConsumption")}</label>
                <input className={inputClass} type="number" step="any" value={dieselConsumptionLiters} onChange={(e) => setDieselConsumptionLiters(e.target.value)} />
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

function GhgTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<GhgEmissionsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);
  const [reportingYear, setReportingYear] = useState(new Date().getFullYear().toString());
  const [scope1TonnesCO2e, setScope1TonnesCO2e] = useState("");
  const [scope2TonnesCO2e, setScope2TonnesCO2e] = useState("");
  const [carbonTaxLiability, setCarbonTaxLiability] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<GhgEmissionsRecord[]>("/resources/ghg-emissions");
      setRecords(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/resources/ghg-emissions", {
        reportingYear: Number(reportingYear), scope1TonnesCO2e: Number(scope1TonnesCO2e),
        scope2TonnesCO2e: Number(scope2TonnesCO2e), carbonTaxLiability: carbonTaxLiability ? Number(carbonTaxLiability) : null,
      });
      setModal(false);
      setScope1TonnesCO2e("");
      setScope2TonnesCO2e("");
      setCarbonTaxLiability("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`/resources/ghg-emissions/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("resources.ghgHint")}</p>
      {canEdit && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("resources.newGhgRecord")}</button>
        </div>
      )}
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("employmentEquity.reportingYear")}</th>
              <th className="text-left px-4 py-2">{t("resources.scope1")}</th>
              <th className="text-left px-4 py-2">{t("resources.scope2")}</th>
              <th className="text-left px-4 py-2">{t("resources.carbonTaxLiability")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{r.reportingYear}</td>
                <td className="px-4 py-2 text-mine-300">{r.scope1TonnesCO2e.toLocaleString()} t</td>
                <td className="px-4 py-2 text-mine-300">{r.scope2TonnesCO2e.toLocaleString()} t</td>
                <td className="px-4 py-2 text-mine-300">{r.carbonTaxLiability != null ? `${r.currency} ${r.carbonTaxLiability.toLocaleString()}` : "—"}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete && <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("resources.noGhgRecords")}</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={t("resources.newGhgRecordTitle")} onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>{t("employmentEquity.reportingYear")}</label>
              <input className={inputClass} type="number" value={reportingYear} onChange={(e) => setReportingYear(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("resources.scope1")}</label>
                <input className={inputClass} type="number" step="any" value={scope1TonnesCO2e} onChange={(e) => setScope1TonnesCO2e(e.target.value)} required />
              </div>
              <div>
                <label className={labelClass}>{t("resources.scope2")}</label>
                <input className={inputClass} type="number" step="any" value={scope2TonnesCO2e} onChange={(e) => setScope2TonnesCO2e(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t("resources.carbonTaxLiability")}</label>
              <input className={inputClass} type="number" step="any" value={carbonTaxLiability} onChange={(e) => setCarbonTaxLiability(e.target.value)} />
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

export default function ResourceManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"water" | "dams" | "amd" | "energy" | "ghg">("water");
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoading(true);
    setLoadError(false);
    api
      .get<Site[]>("/sites")
      .then((res) => setSites(res.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("resources.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("resources.subtitle")}</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className={tab === "water" ? buttonPrimary : buttonSecondary} onClick={() => setTab("water")}>{t("resources.tabWater")}</button>
        <button className={tab === "dams" ? buttonPrimary : buttonSecondary} onClick={() => setTab("dams")}>{t("resources.tabDams")}</button>
        <button className={tab === "amd" ? buttonPrimary : buttonSecondary} onClick={() => setTab("amd")}>{t("resources.tabAmd")}</button>
        <button className={tab === "energy" ? buttonPrimary : buttonSecondary} onClick={() => setTab("energy")}>{t("resources.tabEnergy")}</button>
        <button className={tab === "ghg" ? buttonPrimary : buttonSecondary} onClick={() => setTab("ghg")}>{t("resources.tabGhg")}</button>
      </div>
      {tab === "water" && <WaterBalanceTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "dams" && <DamsTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "amd" && <AmdTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "energy" && <EnergyTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "ghg" && <GhgTab canEdit={canEdit} canDelete={canDelete} />}
    </div>
  );
}
