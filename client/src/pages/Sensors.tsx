import { Fragment, FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Sensor, SensorCatalog, SensorReading, SensorType, Zone } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";

// The full catalog of sensor types a mine may ever need — surfaced both in the create form
// and in the browsable Sensor Catalog reference tab below.
const sensorTypes: SensorType[] = [
  "METHANE",
  "CARBON_MONOXIDE",
  "OXYGEN",
  "TEMPERATURE",
  "HUMIDITY",
  "SEISMIC",
  "AIR_FLOW",
  "DUST",
  "NOISE",
  "WATER_LEVEL",
  "EQUIPMENT_CONDITION",
  "CARBON_DIOXIDE",
  "NITROGEN_OXIDES",
  "SULFUR_DIOXIDE",
  "HYDROGEN_SULFIDE",
  "RADIATION",
  "SMOKE_FIRE",
  "VIBRATION",
  "PRESSURE",
  "FLOW_RATE",
  "CONVEYOR_ALIGNMENT",
  "PROXIMITY_COLLISION",
  "GPS_LOCATION",
  "PUMP_STATUS",
  "FAN_STATUS",
  "ACCESS_CONTROL",
];

function SensorForm({ zones, initial, defaultType, onSubmit, onCancel }: {
  zones: Zone[];
  initial?: Partial<Sensor>;
  defaultType?: SensorType;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const isNew = !initial?.id;
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<SensorType>(initial?.type ?? defaultType ?? "METHANE");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [minSafe, setMinSafe] = useState(initial?.minSafe?.toString() ?? "0");
  const [maxSafe, setMaxSafe] = useState(initial?.maxSafe?.toString() ?? "100");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? zones[0]?.id ?? "");
  const [status, setStatus] = useState(initial?.status ?? "ACTIVE");
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [serialNumber, setSerialNumber] = useState(initial?.serialNumber ?? "");
  const [requestInstallation, setRequestInstallation] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        name,
        type,
        unit,
        minSafe: Number(minSafe),
        maxSafe: Number(maxSafe),
        zoneId,
        status,
        manufacturer: manufacturer || undefined,
        model: model || undefined,
        serialNumber: serialNumber || undefined,
        requestInstallation: isNew ? requestInstallation : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("sensors.sensorName")}</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.type")}</label>
          <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as SensorType)}>
            {sensorTypes.map((sensorType) => (
              <option key={sensorType} value={sensorType}>{t(`sensors.types.${sensorType}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("sensors.unit")}</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t("sensors.unitPlaceholder") ?? ""} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("sensors.minSafe")}</label>
          <input className={inputClass} type="number" step="any" value={minSafe} onChange={(e) => setMinSafe(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("sensors.maxSafe")}</label>
          <input className={inputClass} type="number" step="any" value={maxSafe} onChange={(e) => setMaxSafe(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.zone")}</label>
        <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)} required>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.site?.name} · {z.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="ACTIVE">{t("sensors.active")}</option>
          <option value="INACTIVE">{t("sensors.inactive")}</option>
          <option value="FAULT">{t("sensors.fault")}</option>
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("sensors.manufacturer")}</label>
          <input className={inputClass} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("sensors.model")}</label>
          <input className={inputClass} value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("sensors.serialNumber")}</label>
          <input className={inputClass} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
        </div>
      </div>
      {isNew && (
        <label className="flex items-start gap-2 text-sm border border-mine-800 rounded-md p-3">
          <input type="checkbox" checked={requestInstallation} onChange={(e) => setRequestInstallation(e.target.checked)} className="mt-0.5" />
          <span>
            <span className="block">{t("sensors.requestInstallation")}</span>
            <span className="block text-xs text-mine-400">{t("sensors.requestInstallationHint")}</span>
          </span>
        </label>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function SensorChart({ sensor, onClose }: { sensor: Sensor; onClose: () => void }) {
  const { t } = useTranslation();
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const socket = useSocket();

  useEffect(() => {
    api.get<SensorReading[]>(`/sensors/${sensor.id}/readings?limit=50`).then((res) => setReadings(res.data));
  }, [sensor.id]);

  useEffect(() => {
    if (!socket) return;
    const handler = (payload: { sensorId: string; value: number; recordedAt: string }) => {
      if (payload.sensorId !== sensor.id) return;
      setReadings((prev) => [...prev.slice(-49), { id: payload.recordedAt, sensorId: sensor.id, value: payload.value, recordedAt: payload.recordedAt }]);
    };
    socket.on("sensor:reading", handler);
    return () => {
      socket.off("sensor:reading", handler);
    };
  }, [socket, sensor.id]);

  const data = readings.map((r) => ({
    time: new Date(r.recordedAt).toLocaleTimeString(),
    value: r.value,
  }));

  return (
    <Modal title={`${sensor.name} — ${t("sensors.liveReadings")}`} onClose={onClose}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#52525b" }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: "#52525b" }} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#fafafa", border: "1px solid #e5e5e5", fontSize: 12 }} />
            <ReferenceLine y={sensor.minSafe} stroke="#e13b2e" strokeDasharray="4 4" />
            <ReferenceLine y={sensor.maxSafe} stroke="#e13b2e" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="value" stroke="#c48a1f" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-mine-400 mt-2">
        {t("sensors.safeRangeLabel", { min: sensor.minSafe, max: sensor.maxSafe, unit: sensor.unit })}
      </div>
    </Modal>
  );
}

function ScheduleModal({ sensor, onClose, onScheduled }: { sensor: Sensor; onClose: () => void; onScheduled: (date: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [scheduledDate, setScheduledDate] = useState(sensor.scheduledDate?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onScheduled(scheduledDate);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t("sensors.scheduleInstallation")} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>{t("sensors.scheduledDate")}</label>
          <DateField value={scheduledDate} onChange={setScheduledDate} required />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={buttonSecondary} onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
        </div>
      </form>
    </Modal>
  );
}

function SensorCatalogTab({ onRequestType }: { onRequestType: (type: SensorType) => void }) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<SensorCatalog>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<SensorCatalog>("/sensors/catalog").then((res) => {
      setCatalog(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("sensors.catalogHint")}</p>
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("common.type")}</th>
              <th className="text-left px-4 py-2">{t("sensors.catalogWhyNeeded")}</th>
              <th className="text-left px-4 py-2">{t("sensors.catalogInstalled")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sensorTypes.map((type) => {
              const bucket = catalog[type];
              return (
                <tr key={type} className="border-t border-mine-800 hover:bg-mine-800/30 align-top">
                  <td className="px-4 py-2 font-medium whitespace-nowrap">{t(`sensors.types.${type}`)}</td>
                  <td className="px-4 py-2 text-mine-300">{t(`sensors.catalogDescriptions.${type}`)}</td>
                  <td className="px-4 py-2">
                    {bucket && bucket.total > 0 ? (
                      <span className="text-mine-300">
                        {t("sensors.catalogCount", { commissioned: bucket.commissioned, total: bucket.total })}
                      </span>
                    ) : (
                      <span className="text-danger-500 font-semibold">{t("sensors.catalogNoneInstalled")}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-xs text-mine-300 hover:text-mine-50 underline" onClick={() => onRequestType(type)}>
                      {t("sensors.catalogAddSensor")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Sensors() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"sensors" | "catalog">("sensors");
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [sensorModal, setSensorModal] = useState<null | "create" | Sensor>(null);
  const [defaultType, setDefaultType] = useState<SensorType | undefined>(undefined);
  const [chartSensor, setChartSensor] = useState<Sensor | null>(null);
  const [schedulingSensor, setSchedulingSensor] = useState<Sensor | null>(null);
  const socket = useSocket();

  async function load() {
    setLoading(true);
    const [sensorsRes, zonesRes] = await Promise.all([api.get<Sensor[]>("/sensors"), api.get<Zone[]>("/zones")]);
    setSensors(sensorsRes.data);
    setZones(zonesRes.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (payload: { sensorId: string; value: number; recordedAt: string }) => {
      setSensors((prev) =>
        prev.map((s) =>
          s.id === payload.sensorId
            ? { ...s, readings: [{ id: payload.recordedAt, sensorId: s.id, value: payload.value, recordedAt: payload.recordedAt }] }
            : s
        )
      );
    };
    socket.on("sensor:reading", handler);
    return () => {
      socket.off("sensor:reading", handler);
    };
  }, [socket]);

  async function createSensor(data: any) {
    await api.post("/sensors", data);
    setSensorModal(null);
    await load();
  }

  async function updateSensor(id: string, data: any) {
    await api.put(`/sensors/${id}`, data);
    setSensorModal(null);
    await load();
  }

  async function deleteSensor(id: string) {
    if (!confirm(t("sensors.confirmDelete"))) return;
    await api.delete(`/sensors/${id}`);
    await load();
  }

  async function scheduleInstallation(id: string, scheduledDate: string) {
    await api.post(`/sensors/${id}/schedule`, { scheduledDate });
    await load();
  }

  async function installSensor(id: string) {
    await api.post(`/sensors/${id}/install`);
    await load();
  }

  async function commissionSensor(id: string) {
    await api.post(`/sensors/${id}/commission`);
    await load();
  }

  function openCreateForType(type: SensorType) {
    setDefaultType(type);
    setSensorModal("create");
    setTab("sensors");
  }

  if (loading) return <div className="text-mine-300">{t("sensors.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("sensors.title")}</h1>
          <p className="text-mine-300 text-sm">{t("sensors.subtitle")}</p>
        </div>
        {canEdit && zones.length > 0 && tab === "sensors" && (
          <button className={buttonPrimary} onClick={() => { setDefaultType(undefined); setSensorModal("create"); }}>
            {t("sensors.newSensor")}
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className={tab === "sensors" ? buttonPrimary : buttonSecondary} onClick={() => setTab("sensors")}>{t("sensors.tabSensors")}</button>
        <button className={tab === "catalog" ? buttonPrimary : buttonSecondary} onClick={() => setTab("catalog")}>{t("sensors.tabCatalog")}</button>
      </div>

      {tab === "catalog" && <SensorCatalogTab onRequestType={openCreateForType} />}

      {tab === "sensors" && (
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("sensors.colSensor")}</th>
              <th className="text-left px-4 py-2">{t("sensors.colZone")}</th>
              <th className="text-left px-4 py-2">{t("sensors.colType")}</th>
              <th className="text-left px-4 py-2">{t("sensors.colLatestReading")}</th>
              <th className="text-left px-4 py-2">{t("sensors.colSafeRange")}</th>
              <th className="text-left px-4 py-2">{t("sensors.colStatus")}</th>
              <th className="text-left px-4 py-2">{t("sensors.colInstallation")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sensors.map((sensor) => {
              const latest = sensor.readings?.[0];
              const outOfRange = latest && (latest.value < sensor.minSafe || latest.value > sensor.maxSafe);
              const direction = latest ? (latest.value > sensor.maxSafe ? "above" : latest.value < sensor.minSafe ? "below" : null) : null;
              const notCommissioned = sensor.installationStatus !== "COMMISSIONED";
              return (
                <Fragment key={sensor.id}>
                  <tr className={`border-t border-mine-800 hover:bg-mine-800/30 ${outOfRange ? "bg-danger-500/5" : ""}`}>
                    <td className="px-4 py-2 font-medium">
                      <button className="hover:underline" onClick={() => setChartSensor(sensor)}>
                        {sensor.name}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-mine-300">{sensor.zone?.name}</td>
                    <td className="px-4 py-2 text-mine-300">{t(`sensors.types.${sensor.type}`)}</td>
                    <td className={`px-4 py-2 font-semibold ${outOfRange ? "text-danger-400" : ""}`}>
                      {latest ? `${latest.value}${sensor.unit}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-mine-400">{sensor.minSafe}–{sensor.maxSafe}{sensor.unit}</td>
                    <td className="px-4 py-2"><StatusBadge status={sensor.status} /></td>
                    <td className="px-4 py-2">
                      {notCommissioned ? (
                        <div className="flex items-center gap-2">
                          <StatusBadge status={sensor.installationStatus} />
                          {canEdit && sensor.installationStatus === "REQUESTED" && (
                            <button className="text-xs text-mine-300 hover:text-mine-50 underline" onClick={() => setSchedulingSensor(sensor)}>{t("sensors.schedule")}</button>
                          )}
                          {canEdit && sensor.installationStatus === "SCHEDULED" && (
                            <button className="text-xs text-mine-300 hover:text-mine-50 underline" onClick={() => installSensor(sensor.id)}>{t("sensors.markInstalled")}</button>
                          )}
                          {canEdit && sensor.installationStatus === "INSTALLED" && (
                            <button className="text-xs text-mine-300 hover:text-mine-50 underline" onClick={() => commissionSensor(sensor.id)}>{t("sensors.commission")}</button>
                          )}
                        </div>
                      ) : (
                        <span className="text-mine-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-2">
                          <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setSensorModal(sensor)}>{t("common.edit")}</button>
                          <button className={buttonDanger} onClick={() => deleteSensor(sensor.id)}>{t("common.delete")}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {outOfRange && (
                    <tr className="bg-danger-500/10">
                      <td colSpan={8} className="px-4 py-2 text-xs text-danger-500 font-semibold">
                        ⚠ {t("sensors.safetyAlertBanner", {
                          type: t(`sensors.types.${sensor.type}`),
                          zone: sensor.zone?.name ?? "",
                          verb: direction === "below" ? t("sensors.safetyAlertVerbBelow") : t("sensors.safetyAlertVerbAbove"),
                        })}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {sensors.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-mine-400">
                  {t("sensors.noSensorsYet")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {sensorModal && (
        <Modal title={sensorModal === "create" ? t("sensors.newSensorTitle") : t("sensors.editSensorTitle")} onClose={() => setSensorModal(null)}>
          <SensorForm
            zones={zones}
            initial={sensorModal === "create" ? undefined : sensorModal}
            defaultType={sensorModal === "create" ? defaultType : undefined}
            onSubmit={(data) => (sensorModal === "create" ? createSensor(data) : updateSensor(sensorModal.id, data))}
            onCancel={() => setSensorModal(null)}
          />
        </Modal>
      )}

      {chartSensor && <SensorChart sensor={chartSensor} onClose={() => setChartSensor(null)} />}
      {schedulingSensor && (
        <ScheduleModal
          sensor={schedulingSensor}
          onClose={() => setSchedulingSensor(null)}
          onScheduled={(date) => scheduleInstallation(schedulingSensor.id, date)}
        />
      )}
    </div>
  );
}
