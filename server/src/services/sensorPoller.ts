import { Server as SocketServer } from "socket.io";
import { prisma } from "../prisma";
import { recordSensorReading } from "../lib/sensorReadings";
import { assertSafePollUrl, UnsafeUrlError } from "../lib/ssrfGuard";
import { DEFAULT_POLL_INTERVAL_SECONDS, extractJsonValue, httpPollConfigSchema } from "../lib/sensorPolling";

const TICK_MS = 10_000;
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Fetches one sensor over HTTP and returns its reading, or the reason it couldn't.
 * Never throws: a sensor that is unplugged, renamed or serving garbage is an operational
 * fact to record on that sensor, not something that should stop the other sensors polling.
 */
async function pollHttpSensor(target: string, config: unknown): Promise<{ value: number } | { error: string }> {
  const parsedConfig = httpPollConfigSchema.safeParse(config ?? {});
  if (!parsedConfig.success) return { error: "Invalid HTTP poll configuration" };

  let url: URL;
  try {
    url = await assertSafePollUrl(target);
  } catch (err) {
    return { error: err instanceof UnsafeUrlError ? err.message : "Invalid poll URL" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) return { error: `Sensor responded with ${res.status}` };
    const body = await res.json().catch(() => null);
    const value = extractJsonValue(body, parsedConfig.data.jsonPath);
    if (value === null) {
      return { error: parsedConfig.data.jsonPath ? `No numeric value at "${parsedConfig.data.jsonPath}"` : "Response was not a number" };
    }
    return { value };
  } catch (err: any) {
    return { error: err?.name === "AbortError" ? "Request timed out" : "Could not reach the sensor" };
  } finally {
    clearTimeout(timeout);
  }
}

function isDue(lastPollAt: Date | null, intervalSeconds: number): boolean {
  if (!lastPollAt) return true;
  return Date.now() - lastPollAt.getTime() >= intervalSeconds * 1000;
}

/**
 * Polls the sensors this server collects directly — HTTP only, and only those not assigned
 * to an on-site agent (which does its own polling and pushes results in). The loop ticks
 * far more often than any sensor's interval and picks out whichever are due, so each sensor
 * keeps its own cadence without needing a timer per sensor.
 */
export function startSensorPoller(io: SocketServer) {
  let running = false;

  setInterval(async () => {
    // A slow or unreachable batch must not overlap with the next tick and double up
    // requests against the same instruments.
    if (running) return;
    running = true;
    try {
      const sensors = await prisma.sensor.findMany({
        where: { pollEnabled: true, pollProtocol: "HTTP_JSON", pollAgentId: null, status: { not: "INACTIVE" } },
        include: { zone: { select: { site: { select: { mineId: true } } } } },
      });

      for (const sensor of sensors) {
        const interval = sensor.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS;
        if (!isDue(sensor.lastPollAt, interval)) continue;
        if (!sensor.pollTarget) {
          await prisma.sensor.update({
            where: { id: sensor.id },
            data: { lastPollAt: new Date(), lastPollOk: false, lastPollError: "No poll URL configured" },
          });
          continue;
        }

        const result = await pollHttpSensor(sensor.pollTarget, sensor.pollConfig);
        const mineId = sensor.zone.site.mineId;

        if ("value" in result && mineId) {
          await recordSensorReading(sensor, result.value, mineId, io);
          await prisma.sensor.update({
            where: { id: sensor.id },
            data: { lastPollAt: new Date(), lastPollOk: true, lastPollError: null },
          });
        } else {
          await prisma.sensor.update({
            where: { id: sensor.id },
            data: {
              lastPollAt: new Date(),
              lastPollOk: false,
              lastPollError: "error" in result ? result.error : "Sensor is not attached to a mine",
            },
          });
        }
      }
    } catch (err) {
      console.error("Sensor poller tick failed:", err);
    } finally {
      running = false;
    }
  }, TICK_MS);

  console.log(`Sensor poller running every ${TICK_MS}ms`);
}

/** Backs the "Test poll" button, so IT gets the real failure reason before saving. */
export async function testPollHttpSensor(target: string, config: unknown): Promise<{ success: boolean; message: string; value?: number }> {
  const result = await pollHttpSensor(target, config);
  if ("value" in result) return { success: true, message: `Sensor returned ${result.value}`, value: result.value };
  return { success: false, message: result.error };
}
