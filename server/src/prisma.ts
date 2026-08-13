import { PrismaClient } from "@prisma/client";
import { auditLogExtension } from "./lib/auditLog";

export const prisma = new PrismaClient().$extends(auditLogExtension());
