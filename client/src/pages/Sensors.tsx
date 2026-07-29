import { FormEvent, useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Sensor, SensorReading, SensorType, Zone } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

const sensorTypes: SensorType[] = [
  "METHANE",
  "CARBON_MONOXIDE",
  "OXYGEN",
  "TEMPERATURE",
  "HUMIDITY",
  "SEISMIC",
  "AIR_FLOW",
];

function SensorForm({ zones, initial, onSubmit, onCancel }: {
  zones: Zone[];
  initial?: Partial<Sensor>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<SensorType>(initial?.type ?? "METHANE");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [minSafe, setMinSafe] = useState(initial?.minSafe?.toString() ?? "0");
  const [maxSafe, setMaxSafe] = useState(initial?.maxSafe?.toString() ?? "100");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? zones[0]?.id ?? "");
  const [status, setStatus] = useState(initial?.status ?? "ACTIVE");
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
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Sensor name</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Type</label>
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as SensorType)}>
            {sensorTypes.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Unit</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ppm, %, °C…" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Min safe</label>
          <input className={inputClass} type="number" step="any" value={minSafe} onChange={(e) => setMinSafe(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>Max safe</label>
          <input className={inputClass} type="number" step="any" value={maxSafe} onChange={(e) => setMaxSafe(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>Zone</label>
        <select className={inputClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)} required>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.site?.name} · {z.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Status</label>
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="FAULT">Fault</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>Cancel</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

function SensorChart({ sensor, onClose }: { sensor: Sensor; onClose: () => void }) {
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
    <Modal title={`${sensor.name} — Live Readings`} onClose={onClose}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#96b4a5" }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: "#96b4a5" }} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: "#1c2f2a", border: "1px solid #29463c", fontSize: 12 }} />
            <ReferenceLine y={sensor.minSafe} stroke="#e13b2e" strokeDasharray="4 4" />
            <ReferenceLine y={sensor.maxSafe} stroke="#e13b2e" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="value" stroke="#658c7a" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-mine-400 mt-2">
        Safe range: {sensor.minSafe}–{sensor.maxSafe}{sensor.unit}
      </div>
    </Modal>
  );
}

export default function Sensors() {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR";
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [sensorModal, setSensorModal] = useState<null | "create" | Sensor>(null);
  const [chartSensor, setChartSensor] = useState<Sensor | null>(null);
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
    if (!confirm("Delete this sensor and its reading history?")) return;
    await api.delete(`/sensors/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">Loading sensors…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Sensors</h1>
          <p className="text-mine-300 text-sm">Live readings update automatically every few seconds</p>
        </div>
        {canEdit && zones.length > 0 && (
          <button className={buttonPrimary} onClick={() => setSensorModal("create")}>
            + New Sensor
          </button>
        )}
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Sensor</th>
              <th className="text-left px-4 py-2">Zone</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Latest Reading</th>
              <th className="text-left px-4 py-2">Safe Range</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sensors.map((sensor) => {
              const latest = sensor.readings?.[0];
              const outOfRange = latest && (latest.value < sensor.minSafe || latest.value > sensor.maxSafe);
              return (
                <tr key={sensor.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                  <td className="px-4 py-2 font-medium">
                    <button className="hover:underline" onClick={() => setChartSensor(sensor)}>
                      {sensor.name}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-mine-300">{sensor.zone?.name}</td>
                  <td className="px-4 py-2 text-mine-300">{sensor.type.replace(/_/g, " ")}</td>
                  <td className={`px-4 py-2 font-semibold ${outOfRange ? "text-danger-400" : ""}`}>
                    {latest ? `${latest.value}${sensor.unit}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-mine-400">{sensor.minSafe}–{sensor.maxSafe}{sensor.unit}</td>
                  <td className="px-4 py-2"><StatusBadge status={sensor.status} /></td>
                  <td className="px-4 py-2 text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-2">
                        <button className="text-xs text-mine-300 hover:text-white" onClick={() => setSensorModal(sensor)}>Edit</button>
                        <button className={buttonDanger} onClick={() => deleteSensor(sensor.id)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {sensors.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-mine-400">
                  No sensors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sensorModal && (
        <Modal title={sensorModal === "create" ? "New Sensor" : "Edit Sensor"} onClose={() => setSensorModal(null)}>
          <SensorForm
            zones={zones}
            initial={sensorModal === "create" ? undefined : sensorModal}
            onSubmit={(data) => (sensorModal === "create" ? createSensor(data) : updateSensor(sensorModal.id, data))}
            onCancel={() => setSensorModal(null)}
          />
        </Modal>
      )}

      {chartSensor && <SensorChart sensor={chartSensor} onClose={() => setChartSensor(null)} />}
    </div>
  );
}
