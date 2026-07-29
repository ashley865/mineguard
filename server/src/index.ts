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
import { startSimulator } from "./services/simulator";

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

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

io.on("connection", (socket) => {
  socket.on("disconnect", () => {});
});

const port = Number(process.env.PORT) || 4000;
httpServer.listen(port, () => {
  console.log(`Mine Guard API listening on port ${port}`);
  startSimulator(io);
});
