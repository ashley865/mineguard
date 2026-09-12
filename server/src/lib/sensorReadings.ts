import { Sensor } from "@prisma/client";
import { Server as SocketServer } from "socket.io";
import { prisma } from "../prisma";
import { evaluateReading } from "../services/alertEngine";
import { notifyExecutives } from "./notify";

/**
 * The single path a reading takes into the system, whatever recorded it — the simulator,
 * a person entering one by hand, or a network sensor pushing its own (routes/sensorIngest.ts).
 * Persisting, broadcasting and alert evaluation belong together: a reading that lands in the
 * table but never reaches evaluateReading is a threshold breach nobody is told about.
 */
export async function recordSensorReading(sensor: Sensor, value: number, mineId: string, io: SocketServer | undefined) {
  const reading = await prisma.sensorReading.create({ data: { sensorId: sensor.id, value } });

  io?.to(`mine:${mineId}`).emit("sensor:reading", { sensorId: sensor.id, value: reading.value, recordedAt: reading.recordedAt });

  const alert = await evaluateReading(sensor, reading.value);
  if (alert) io?.to(`mine:${mineId}`).emit("alert:new", alert);

  return reading;
}

// A poll that keeps failing quietly is a monitoring gap, not just a stale timestamp — this
// is what turns "the AI API integration broke three days ago" into an actual IT notification
// instead of something only noticed the next time someone opens the sensor's row by hand.
const POLL_FAILURE_ALERT_THRESHOLD = 5;

/**
 * Updates a sensor's poll bookkeeping after one attempt (success or failure) and, exactly
 * once per failure streak — right as it crosses the threshold, not on every tick after — asks
 * IT to look at it. Used by both collectors: the server's own HTTP_JSON loop and the
 * on-site agent's readings endpoint, so a failing poll is flagged the same way regardless of
 * which one is doing the collecting.
 */
export async function recordPollOutcome(
  sensor: Pick<Sensor, "id" | "name" | "pollConsecutiveFailures">,
  mineId: string | null,
  io: SocketServer | undefined,
  outcome: { ok: true } | { ok: false; error: string }
) {
  const consecutiveFailures = outcome.ok ? 0 : (sensor.pollConsecutiveFailures ?? 0) + 1;
  await prisma.sensor.update({
    where: { id: sensor.id },
    data: {
      lastPollAt: new Date(),
      lastPollOk: outcome.ok,
      lastPollError: outcome.ok ? null : outcome.error,
      pollConsecutiveFailures: consecutiveFailures,
    },
  });

  if (!outcome.ok && consecutiveFailures === POLL_FAILURE_ALERT_THRESHOLD && mineId) {
    await notifyExecutives(io, {
      mineId,
      titles: ["IT_MANAGER"],
      type: "SENSOR_POLL_FAILING",
      title: `Sensor "${sensor.name}" has failed to report ${consecutiveFailures} times in a row`,
      body: outcome.error,
      link: "/cyber-command-center",
    }).catch(() => {});
  }
}
