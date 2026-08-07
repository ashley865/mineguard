import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

import authRoutes from "./routes/auth";
import sitesRoutes from "./routes/sites";
import zonesRoutes from "./routes/zones";
import sensorsRoutes from "./routes/sensors";
import alertsRoutes from "./routes/alerts";
import workersRoutes from "./routes/workers";
import incidentsRoutes from "./routes/incidents";
import equipmentRoutes from "./routes/equipment";
import dashboardRoutes from "./routes/dashboard";
import executiveRoutes from "./routes/executive";
import codesOfPracticeRoutes from "./routes/codesOfPractice";
import riskAssessmentsRoutes from "./routes/riskAssessments";
import regulatoryNoticesRoutes from "./routes/regulatoryNotices";
import complianceRequirementsRoutes from "./routes/complianceRequirements";
import auditFindingsRoutes from "./routes/auditFindings";
import securityCamerasRoutes from "./routes/securityCameras";
import securityIncidentsRoutes from "./routes/securityIncidents";
import medicalSurveillanceRoutes from "./routes/medicalSurveillance";
import safetyInspectionsRoutes from "./routes/safetyInspections";
import permitsRoutes from "./routes/permits";
import certificatesRoutes from "./routes/certificates";
import trainingRecordsRoutes from "./routes/trainingRecords";
import employeeComplianceRoutes from "./routes/employeeCompliance";
import documentsRoutes from "./routes/documents";
import inspectionVisitsRoutes from "./routes/inspectionVisits";
import inspectionSnapshotRoutes from "./routes/inspectionSnapshot";
import reportsRoutes from "./routes/reports";
import minesRoutes from "./routes/mines";
import notificationsRoutes from "./routes/notifications";
import attendanceRoutes from "./routes/attendance";
import executiveRequestsRoutes from "./routes/executiveRequests";
import contractorsRoutes from "./routes/contractors";
import executiveSitesRoutes from "./routes/executiveSites";
import visitorsRoutes from "./routes/visitors";
import permitsToWorkRoutes from "./routes/permitsToWork";
import executiveInvitesRoutes from "./routes/executiveInvites";
import trucksRoutes from "./routes/trucks";
import messagesRoutes from "./routes/messages";
import buyersRoutes from "./routes/buyers";
import mineralsRoutes from "./routes/minerals";
import contractsRoutes from "./routes/contracts";
import productionRoutes from "./routes/production";
import maintenanceRoutes from "./routes/maintenance";
import fleetRoutes from "./routes/fleet";
import inventoryRoutes from "./routes/inventory";
import weatherRoutes from "./routes/weather";
import safetyObservationsRoutes from "./routes/safetyObservations";
import explosivesRoutes from "./routes/explosives";
import environmentalRoutes from "./routes/environmental";
import emergencyRoutes from "./routes/emergency";
import rosterRoutes from "./routes/roster";
import trainingLmsRoutes from "./routes/trainingLms";
import payrollRoutes from "./routes/payroll";
import procurementRoutes from "./routes/procurement";
import invoicesRoutes from "./routes/invoices";
import payeesRoutes from "./routes/payees";
import expensesRoutes from "./routes/expenses";
import { sanitizeBody } from "./middleware/sanitize";
import { startSimulator } from "./services/simulator";
import { scanCompliance } from "./services/complianceScanner";
import { verifyAuthToken } from "./lib/jwt";
import { prisma } from "./prisma";

const app = express();
const httpServer = createServer(app);

const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const io = new SocketServer(httpServer, {
  cors: { origin: clientOrigin },
});
app.set("io", io);

// Every socket must authenticate with the same JWT used for REST calls, and is placed
// into a room scoped to its mine (never trusting a client-supplied mineId). Every emit
// in this codebase targets that room instead of broadcasting globally, so a user from
// one mine can never observe another mine's real-time alerts, incidents, or messages.
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Unauthorized"));
    const { userId } = verifyAuthToken(token);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, mineId: true } });
    if (!user) return next(new Error("Unauthorized"));
    socket.data.userId = user.id;
    socket.data.mineId = user.mineId;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});
// Render sits in front of the app behind a reverse proxy; without this, every
// request appears to originate from the proxy's IP and per-IP rate limiting
// (see middleware/rateLimit.ts) would be meaningless.
app.set("trust proxy", 1);

