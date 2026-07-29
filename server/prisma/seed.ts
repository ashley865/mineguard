import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.create({
    data: {
      name: "Blackrock Coal Mine",
      location: "Appalachian Basin, WV",
      description: "Underground bituminous coal mine, 3 active shafts.",
      status: "OPERATIONAL",
      zones: {
        create: [
          { name: "Shaft A - Level 1", description: "Primary extraction zone" },
          { name: "Shaft B - Level 2", description: "Secondary extraction zone" },
          { name: "Ventilation Hub", description: "Main air handling area" },
        ],
      },
    },
    include: { zones: true },
  });

  const [shaftA, shaftB, ventHub] = site.zones;

  const sensorDefs = [
    { zone: shaftA, name: "Methane Sensor A1", type: "METHANE", unit: "%LEL", minSafe: 0, maxSafe: 25 },
    { zone: shaftA, name: "CO Sensor A1", type: "CARBON_MONOXIDE", unit: "ppm", minSafe: 0, maxSafe: 50 },
    { zone: shaftA, name: "Oxygen Sensor A1", type: "OXYGEN", unit: "%", minSafe: 19.5, maxSafe: 23 },
    { zone: shaftB, name: "Methane Sensor B1", type: "METHANE", unit: "%LEL", minSafe: 0, maxSafe: 25 },
    { zone: shaftB, name: "Temperature Sensor B1", type: "TEMPERATURE", unit: "°C", minSafe: 10, maxSafe: 35 },
    { zone: shaftB, name: "Seismic Sensor B1", type: "SEISMIC", unit: "mm/s", minSafe: 0, maxSafe: 5 },
    { zone: ventHub, name: "Air Flow Sensor V1", type: "AIR_FLOW", unit: "m/s", minSafe: 0.5, maxSafe: 6 },
    { zone: ventHub, name: "Humidity Sensor V1", type: "HUMIDITY", unit: "%", minSafe: 20, maxSafe: 70 },
  ] as const;

  for (const s of sensorDefs) {
    await prisma.sensor.create({
      data: {
        name: s.name,
        type: s.type,
        unit: s.unit,
        minSafe: s.minSafe,
        maxSafe: s.maxSafe,
        status: "ACTIVE",
        zoneId: s.zone.id,
      },
    });
  }

  await prisma.worker.createMany({
    data: [
      { name: "James Carter", employeeId: "EMP-1001", role: "Shift Lead", status: "ON_SHIFT", siteId: site.id, zoneId: shaftA.id },
      { name: "Maria Gonzalez", employeeId: "EMP-1002", role: "Drill Operator", status: "ON_SHIFT", siteId: site.id, zoneId: shaftA.id },
      { name: "Liam O'Brien", employeeId: "EMP-1003", role: "Ventilation Tech", status: "ON_SHIFT", siteId: site.id, zoneId: ventHub.id },
      { name: "Priya Nair", employeeId: "EMP-1004", role: "Safety Officer", status: "OFF_SHIFT", siteId: site.id, zoneId: shaftB.id },
    ],
  });

  await prisma.equipment.createMany({
    data: [
      { name: "Continuous Miner CM-12", type: "Extraction", status: "OPERATIONAL", siteId: site.id, zoneId: shaftA.id },
      { name: "Main Ventilation Fan", type: "Ventilation", status: "OPERATIONAL", siteId: site.id, zoneId: ventHub.id },
      { name: "Shuttle Car SC-4", type: "Transport", status: "MAINTENANCE", siteId: site.id, zoneId: shaftB.id },
    ],
  });

  await prisma.incident.create({
    data: {
      title: "Minor roof fall - Shaft B",
      description: "Small roof fall reported in Shaft B, Level 2. No injuries. Area cordoned off pending inspection.",
      severity: "MEDIUM",
      status: "INVESTIGATING",
      siteId: site.id,
      zoneId: shaftB.id,
    },
  });

  console.log("Seed complete: demo mine data created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
