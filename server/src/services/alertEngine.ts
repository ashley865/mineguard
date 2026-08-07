import { Sensor } from "@prisma/client";
import { prisma } from "../prisma";

// Plain-language description of what each sensor type actually monitors, used to turn a
// bare reading into an interpreted safety statement rather than a raw number — e.g.
// "Temperature in Area B has exceeded the configured safety threshold" instead of
// "Temperature: 42°C".
const SENSOR_TYPE_LABELS: Record<string, string> = {
  METHANE: "Methane gas",
  CARBON_MONOXIDE: "Carbon monoxide",
  OXYGEN: "Oxygen level",
  TEMPERATURE: "Temperature",
  HUMIDITY: "Humidity",
  SEISMIC: "Seismic / ground activity",
  AIR_FLOW: "Air flow",
  DUST: "Dust concentration",
  NOISE: "Noise level",
  WATER_LEVEL: "Water level",
  EQUIPMENT_CONDITION: "Equipment condition",
};

function describeSensorType(type: string): string {
  return SENSOR_TYPE_LABELS[type] ?? type.replace(/_/g, " ").toLowerCase();
}

function severityFor(sensor: Sensor, value: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null {
  const { minSafe, maxSafe } = sensor;
  const range = maxSafe - minSafe;
  if (range <= 0) return null;

  if (value < minSafe || value > maxSafe) {
    const breachRatio =
      value > maxSafe ? (value - maxSafe) / range : (minSafe - value) / range;
    if (breachRatio > 0.5) return "CRITICAL";
    if (breachRatio > 0.25) return "HIGH";
    return "MEDIUM";
  }

  // Approaching threshold (within 10% of the band edges) — early warning.
  const warnBand = range * 0.1;
  if (value > maxSafe - warnBand || value < minSafe + warnBand) return "LOW";

  return null;
}

/**
 * Evaluates a new reading against the sensor's safe range. If it breaches or
 * approaches the range, opens a new alert (unless an OPEN alert already
 * exists for this sensor, to avoid duplicate spam) and returns it.
 */
export async function evaluateReading(sensor: Sensor, value: number) {
  const severity = severityFor(sensor, value);
  if (!severity) return null;

  const existingOpen = await prisma.alert.findFirst({
    where: { sensorId: sensor.id, status: "OPEN" },
  });
  if (existingOpen) return null;

  const zone = await prisma.zone.findUnique({ where: { id: sensor.zoneId } });
  if (!zone) return null;

  const direction = value > sensor.maxSafe ? "above" : value < sensor.minSafe ? "below" : "near";
  const verb = direction === "near" ? "is approaching" : "has exceeded";
  const label = describeSensorType(sensor.type);
  const message = `SAFETY ALERT: ${label} in ${zone.name} ${verb} the configured safety threshold. ${sensor.name} reading: ${value}${sensor.unit} (safe range ${sensor.minSafe}-${sensor.maxSafe}${sensor.unit}).`;

  const alert = await prisma.alert.create({
    data: {
      siteId: zone.siteId,
      zoneId: zone.id,
      sensorId: sensor.id,
      severity,
      message,
    },
  });

  return alert;
}