app.use(cors({ origin: clientOrigin }));
app.use(express.json());
app.use(sanitizeBody);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/sites", sitesRoutes);
app.use("/api/zones", zonesRoutes);
app.use("/api/sensors", sensorsRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/workers", workersRoutes);
app.use("/api/incidents", incidentsRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/executive", executiveRoutes);
app.use("/api/codes-of-practice", codesOfPracticeRoutes);
app.use("/api/risk-assessments", riskAssessmentsRoutes);
app.use("/api/regulatory-notices", regulatoryNoticesRoutes);
app.use("/api/compliance-requirements", complianceRequirementsRoutes);
app.use("/api/audit-findings", auditFindingsRoutes);
app.use("/api/security-cameras", securityCamerasRoutes);
app.use("/api/security-incidents", securityIncidentsRoutes);
app.use("/api/medical-surveillance", medicalSurveillanceRoutes);
app.use("/api/safety-inspections", safetyInspectionsRoutes);
app.use("/api/permits", permitsRoutes);
app.use("/api/certificates", certificatesRoutes);
app.use("/api/training-records", trainingRecordsRoutes);
app.use("/api/employee-compliance", employeeComplianceRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/inspection-visits", inspectionVisitsRoutes);
app.use("/api/inspection-snapshot", inspectionSnapshotRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/mines", minesRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/executive-requests", executiveRequestsRoutes);
app.use("/api/contractors", contractorsRoutes);
app.use("/api/executive-sites", executiveSitesRoutes);
app.use("/api/visitors", visitorsRoutes);
app.use("/api/permits-to-work", permitsToWorkRoutes);
app.use("/api/executive-invites", executiveInvitesRoutes);
app.use("/api/trucks", trucksRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/buyers", buyersRoutes);
app.use("/api/minerals", mineralsRoutes);
app.use("/api/contracts", contractsRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/fleet", fleetRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/safety-observations", safetyObservationsRoutes);
app.use("/api/explosives", explosivesRoutes);
app.use("/api/environmental", environmentalRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/roster", rosterRoutes);
app.use("/api/training-lms", trainingLmsRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/procurement", procurementRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/payees", payeesRoutes);
app.use("/api/expenses", expensesRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.message === "UNSUPPORTED_FILE_TYPE") {
    return res.status(400).json({ error: "This file type is not supported" });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File is too large" });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

io.on("connection", (socket) => {
  if (socket.data.mineId) socket.join(`mine:${socket.data.mineId}`);
  socket.join(`user:${socket.data.userId}`);

  // In-app calling: the server is a pure signaling relay between the two users'
  // `user:<id>` rooms — no call state is persisted, WebRTC media flows peer-to-peer.
  socket.on("call:invite", async (payload: { toUserId: string; offer: unknown; video: boolean; fromUserName: string }) => {
    if (!payload?.toUserId || !socket.data.mineId) return;
    const target = await prisma.user.findUnique({ where: { id: payload.toUserId }, select: { mineId: true } });
    if (!target || target.mineId !== socket.data.mineId) return;
    io.to(`user:${payload.toUserId}`).emit("call:invite", {
      fromUserId: socket.data.userId,
      fromUserName: payload.fromUserName,
      offer: payload.offer,
      video: !!payload.video,
    });
  });
  socket.on("call:accept", (payload: { toUserId: string; answer: unknown }) => {
    if (!payload?.toUserId) return;
    io.to(`user:${payload.toUserId}`).emit("call:accept", { fromUserId: socket.data.userId, answer: payload.answer });
  });
  socket.on("call:reject", (payload: { toUserId: string }) => {
    if (!payload?.toUserId) return;
    io.to(`user:${payload.toUserId}`).emit("call:reject", { fromUserId: socket.data.userId });
  });
  socket.on("call:ice-candidate", (payload: { toUserId: string; candidate: unknown }) => {
    if (!payload?.toUserId) return;
    io.to(`user:${payload.toUserId}`).emit("call:ice-candidate", { fromUserId: socket.data.userId, candidate: payload.candidate });
  });
  socket.on("call:end", (payload: { toUserId: string }) => {
    if (!payload?.toUserId) return;
    io.to(`user:${payload.toUserId}`).emit("call:end", { fromUserId: socket.data.userId });
  });

  socket.on("disconnect", () => {});
});

const COMPLIANCE_SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000;

const port = Number(process.env.PORT) || 4000;
httpServer.listen(port, () => {
  console.log(`Mine Guard API listening on port ${port}`);
  startSimulator(io);
  scanCompliance(io).catch((err) => console.error("Compliance scan failed", err));
  setInterval(() => {
    scanCompliance(io).catch((err) => console.error("Compliance scan failed", err));
  }, COMPLIANCE_SCAN_INTERVAL_MS);
});
