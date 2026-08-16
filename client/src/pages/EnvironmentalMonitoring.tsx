import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { EnvironmentalParameterType, EnvironmentalReading, Site } from "../api/types";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import WeatherMonitoring from "./WeatherMonitoring";
import LoadError from "../components/LoadError";

const parameterTypes: EnvironmentalParameterType[] = ["WATER_QUALITY", "AIR_QUALITY", "DUST", "NOISE", "TAILINGS_DAM_LEVEL"];

function ReadingForm({ sites, onSubmit, onCancel }: {
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [monitoringPoint, setMonitoringPoint] = useState("");
  const [parameterType, setParameterType] = useState<EnvironmentalParameterType>("WATER_QUALITY");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [thresholdMin, setThresholdMin] = useState("");
  const [thresholdMax, setThresholdMax] = useState("");
  const [withinLimits, setWithinLimits] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        monitoringPoint,
        parameterType,
        value: Number(value),
        unit,
        thresholdMin: thresholdMin ? Number(thresholdMin) : null,
        thresholdMax: thresholdMax ? Number(thresholdMax) : null,
        withinLimits,
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
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("environmental.parameterType")}</label>
          <select className={selectClass} value={parameterType} onChange={(e) => setParameterType(e.target.value as EnvironmentalParameterType)}>
            {parameterTypes.map((p) => <option key={p} value={p}>{t(`environmental.parameterTypes.${p}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("environmental.monitoringPoint")}</label>
        <input className={inputClass} value={monitoringPoint} onChange={(e) => setMonitoringPoint(e.target.value)} required placeholder={t("environmental.monitoringPointPlaceholder") ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("environmental.value")}</label>
          <input className={inputClass} type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("inventory.unit")}</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("environmental.thresholdMin")}</label>
          <input className={inputClass} type="number" step="any" value={thresholdMin} onChange={(e) => setThresholdMin(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("environmental.thresholdMax")}</label>
          <input className={inputClass} type="number" step="any" value={thresholdMax} onChange={(e) => setThresholdMax(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withinLimits} onChange={(e) => setWithinLimits(e.target.checked)} />
        {t("environmental.withinLimits")}
      </label>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function EnvironmentalMonitoring() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"readings" | "weather">("readings");
  const [readings, setReadings] = useState<EnvironmentalReading[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [outOfLimitsOnly, setOutOfLimitsOnly] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [r, s] = await Promise.all([
        api.get<EnvironmentalReading[]>("/environmental", { params: outOfLimitsOnly ? { outOfLimitsOnly: "true" } : undefined }),
        api.get<Site[]>("/sites"),
      ]);
      setReadings(r.data);
      setSites(s.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outOfLimitsOnly]);

  async function create(data: any) {
    await api.post("/environmental", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("environmental.confirmDelete"))) return;
    await api.delete(`/environmental/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("environmental.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("environmental.subtitle")}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className={tab === "readings" ? buttonPrimary : buttonSecondary} onClick={() => setTab("readings")}>
          {t("environmental.tabReadings")}
        </button>
        <button className={tab === "weather" ? buttonPrimary : buttonSecondary} onClick={() => setTab("weather")}>
          {t("weather.nav")}
        </button>
      </div>

      {tab === "weather" && <WeatherMonitoring />}

      {tab === "readings" && (
      <div className="space-y-4">
      <div className="flex items-center justify-end flex-wrap gap-3">
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("environmental.newReading")}</button>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-mine-300">
        <input type="checkbox" checked={outOfLimitsOnly} onChange={(e) => setOutOfLimitsOnly(e.target.checked)} />
        {t("environmental.outOfLimitsOnly")}
      </label>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("environmental.monitoringPoint")}</th>
              <th className="text-left px-4 py-2">{t("environmental.parameterType")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("environmental.value")}</th>
              <th className="text-left px-4 py-2"></th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{r.monitoringPoint}</td>
                <td className="px-4 py-2 text-mine-300">{t(`environmental.parameterTypes.${r.parameterType}`)}</td>
                <td className="px-4 py-2 text-mine-300">{r.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{r.value} {r.unit}</td>
                <td className="px-4 py-2">
                  {!r.withinLimits && (
                    <span className="text-danger-500 text-xs font-semibold">{t("environmental.outOfLimits")}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {canDelete && (
                    <button className={buttonDanger} onClick={() => remove(r.id)}>{t("common.delete")}</button>
                  )}
                </td>
              </tr>
            ))}
            {readings.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("environmental.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={t("environmental.newReadingTitle")} onClose={() => setModal(false)}>
          <ReadingForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
      </div>
      )}
    </div>
  );
}
