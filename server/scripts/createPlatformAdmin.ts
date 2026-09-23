/**
 * One-off bootstrap for the platform licensing admin tool. There is no self-registration
 * for PlatformAdmin accounts on purpose (unlike Buyer, which has a public signup) — anyone
 * who could create one would have visibility into every customer's licensing, so the first
 * (and any later) account is created by whoever holds deploy access, via this script.
 *
 * Usage:
 *   cd server
 *   npx tsx scripts/createPlatformAdmin.ts "Jane Smith" jane@mineguard.example "a-strong-password"
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/prisma";

async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error("Usage: npx tsx scripts/createPlatformAdmin.ts <name> <email> <password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const existing = await prisma.platformAdmin.findUnique({ where: { email } });
  if (existing) {
    console.error(`A platform admin with email ${email} already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.platformAdmin.create({ data: { name, email, passwordHash } });
  console.log(`Created platform admin ${admin.name} <${admin.email}> (id: ${admin.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
