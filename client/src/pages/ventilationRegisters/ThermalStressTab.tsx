import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Site, ThermalStationStatus, ThermalStressStation, Zone } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import StatTile from "../plant/StatTile";

const stationStatuses: ThermalStationStatus[] = ["ACTIVE", "INACTIVE", "DECOMMISSIONED"];

function StationForm({ sites, zones, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  initial?: ThermalStressStation;
  onSubmit: (d: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [identifier, setIdentifier] = useState(initial?.identifier ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [virginRockTemperatureC, setVirginRockTemperatureC] = useState(initial?.virginRockTemperatureC?.toString() ?? "");
  const [wetBulbLimitC, setWetBulbLimitC] = useState(initial?.wetBulbLimitC?.toString() ?? "");
  const [coolingServed, setCoolingServed] = useState(initial?.coolingServed ?? "");
  const [status, setStatus] = useState<ThermalStationStatus>(initial?.status ?? "ACTIVE");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const siteZones = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        zoneId: zoneId || null,
        identifier,
        location: location || undefined,
        virginRockTemperatureC: virginRockTemperatureC ? Number(virginRockTemperatureC) : null,
        wetBulbLimitC: wetBulbLimitC ? Number(wetBulbLimitC) : null,
        coolingServed: coolingServed || undefined,
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
          <label className={labelClass}>{t("ventilationRegisters.thermal.identifier")}</label>
          <input className={inputClass} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.location")}</label>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }} required>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">{t("ventilationRegisters.thermal.noZone")}</option>
            {siteZones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.thermal.wetBulbLimit")}</label>
          <input className={inputClass} type="number" step="0.1" value={wetBulbLimitC} onChange={(e) => setWetBulbLimitC(e.target.value)} />
          <p className="text-[11px] text-mine-400 mt-1">{t("ventilationRegisters.thermal.wetBulbLimitHint")}</p>
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.thermal.virginRockTemperature")}</label>
          <input className={inputClass} type="number" step="0.1" value={virginRockTemperatureC} onChange={(e) => setVirginRockTemperatureC(e.target.value)} />
          <p className="text-[11px] text-mine-400 mt-1">{t("ventilationRegisters.thermal.vrtHint")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.thermal.coolingServed")}</label>
          <input className={inputClass} value={coolingServed} onChange={(e) => setCoolingServed(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ThermalStationStatus)}>
            {stationStatuses.map((s) => <option key={s} value={s}>{t(`ventilationRegisters.thermal.statuses.${s}`)}</option>)}
          </select>
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

function ReadingForm({ station, onSubmit, onCancel }: {
  station: ThermalStressStation;
  onSubmit: (d: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [readingDate, setReadingDate] = useState(new Date().toISOString().slice(0, 10));
  const [wetBulbC, setWetBulbC] = useState("");
  const [dryBulbC, setDryBulbC] = useState("");
  const [airVelocityMs, setAirVelocityMs] = useState("");
  const [measuredByName, setMeasuredByName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const overLimit = station.wetBulbLimitC != null && wetBulbC !== "" && Number(wetBulbC) > station.wetBulbLimitC;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        readingDate,
        wetBulbC: Number(wetBulbC),
        dryBulbC: dryBulbC ? Number(dryBulbC) : null,
        airVelocityMs: airVelocityMs ? Number(airVelocityMs) : null,
        measuredByName: measuredByName || undefined,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-mine-400">
        {station.wetBulbLimitC != null
          ? t("ventilationRegisters.thermal.readingHintWithLimit", { identifier: station.identifier, limit: station.wetBulbLimitC })
          : t("ventilationRegisters.thermal.readingHintNoLimit", { identifier: station.identifier })}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.thermal.readingDate")}</label>
          <DateField value={readingDate} onChange={setReadingDate} />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.thermal.measuredBy")}</label>
          <input className={inputClass} value={measuredByName} onChange={(e) => setMeasuredByName(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.thermal.wetBulb")}</label>
          <input className={inputClass} type="number" step="0.1" value={wetBulbC} onChange={(e) => setWetBulbC(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.thermal.dryBulb")}</label>
          <input className={inputClass} type="number" step="0.1" value={dryBulbC} onChange={(e) => setDryBulbC(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.thermal.airVelocity")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={airVelocityMs} onChange={(e) => setAirVelocityMs(e.target.value)} />
        </div>
      </div>
      {overLimit && <p className="text-xs text-danger-500">{t("ventilationRegisters.thermal.overLimitWarning")}</p>}
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

export default function ThermalStressTab({ sites, zones }: { sites: Site[]; zones: Zone[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [stations, setStations] = useState<ThermalStressStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formModal, setFormModal] = useState<null | "create" | ThermalStressStation>(null);
  const [readingModal, setReadingModal] = useState<ThermalStressStation | null>(null);
  const [historyFor, setHistoryFor] = useState<ThermalStressStation | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ThermalStressStation[]>("/thermal-stress/stations");
      setStations(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const active = stations.filter((s) => s.status === "ACTIVE");
    const overLimit = active.filter((s) => s.readings?.[0] && !s.readings[0].withinLimit).length;
    const noLimitSet = active.filter((s) => s.wetBulbLimitC == null).length;
    const neverMeasured = active.filter((s) => !s.readings || s.readings.length === 0).length;
    const hottest = active
      .map((s) => s.readings?.[0]?.wetBulbC)
      .filter((v): v is number => v != null)
      .reduce<number | null>((max, v) => (max == null || v > max ? v : max), null);
    return { active: active.length, overLimit, noLimitSet, neverMeasured, hottest };
  }, [stations]);

  async function create(d: any) { await api.post("/thermal-stress/stations", d); setFormModal(null); await load(); }
  async function update(id: string, d: any) { await api.put(`/thermal-stress/stations/${id}`, d); setFormModal(null); await load(); }
  async function remove(id: string) {
    if (!confirm(t("ventilationRegisters.thermal.confirmDelete"))) return;
    await api.delete(`/thermal-stress/stations/${id}`);
    await load();
  }
  async function logReading(id: string, d: any) { await api.post(`/thermal-stress/stations/${id}/readings`, d); setReadingModal(null); await load(); }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const columns: DataTableColumn<ThermalStressStation>[] = [
    { key: "identifier", header: t("ventilationRegisters.thermal.identifier"), render: (s) => s.identifier, sortValue: (s) => s.identifier },
    { key: "site", header: t("common.site"), render: (s) => `${s.site?.name ?? "—"}${s.zone ? ` · ${s.zone.name}` : ""}`, sortValue: (s) => s.site?.name ?? "" },
    {
      key: "latestWetBulb",
      header: t("ventilationRegisters.thermal.latestWetBulb"),
      render: (s) => {
        const latest = s.readings?.[0];
        if (!latest) return <span className="text-hazard-500">{t("ventilationRegisters.thermal.neverMeasured")}</span>;
        return (
          <span className={latest.withinLimit ? "text-mine-200" : "text-danger-500 font-semibold"}>
            {latest.wetBulbC.toFixed(1)} °C
          </span>
        );
      },
      sortValue: (s) => s.readings?.[0]?.wetBulbC ?? -1,
    },
    {
      key: "wetBulbLimitC",
      header: t("ventilationRegisters.thermal.limitShort"),
      render: (s) => (s.wetBulbLimitC != null ? `${s.wetBulbLimitC.toFixed(1)} °C` : <span className="text-hazard-500">{t("ventilationRegisters.notSet")}</span>),
      sortValue: (s) => s.wetBulbLimitC ?? -1,
    },
    {
      key: "vrt",
      header: t("ventilationRegisters.thermal.vrtShort"),
      render: (s) => (s.virginRockTemperatureC != null ? `${s.virginRockTemperatureC.toFixed(1)} °C` : "—"),
      sortValue: (s) => s.virginRockTemperatureC ?? -1,
    },
    { key: "status", header: t("common.status"), render: (s) => <StatusBadge status={s.status} />, sortValue: (s) => s.status },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label={t("ventilationRegisters.thermal.statOverLimit")}
          value={stats.overLimit}
          target={t("ventilationRegisters.targetZero")}
          tone={stats.overLimit === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("ventilationRegisters.thermal.statHottest")}
          value={stats.hottest != null ? `${stats.hottest.toFixed(1)} °C` : "—"}
          target={t("ventilationRegisters.thermal.statHottestTarget")}
        />
        <StatTile
          label={t("ventilationRegisters.thermal.statNeverMeasured")}
          value={stats.neverMeasured}
          target={t("ventilationRegisters.targetZero")}
          tone={stats.neverMeasured === 0 ? "good" : "warn"}
        />
        <StatTile
          label={t("ventilationRegisters.thermal.statNoLimit")}
          value={stats.noLimitSet}
          target={t("ventilationRegisters.targetZero")}
          tone={stats.noLimitSet === 0 ? "good" : "warn"}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("ventilationRegisters.thermal.registerTitle")}</h2>
            <p className="text-xs text-mine-400">{t("ventilationRegisters.thermal.registerHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setFormModal("create")} disabled={sites.length === 0}>{t("ventilationRegisters.thermal.newStation")}</button>}
        </div>
        <DataTable
          columns={columns}
          rows={stations}
          rowKey={(s) => s.id}
          emptyMessage={t("ventilationRegisters.thermal.noneYet")}
          searchValue={(s) => `${s.identifier} ${s.location ?? ""} ${s.coolingServed ?? ""}`}
          exportFilename="thermal-stress-stations"
          exportColumns={[
            { header: t("ventilationRegisters.thermal.identifier"), value: (s) => s.identifier },
            { header: t("common.site"), value: (s) => s.site?.name ?? "" },
            { header: t("ventilationRegisters.thermal.limitShort"), value: (s) => (s.wetBulbLimitC != null ? String(s.wetBulbLimitC) : "") },
            { header: t("ventilationRegisters.thermal.latestWetBulb"), value: (s) => (s.readings?.[0]?.wetBulbC != null ? String(s.readings[0].wetBulbC) : "") },
          ]}
          actions={(s) => (
            <div className="flex justify-end gap-2">
              <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setHistoryFor(s)}>{t("ventilationRegisters.history")}</button>
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setReadingModal(s)}>{t("ventilationRegisters.thermal.logReading")}</button>}
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setFormModal(s)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => remove(s.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {formModal && (
        <Modal title={formModal === "create" ? t("ventilationRegisters.thermal.newStationTitle") : t("ventilationRegisters.thermal.editStationTitle")} onClose={() => setFormModal(null)}>
          <StationForm
            sites={sites}
            zones={zones}
            initial={formModal === "create" ? undefined : formModal}
            onSubmit={(d) => (formModal === "create" ? create(d) : update(formModal.id, d))}
            onCancel={() => setFormModal(null)}
          />
        </Modal>
      )}

      {readingModal && (
        <Modal title={t("ventilationRegisters.thermal.logReading")} onClose={() => setReadingModal(null)}>
          <ReadingForm station={readingModal} onSubmit={(d) => logReading(readingModal.id, d)} onCancel={() => setReadingModal(null)} />
        </Modal>
      )}

      {historyFor && (
        <Modal title={t("ventilationRegisters.historyTitle", { identifier: historyFor.identifier })} onClose={() => setHistoryFor(null)}>
          {historyFor.readings && historyFor.readings.length > 0 ? (
            <ul className="space-y-3">
              {historyFor.readings.map((r) => (
                <li key={r.id} className="border-b border-mine-800 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-mine-100">{new Date(r.readingDate).toLocaleDateString()}</span>
                    <StatusBadge status={r.withinLimit ? "PASS" : "FAIL"} />
                  </div>
                  <p className="text-xs text-mine-400">
                    {t("ventilationRegisters.thermal.wetBulb")}: {r.wetBulbC.toFixed(1)} °C
                    {r.dryBulbC != null ? ` · ${t("ventilationRegisters.thermal.dryBulb")}: ${r.dryBulbC.toFixed(1)} °C` : ""}
                    {r.airVelocityMs != null ? ` · ${r.airVelocityMs} m/s` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mine-400">{t("ventilationRegisters.thermal.noReadingsYet")}</p>
          )}
        </Modal>
      )}
    </div>
  );
}
