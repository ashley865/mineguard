import crypto from "crypto";
import { prisma } from "../prisma";
import { sendEmail } from "./email";

// A random high-entropy token doesn't need bcrypt's deliberately-slow hashing (that's for
// low-entropy human passwords) — a plain SHA-256 digest is enough to avoid storing the
// usable link in the database, and lets the token be looked up directly by its hash
// instead of scanning every account like a bcrypt comparison would require.
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
}

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

export async function sendBuyerVerificationEmail(buyerId: string, email: string, name: string): Promise<void> {
  const { token, hash } = generateToken();
  await prisma.buyer.update({ where: { id: buyerId }, data: { emailVerificationTokenHash: hash, emailVerificationSentAt: new Date() } });
  const link = `${CLIENT_ORIGIN}/verify-email?type=buyer&token=${token}`;
  await sendEmail({
    to: email,
    subject: "Verify your email — MineGuard Marketplace",
    text: `Hi ${name},\n\nConfirm your email to activate your MineGuard buyer account:\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    html: `<p>Hi ${name},</p><p>Confirm your email to activate your MineGuard buyer account:</p><p><a href="${link}">${link}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  });
}

export async function verifyBuyerEmailToken(token: string): Promise<{ success: boolean; message: string }> {
  const buyer = await prisma.buyer.findFirst({ where: { emailVerificationTokenHash: hashToken(token) } });
  if (!buyer) return { success: false, message: "This verification link is invalid or has already been used." };
  await prisma.buyer.update({ where: { id: buyer.id }, data: { emailVerifiedAt: new Date(), emailVerificationTokenHash: null } });
  return { success: true, message: "Email verified — you can now sign in." };
}

export async function sendContractorVerificationEmail(contractorId: string, email: string, name: string): Promise<void> {
  const { token, hash } = generateToken();
  await prisma.contractor.update({ where: { id: contractorId }, data: { emailVerificationTokenHash: hash, emailVerificationSentAt: new Date() } });
  const link = `${CLIENT_ORIGIN}/verify-email?type=contractor&token=${token}`;
  await sendEmail({
    to: email,
    subject: "Verify your email — MineGuard Contractor Portal",
    text: `Hi ${name},\n\nConfirm your email to activate your MineGuard contractor account:\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    html: `<p>Hi ${name},</p><p>Confirm your email to activate your MineGuard contractor account:</p><p><a href="${link}">${link}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  });
}

export async function verifyContractorEmailToken(token: string): Promise<{ success: boolean; message: string }> {
  const contractor = await prisma.contractor.findFirst({ where: { emailVerificationTokenHash: hashToken(token) } });
  if (!contractor) return { success: false, message: "This verification link is invalid or has already been used." };
  await prisma.contractor.update({ where: { id: contractor.id }, data: { emailVerifiedAt: new Date(), emailVerificationTokenHash: null } });
  return { success: true, message: "Email verified — you can now sign in." };
}
