import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Site, WeatherCondition, WeatherReading } from "../api/types";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import LoadError from "../components/LoadError";

const conditions: WeatherCondition[] = ["CLEAR", "CLOUDY", "RAIN", "STORM", "FOG", "HIGH_WIND"];

function ReadingForm({ sites, onSubmit, onCancel }: {
  sites: Site[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [temperature, setTemperature] = useState("");
  const [windSpeed, setWindSpeed] = useState("");
  const [windDirection, setWindDirection] = useState("");
  const [precipitation, setPrecipitation] = useState("");
  const [condition, setCondition] = useState<WeatherCondition>("CLEAR");
  const [lightningDetected, setLightningDetected] = useState(false);
  const [alertIssued, setAlertIssued] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        temperature: temperature ? Number(temperature) : null,
        windSpeed: windSpeed ? Number(windSpeed) : null,
        windDirection: windDirection || undefined,
        precipitation: precipitation ? Number(precipitation) : null,
        condition,
        lightningDetected,
        alertIssued,
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
          <label className={labelClass}>{t("weather.condition")}</label>
          <select className={selectClass} value={condition} onChange={(e) => setCondition(e.target.value as WeatherCondition)}>
            {conditions.map((c) => <option key={c} value={c}>{t(`weather.conditions.${c}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("weather.temperature")}</label>
          <input className={inputClass} type="number" step="any" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("weather.windSpeed")}</label>
          <input className={inputClass} type="number" step="any" value={windSpeed} onChange={(e) => setWindSpeed(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("weather.windDirection")}</label>
          <input className={inputClass} value={windDirection} onChange={(e) => setWindDirection(e.target.value)} placeholder="NE" />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("weather.precipitation")}</label>
        <input className={inputClass} type="number" step="any" value={precipitation} onChange={(e) => setPrecipitation(e.target.value)} />
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lightningDetected} onChange={(e) => setLightningDetected(e.target.checked)} />
          {t("weather.lightningDetected")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={alertIssued} onChange={(e) => setAlertIssued(e.target.checked)} />
          {t("weather.alertIssued")}
        </label>
      </div>
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

export default function WeatherMonitoring() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [readings, setReadings] = useState<WeatherReading[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [r, s] = await Promise.all([
        api.get<WeatherReading[]>("/weather"),
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
  }, []);

  async function create(data: any) {
    await api.post("/weather", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("weather.confirmDelete"))) return;
    await api.delete(`/weather/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end flex-wrap gap-3">
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("weather.newReading")}</button>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("weather.recordedAt")}</th>
              <th className="text-left px-4 py-2">{t("common.site")}</th>
              <th className="text-left px-4 py-2">{t("weather.condition")}</th>
              <th className="text-left px-4 py-2">{t("weather.temperature")}</th>
              <th className="text-left px-4 py-2">{t("weather.windSpeed")}</th>
              <th className="text-left px-4 py-2"></th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{new Date(r.recordedAt).toLocaleString()}</td>
                <td className="px-4 py-2 text-mine-300">{r.site?.name}</td>
                <td className="px-4 py-2 text-mine-300">{t(`weather.conditions.${r.condition}`)}</td>
                <td className="px-4 py-2 text-mine-300">{r.temperature != null ? `${r.temperature}°C` : "—"}</td>
                <td className="px-4 py-2 text-mine-300">{r.windSpeed != null ? `${r.windSpeed} km/h ${r.windDirection ?? ""}` : "—"}</td>
                <td className="px-4 py-2">
                  {(r.lightningDetected || r.alertIssued) && (
                    <span className="text-danger-500 text-xs font-semibold">
                      {r.alertIssued ? t("weather.alertIssued") : t("weather.lightningDetected")}
                    </span>
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
              <tr><td colSpan={7} className="px-4 py-6 text-center text-mine-400">{t("weather.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={t("weather.newReadingTitle")} onClose={() => setModal(false)}>
          <ReadingForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}
