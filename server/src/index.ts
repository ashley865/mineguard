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
import medicalSurveillanceRoutes from "./routes/medicalSurveillance";
import safetyInspectionsRoutes from "./routes/safetyInspections";
import permitsRoutes from "./routes/permits";
import certificatesRoutes from "./routes/certificates";
import trainingRecordsRoutes from "./routes/trainingRecords";
import { startSimulator } from "./services/simulator";
import { scanCompliance } from "./services/complianceScanner";

const app = express();
const httpServer = createServer(app);

const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const io = new SocketServer(httpServer, {
  cors: { origin: clientOrigin },
});
app.set("io", io);

app.use(cors({ origin: clientOrigin }));
app.use(express.json());

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
app.use("/api/medical-surveillance", medicalSurveillanceRoutes);
app.use("/api/safety-inspections", safetyInspectionsRoutes);
app.use("/api/permits", permitsRoutes);
app.use("/api/certificates", certificatesRoutes);
app.use("/api/training-records", trainingRecordsRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

io.on("connection", (socket) => {
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
