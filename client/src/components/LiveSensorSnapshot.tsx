import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Sensor } from "../api/types";
import { useSocket, useSocketConnected } from "../context/SocketContext";
import LivePulse, { formatTimeAgo } from "./LivePulse";

type Ranked = {
  sensor: Sensor;
  value: number;
  recordedAt: string;
  // > 0: outside the safe range, scaled by how far past it (e.g. 0.5 = half the range's
  // width past the limit). <= 0: inside the range, closer to 0 the nearer to a limit.
  score: number;
};

function rank(sensors: Sensor[]): Ranked[] {
  const ranked: Ranked[] = [];
  for (const sensor of sensors) {
    const reading = sensor.readings?.[0];
    if (!reading) continue;
    const range = sensor.maxSafe - sensor.minSafe || 1;
    let score: number;
    if (reading.value < sensor.minSafe) score = (sensor.minSafe - reading.value) / range;
    else if (reading.value > sensor.maxSafe) score = (reading.value - sensor.maxSafe) / range;
    else score = -Math.min(sensor.maxSafe - reading.value, reading.value - sensor.minSafe) / range;
    ranked.push({ sensor, value: reading.value, recordedAt: reading.recordedAt, score });
  }
  return ranked.sort((a, b) => b.score - a.score).slice(0, 6);
}

function toneFor(score: number): "critical" | "warning" | "success" {
  if (score > 0) return "critical";
  if (score > -0.15) return "warning";
  return "success";
}

const TONE_BORDER = { critical: "border-l-danger-500", warning: "border-l-hazard-500", success: "border-l-success-500" };
const TONE_TEXT = { critical: "text-danger-500", warning: "text-hazard-500", success: "text-success-500" };

/**
 * The mine's current worst sensor readings, live — sorted by how close each is to (or past)
 * its safe range, updating in place as new readings arrive rather than needing a reload.
 * This is a snapshot of "what's worth watching right now", not a replacement for the full
 * Sensors page.
 */
export default function LiveSensorSnapshot() {
  const { t } = useTranslation();
  const socket = useSocket();
  const connected = useSocketConnected();
  const [sensors, setSensors] = useState<Sensor[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<Sensor[]>("/sensors").then((res) => {
      if (!cancelled) setSensors(res.data);
    }).catch(() => {
      if (!cancelled) setSensors([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onReading(payload: { sensorId: string; value: number; recordedAt: string }) {
      setSensors((prev) =>
        prev
          ? prev.map((s) => (s.id === payload.sensorId ? { ...s, readings: [{ id: "live", sensorId: s.id, value: payload.value, recordedAt: payload.recordedAt }] } : s))
          : prev
      );
    }
    socket.on("sensor:reading", onReading);
    return () => {
      socket.off("sensor:reading", onReading);
    };
  }, [socket]);

  const ranked = sensors ? rank(sensors) : [];

  return (
    <div className="bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6 flex flex-col min-h-[280px]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-mine-50">{t("liveOps.sensors.title")}</h2>
        <LivePulse connected={connected} />
      </div>
      {sensors === null ? (
        <div className="flex-1 flex items-center justify-center text-xs text-mine-400">{t("common.loading")}</div>
      ) : ranked.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-mine-400 text-center px-4">{t("liveOps.sensors.empty")}</div>
      ) : (
        <div className="space-y-2">
          {ranked.map(({ sensor, value, recordedAt, score }) => {
            const tone = toneFor(score);
            return (
              <div key={sensor.id} className={`flex items-center justify-between gap-2 border-l-2 ${TONE_BORDER[tone]} bg-mine-800/40 rounded-r-md px-2.5 py-1.5`}>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-mine-50 truncate">{sensor.name}</div>
                  <div className="text-[10px] text-mine-400 truncate">
                    {sensor.zone?.name ?? "—"} · {t(`sensors.types.${sensor.type}`)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-bold tabular-nums ${TONE_TEXT[tone]}`}>
                    {value} {sensor.unit}
                  </div>
                  <div className="text-[10px] text-mine-500 tabular-nums">{formatTimeAgo(recordedAt, t)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
