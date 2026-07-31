import bcrypt from "bcryptjs";
import { prisma } from "../prisma";

// Used to re-confirm an admin's identity for irreversible actions (e.g. deleting a
// document from the vault) even though they already hold a valid session token.
export async function verifyAdminPassword(userId: string, password: string): Promise<boolean> {
  if (!password) return false;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  return bcrypt.compare(password, user.passwordHash);
}
