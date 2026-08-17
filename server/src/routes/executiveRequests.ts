import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireMineId } from "../lib/mineScope";
import { documentFileFilter } from "../lib/uploadFilters";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFileFilter,
});

const titleEnum = z.enum([
  "GENERAL_MANAGER",
  "CFO",
  "COO",
  "HR_MANAGER",
  "SECURITY_MANAGER",
  "SAFETY_MANAGER",
  "OPERATIONS_MANAGER",
  "COMPLIANCE_OFFICER",
  "IT_MANAGER",
  "OTHER",
]);

const categoryEnum = z.enum([
  "PAYROLL_PAYMENT",
  "INVOICE_APPROVAL",
  "PURCHASE_APPROVAL",
  "BUDGET_APPROVAL",
  "DOCUMENT_REVIEW",
  "GENERAL",
]);

const createSchema = z.object({
  toTitle: titleEnum,
  category: categoryEnum,
  subject: z.string().min(1),
  message: z.string().min(1),
  amount: z.coerce.number().positive().optional(),
  priority: z.enum(["NORMAL", "EMERGENCY"]).optional(),
});

const respondSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "COMPLETED"]),
  responseNote: z.string().optional(),
});

const requestSelect = {
  id: true,
  toTitle: true,
  category: true,
  subject: true,
  message: true,
  amount: true,
  priority: true,
  status: true,
  responseNote: true,
  respondedAt: true,
  fromUser: { select: { id: true, name: true, title: true } },
  respondedBy: { select: { id: true, name: true } },
  fileName: true,
  fileMimeType: true,
  fileSize: true,
  createdAt: true,
} as const;

function withHasAttachment<T extends { fileName: string | null }>(request: T) {
  return { ...request, hasAttachment: !!request.fileName };
}

router.use(requireAuth, requireRole("ADMIN", "EXECUTIVE"));

router.get("/", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;

  const role = req.auth!.role;
  const userId = req.auth!.userId;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { title: true } });

  const where =
    role === "ADMIN"
      ? { mineId }
      : { mineId, OR: [{ fromUserId: userId }, ...(me?.title ? [{ toTitle: me.title }] : [])] };

  const requests = await prisma.executiveRequest.findMany({
    where,
    select: requestSelect,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  res.json(requests.map(withHasAttachment));
});

router.post("/", upload.single("attachment"), async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const request = await prisma.executiveRequest.create({
    data: {
      ...parsed.data,
      mineId,
      fromUserId: req.auth!.userId,
      ...(req.file
        ? {
            fileName: req.file.originalname,
            fileMimeType: req.file.mimetype,
            fileSize: req.file.size,
            fileData: Uint8Array.from(req.file.buffer),
          }
        : {}),
    },
    select: requestSelect,
  });

  // Requests are routed by title, not a specific user, so the "popup" notification
  // goes to the whole mine room and each client decides locally whether it's the
  // intended recipient (their own title, or admin) before showing anything.
  const io = req.app.get("io");
  io?.to(`mine:${mineId}`).emit("request:new", withHasAttachment(request));

  res.status(201).json(withHasAttachment(request));
});

router.get("/:id/attachment", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const request = await prisma.executiveRequest.findFirst({
    where: { id: req.params.id, mineId },
    select: { fileName: true, fileMimeType: true, fileData: true },
  });
  if (!request?.fileData || !request.fileMimeType) return res.status(404).json({ error: "No attachment on this request" });
  res.setHeader("Content-Type", request.fileMimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${request.fileName}"`);
  res.send(Buffer.from(request.fileData));
});

router.put("/:id/respond", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.executiveRequest.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Request not found" });
  if (existing.status === "REJECTED" || existing.status === "COMPLETED") {
    return res.status(409).json({ error: "This request has already been closed out" });
  }

  if (req.auth!.role !== "ADMIN") {
    const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { title: true } });
    if (me?.title !== existing.toTitle) return res.status(403).json({ error: "Insufficient permissions" });
  }

  const request = await prisma.executiveRequest.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status,
      responseNote: parsed.data.responseNote,
      respondedById: req.auth!.userId,
      respondedAt: new Date(),
    },
    select: requestSelect,
  });

  const io = req.app.get("io");
  io?.to(`user:${existing.fromUserId}`).emit("request:responded", withHasAttachment(request));

  res.json(withHasAttachment(request));
});

router.delete("/:id", async (req, res) => {
  const mineId = requireMineId(req, res);
  if (!mineId) return;
  const existing = await prisma.executiveRequest.findFirst({ where: { id: req.params.id, mineId } });
  if (!existing) return res.status(404).json({ error: "Request not found" });
  if (req.auth!.role !== "ADMIN" && existing.fromUserId !== req.auth!.userId) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  await prisma.executiveRequest.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;
