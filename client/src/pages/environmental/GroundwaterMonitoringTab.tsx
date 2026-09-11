import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { BoreholeStatus, BoreholeType, MonitoringBorehole, Site } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import StatTile from "../plant/StatTile";

const boreholeTypes: BoreholeType[] = ["UPGRADIENT", "DOWNGRADIENT", "SUPPLY", "OTHER"];
const boreholeStatuses: BoreholeStatus[] = ["ACTIVE", "DECOMMISSIONED", "DRY"];

function BoreholeForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: MonitoringBorehole;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [identifier, setIdentifier] = useState(initial?.identifier ?? "");
  const [boreholeType, setBoreholeType] = useState<BoreholeType>(initial?.boreholeType ?? "OTHER");
  const [latitude, setLatitude] = useState(initial?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(initial?.longitude?.toString() ?? "");
  const [installedDate, setInstalledDate] = useState(initial?.installedDate?.slice(0, 10) ?? "");
  const [staticWaterLevelBaselineM, setStaticWaterLevelBaselineM] = useState(initial?.staticWaterLevelBaselineM?.toString() ?? "");
  const [status, setStatus] = useState<BoreholeStatus>(initial?.status ?? "ACTIVE");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        identifier,
        boreholeType,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        installedDate: installedDate || null,
        staticWaterLevelBaselineM: staticWaterLevelBaselineM ? Number(staticWaterLevelBaselineM) : null,
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
          <label className={labelClass}>{t("environmentalRegisters.groundwater.identifier")}</label>
          <input className={inputClass} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.groundwater.boreholeType")}</label>
          <select className={selectClass} value={boreholeType} onChange={(e) => setBoreholeType(e.target.value as BoreholeType)}>
            {boreholeTypes.map((v) => <option key={v} value={v}>{t(`environmentalRegisters.groundwater.types.${v}`)}</option>)}
          </select>
        </div>
      </div>
      <p className="text-[11px] text-mine-400">{t("environmentalRegisters.groundwater.typeHint")}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.groundwater.installedDate")}</label>
          <DateField value={installedDate} onChange={setInstalledDate} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.groundwater.latitude")}</label>
          <input className={inputClass} type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.groundwater.longitude")}</label>
          <input className={inputClass} type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.groundwater.baselineLevel")}</label>
          <input className={inputClass} type="number" step="0.01" value={staticWaterLevelBaselineM} onChange={(e) => setStaticWaterLevelBaselineM(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as BoreholeStatus)}>
          {boreholeStatuses.map((s) => <option key={s} value={s}>{t(`environmentalRegisters.groundwater.statuses.${s}`)}</option>)}
        </select>
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

function ReadingForm({ borehole, onSubmit, onCancel }: {
  borehole: MonitoringBorehole;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [readingDate, setReadingDate] = useState(new Date().toISOString().slice(0, 10));
  const [waterLevelMbgl, setWaterLevelMbgl] = useState("");
  const [ph, setPh] = useState("");
  const [electricalConductivity, setElectricalConductivity] = useState("");
  const [totalDissolvedSolids, setTotalDissolvedSolids] = useState("");
  const [sulfateConcentration, setSulfateConcentration] = useState("");
  const [withinLimits, setWithinLimits] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        readingDate,
        waterLevelMbgl: waterLevelMbgl ? Number(waterLevelMbgl) : null,
        ph: ph ? Number(ph) : null,
        electricalConductivity: electricalConductivity ? Number(electricalConductivity) : null,
        totalDissolvedSolids: totalDissolvedSolids ? Number(totalDissolvedSolids) : null,
        sulfateConcentration: sulfateConcentration ? Number(sulfateConcentration) : null,
        withinLimits,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-mine-400">{t("environmentalRegisters.groundwater.readingHint", { identifier: borehole.identifier })}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.groundwater.readingDate")}</label>
          <DateField value={readingDate} onChange={setReadingDate} />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.groundwater.waterLevelMbgl")}</label>
          <input className={inputClass} type="number" step="0.01" value={waterLevelMbgl} onChange={(e) => setWaterLevelMbgl(e.target.value)} />
          {borehole.staticWaterLevelBaselineM != null && (
            <p className="text-[11px] text-mine-400 mt-1">{t("environmentalRegisters.groundwater.baselineNote", { level: borehole.staticWaterLevelBaselineM })}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("environmentalRegisters.groundwater.ph")}</label>
          <input className={inputClass} type="number" min={0} max={14} step="0.1" value={ph} onChange={(e) => setPh(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.groundwater.electricalConductivity")}</label>
          <input className={inputClass} type="number" min={0} step="0.1" value={electricalConductivity} onChange={(e) => setElectricalConductivity(e.target.value)} placeholder="mS/m" />
        </div>
        <div>
          <label className={labelClass}>{t("environmentalRegisters.groundwater.totalDissolvedSolids")}</label>
          <input className={inputClass} type="number" min={0} step="0.1" value={totalDissolvedSolids} onChange={(e) => setTotalDissolvedSolids(e.target.value)} placeholder="mg/L" />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("environmentalRegisters.groundwater.sulfateConcentration")}</label>
        <input className={inputClass} type="number" min={0} step="0.1" value={sulfateConcentration} onChange={(e) => setSulfateConcentration(e.target.value)} placeholder="mg/L" />
      </div>
      <label className="flex items-center gap-2 text-sm text-mine-200">
        <input type="checkbox" checked={withinLimits} onChange={(e) => setWithinLimits(e.target.checked)} />
        {t("environmentalRegisters.groundwater.withinLimits")}
      </label>
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

export default function GroundwaterMonitoringTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [boreholes, setBoreholes] = useState<MonitoringBorehole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formModal, setFormModal] = useState<null | "create" | MonitoringBorehole>(null);
  const [readingModal, setReadingModal] = useState<MonitoringBorehole | null>(null);
  const [historyFor, setHistoryFor] = useState<MonitoringBorehole | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<MonitoringBorehole[]>("/groundwater-monitoring/boreholes");
      setBoreholes(res.data);
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
    const active = boreholes.filter((b) => b.status === "ACTIVE");
    const noBaseline = active.filter((b) => b.staticWaterLevelBaselineM == null).length;
    const noRecentReading = active.filter((b) => !b.readings || b.readings.length === 0).length;
    const outOfLimits = active.filter((b) => b.readings?.[0] && !b.readings[0].withinLimits).length;
    // Drawdown: a rising "metres below ground level" reading means the water
    // table is falling. More than 10% below baseline is flagged as a trend worth
    // investigating, not an exceedance in itself — groundwater quality limits are
    // what withinLimits already checks.
    const drawingDown = active.filter((b) => {
      const latest = b.readings?.[0]?.waterLevelMbgl;
      if (latest == null || b.staticWaterLevelBaselineM == null || b.staticWaterLevelBaselineM <= 0) return false;
      return latest > b.staticWaterLevelBaselineM * 1.1;
    }).length;
    return { active: active.length, noBaseline, noRecentReading, outOfLimits, drawingDown };
  }, [boreholes]);

  async function create(data: any) {
    await api.post("/groundwater-monitoring/boreholes", data);
    setFormModal(null);
    await load();
  }
  async function update(id: string, data: any) {
    await api.put(`/groundwater-monitoring/boreholes/${id}`, data);
    setFormModal(null);
    await load();
  }
  async function remove(id: string) {
    if (!confirm(t("environmentalRegisters.groundwater.confirmDelete"))) return;
    await api.delete(`/groundwater-monitoring/boreholes/${id}`);
    await load();
  }
  async function addReading(id: string, data: any) {
    await api.post(`/groundwater-monitoring/boreholes/${id}/readings`, data);
    setReadingModal(null);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const columns: DataTableColumn<MonitoringBorehole>[] = [
    { key: "identifier", header: t("environmentalRegisters.groundwater.identifier"), render: (b) => b.identifier, sortValue: (b) => b.identifier },
    { key: "boreholeType", header: t("environmentalRegisters.groundwater.boreholeType"), render: (b) => t(`environmentalRegisters.groundwater.types.${b.boreholeType}`), sortValue: (b) => b.boreholeType },
    { key: "site", header: t("common.site"), render: (b) => b.site?.name ?? "—", sortValue: (b) => b.site?.name ?? "" },
    {
      key: "latestLevel",
      header: t("environmentalRegisters.groundwater.latestLevel"),
      render: (b) => {
        const latest = b.readings?.[0];
        if (!latest || latest.waterLevelMbgl == null) return <span className="text-hazard-500">{t("environmentalRegisters.notSet")}</span>;
        const drawn = b.staticWaterLevelBaselineM != null && latest.waterLevelMbgl > b.staticWaterLevelBaselineM * 1.1;
        return <span className={drawn ? "text-hazard-500 font-semibold" : "text-mine-200"}>{latest.waterLevelMbgl.toFixed(2)} m</span>;
      },
      sortValue: (b) => b.readings?.[0]?.waterLevelMbgl ?? -1,
    },
    { key: "baseline", header: t("environmentalRegisters.groundwater.baselineLevel"), render: (b) => (b.staticWaterLevelBaselineM != null ? `${b.staticWaterLevelBaselineM.toFixed(2)} m` : "—"), sortValue: (b) => b.staticWaterLevelBaselineM ?? -1 },
    {
      key: "lastReading",
      header: t("environmentalRegisters.groundwater.lastReadingStatus"),
      render: (b) => (b.readings?.[0] ? <StatusBadge status={b.readings[0].withinLimits ? "PASS" : "FAIL"} /> : <span className="text-hazard-500">{t("environmentalRegisters.groundwater.noReadingsYet")}</span>),
      sortValue: (b) => (b.readings?.[0]?.withinLimits ? 1 : 0),
    },
    { key: "status", header: t("common.status"), render: (b) => <StatusBadge status={b.status} />, sortValue: (b) => b.status },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label={t("environmentalRegisters.groundwater.statOutOfLimits")}
          value={stats.outOfLimits}
          target={t("environmentalRegisters.targetZero")}
          tone={stats.outOfLimits === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("environmentalRegisters.groundwater.statDrawingDown")}
          value={stats.drawingDown}
          target={t("environmentalRegisters.groundwater.statDrawingDownTarget")}
          tone={stats.drawingDown === 0 ? "good" : "warn"}
        />
        <StatTile
          label={t("environmentalRegisters.groundwater.statNoReading")}
          value={stats.noRecentReading}
          target={t("environmentalRegisters.targetZero")}
          tone={stats.noRecentReading === 0 ? "good" : "warn"}
        />
        <StatTile label={t("environmentalRegisters.groundwater.statActive")} value={stats.active} target={t("environmentalRegisters.groundwater.statActiveTarget")} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("environmentalRegisters.groundwater.registerTitle")}</h2>
            <p className="text-xs text-mine-400">{t("environmentalRegisters.groundwater.registerHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setFormModal("create")} disabled={sites.length === 0}>{t("environmentalRegisters.groundwater.newBorehole")}</button>}
        </div>
        <DataTable
          columns={columns}
          rows={boreholes}
          rowKey={(b) => b.id}
          emptyMessage={t("environmentalRegisters.groundwater.noneYet")}
          searchValue={(b) => b.identifier}
          exportFilename="monitoring-boreholes"
          exportColumns={[
            { header: t("environmentalRegisters.groundwater.identifier"), value: (b) => b.identifier },
            { header: t("environmentalRegisters.groundwater.boreholeType"), value: (b) => b.boreholeType },
            { header: t("common.site"), value: (b) => b.site?.name ?? "" },
            { header: t("common.status"), value: (b) => b.status },
          ]}
          actions={(b) => (
            <div className="flex justify-end gap-2">
              <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setHistoryFor(b)}>{t("plantIntegrity.history")}</button>
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setReadingModal(b)}>{t("environmentalRegisters.groundwater.logReading")}</button>}
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setFormModal(b)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => remove(b.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {formModal && (
        <Modal title={formModal === "create" ? t("environmentalRegisters.groundwater.newBoreholeTitle") : t("environmentalRegisters.groundwater.editBoreholeTitle")} onClose={() => setFormModal(null)}>
          <BoreholeForm
            sites={sites}
            initial={formModal === "create" ? undefined : formModal}
            onSubmit={(data) => (formModal === "create" ? create(data) : update(formModal.id, data))}
            onCancel={() => setFormModal(null)}
          />
        </Modal>
      )}

      {readingModal && (
        <Modal title={t("environmentalRegisters.groundwater.logReading")} onClose={() => setReadingModal(null)}>
          <ReadingForm borehole={readingModal} onSubmit={(data) => addReading(readingModal.id, data)} onCancel={() => setReadingModal(null)} />
        </Modal>
      )}

      {historyFor && (
        <Modal title={t("plantIntegrity.historyTitle", { identifier: historyFor.identifier })} onClose={() => setHistoryFor(null)}>
          {historyFor.readings && historyFor.readings.length > 0 ? (
            <ul className="space-y-3">
              {historyFor.readings.map((r) => (
                <li key={r.id} className="border-b border-mine-800 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-mine-100">{new Date(r.readingDate).toLocaleDateString()}</span>
                    <StatusBadge status={r.withinLimits ? "PASS" : "FAIL"} />
                  </div>
                  <p className="text-xs text-mine-400">
                    {r.waterLevelMbgl != null ? `${t("environmentalRegisters.groundwater.waterLevelMbgl")}: ${r.waterLevelMbgl} m` : ""}
                    {r.ph != null ? ` · pH ${r.ph}` : ""}
                    {r.electricalConductivity != null ? ` · EC ${r.electricalConductivity} mS/m` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mine-400">{t("plantIntegrity.noHistory")}</p>
          )}
        </Modal>
      )}
    </div>
  );
}
