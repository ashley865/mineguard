import { Server as SocketServer } from "socket.io";
import { prisma } from "../prisma";
import { evaluateReading } from "./alertEngine";

/**
 * Generates the next reading with a random walk biased back toward the
 * midpoint of the safe range, with an occasional spike to exercise alerting.
 */
function nextValue(previous: number | null, minSafe: number, maxSafe: number): number {
  const mid = (minSafe + maxSafe) / 2;
  const range = maxSafe - minSafe;
  const base = previous ?? mid;

  const spike = Math.random() < 0.05;
  if (spike) {
    const direction = Math.random() < 0.5 ? -1 : 1;
    return Number((base + direction * range * (0.4 + Math.random() * 0.4)).toFixed(2));
  }

  const pullToMid = (mid - base) * 0.05;
  const noise = (Math.random() - 0.5) * range * 0.08;
  return Number((base + pullToMid + noise).toFixed(2));
}

export function startSimulator(io: SocketServer) {
  const intervalMs = Number(process.env.SIMULATOR_INTERVAL_MS) || 5000;

  setInterval(async () => {
    try {
      const sensors = await prisma.sensor.findMany({
        where: { status: "ACTIVE" },
        include: {
          readings: { orderBy: { recordedAt: "desc" }, take: 1 },
          zone: { select: { site: { select: { mineId: true } } } },
        },
      });

      for (const sensor of sensors) {
        const previous = sensor.readings[0]?.value ?? null;
        const value = nextValue(previous, sensor.minSafe, sensor.maxSafe);
        const mineRoom = `mine:${sensor.zone.site.mineId}`;

        const reading = await prisma.sensorReading.create({
          data: { sensorId: sensor.id, value },
        });

        io.to(mineRoom).emit("sensor:reading", {
          sensorId: sensor.id,
          value: reading.value,
          recordedAt: reading.recordedAt,
        });

        const alert = await evaluateReading(sensor, value);
        if (alert) io.to(mineRoom).emit("alert:new", alert);
      }
    } catch (err) {
      console.error("Simulator tick failed:", err);
    }
  }, intervalMs);

  console.log(`Sensor reading simulator running every ${intervalMs}ms`);
}
