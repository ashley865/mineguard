import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { renderInvoiceHtml } from "../lib/invoiceHtml";

const router = Router();

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const invoiceSchema = z.object({
  siteId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  clientName: z.string().min(1),
  clientAddress: z.string().optional(),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientTaxNumber: z.string().optional(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date(),
  currency: z.string().optional(),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  lines: z.array(lineSchema).min(1),
});

const invoiceSelect = {
  id: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  invoiceNumber: true,
  clientName: true,
  clientAddress: true,
  clientEmail: true,
  clientTaxNumber: true,
  issueDate: true,
  dueDate: true,
  currency: true,
  vatRate: true,
  notes: true,
  status: true,
  documentId: true,
  createdBy: { select: { id: true, name: true } },
  lines: { select: { id: true, description: true, quantity: true, unitPrice: true, lineTotal: true } },
  createdAt: true,
} as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const siteId = req.query.siteId as string | undefined;
  const status = req.query.status as string | undefined;
  const invoices = await prisma.invoice.findMany({
    where: { siteId: siteId || undefined, status: (status as any) || undefined },
    select: invoiceSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(invoices);
});

router.get("/:id", async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: invoiceSelect });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  res.json(invoice);
});

router.post("/", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { lines, clientEmail, ...invoiceData } = parsed.data;
  const invoice = await prisma.invoice.create({
    data: {
      ...invoiceData,
      clientEmail: clientEmail || undefined,
      createdById: req.auth!.userId,
      lines: { create: lines.map((l) => ({ ...l, lineTotal: l.quantity * l.unitPrice })) },
    },
    include: { site: { select: { id: true, name: true } }, lines: true },
  });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { mineId: true } });
    const mine = user?.mineId ? await prisma.mine.findUnique({ where: { id: user.mineId }, select: { name: true } }) : null;
    const html = renderInvoiceHtml(invoice, mine?.name ?? "Mine Guard", invoice.site.name);
    const document = await prisma.document.create({
      data: {
        title: `Invoice ${invoice.invoiceNumber} — ${invoice.clientName}`,
        type: "INVOICE",
        version: "1.0",
        status: "ACTIVE",
        description: `Auto-generated invoice document for ${invoice.clientName}`,
        siteId: invoice.siteId,
        fileName: `Invoice-${invoice.invoiceNumber}.html`,
        fileMimeType: "text/html",
        fileSize: Buffer.byteLength(html),
        fileData: Buffer.from(html),
        uploadedById: req.auth!.userId,
      },
    });
    await prisma.invoice.update({ where: { id: invoice.id }, data: { documentId: document.id } });
  } catch {
    // Document Vault entry is a convenience mirror of the invoice; the invoice itself
    // has already been created successfully, so a failure here must not fail the request.
  }

  const full = await prisma.invoice.findUnique({ where: { id: invoice.id }, select: invoiceSelect });
  res.status(201).json(full);
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR", "EXECUTIVE"), async (req, res) => {
  const parsed = invoiceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { lines, clientEmail, ...invoiceData } = parsed.data;
  try {
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { ...invoiceData, clientEmail: clientEmail || undefined },
      select: invoiceSelect,
    });
    res.json(invoice);
  } catch {
    res.status(404).json({ error: "Invoice not found" });
  }
});

router.delete("/:id", requireRole("ADMIN", "EXECUTIVE"), async (req, res) => {
  try {
    await prisma.invoice.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Invoice not found" });
  }
});

export default router;
