import { Sensor } from "@prisma/client";
import { Server as SocketServer } from "socket.io";
import { prisma } from "../prisma";
import { evaluateReading } from "../services/alertEngine";

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
