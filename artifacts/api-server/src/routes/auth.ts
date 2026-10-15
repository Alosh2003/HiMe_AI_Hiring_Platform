import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { usersTable, candidatesTable } from "@workspace/db/schema";
import { signToken, authMiddleware, type AuthRequest } from "../middleware/auth";
import { authRateLimiter } from "../middleware/rate-limiter";
import { sanitizeEmail } from "../middleware/sanitizer";
import { issueAuthToken, consumeAuthToken } from "../lib/tokens";
import { sendEmail } from "../lib/email";
import { getConfig } from "../config/env";

const router: IRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(["seeker", "company"]).default("seeker"),
  phone: z.string().optional(),
});

router.post("/login", authRateLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const { email: rawEmail, password } = parsed.data;
  const email = sanitizeEmail(rawEmail);

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
    },
  });
});

router.post("/register", authRateLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const { name, email: rawEmail, password, role, phone } = parsed.data;
  const email = sanitizeEmail(rawEmail);

  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });

  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = await db.insert(usersTable).values({
    name,
    email,
    passwordHash,
    role,
    phone,
  }).returning();

  // Seed a candidate row so a brand-new seeker can upload a CV straight away.
  // Without it POST /api/candidates/cv and PATCH /profile both 404.
  let onboarding = false;
  if (role === "seeker") {
    await db.insert(candidatesTable).values({
      userId: newUser[0].id,
      preferences: { industries: [], contractTypes: [], remote: false },
      completion: 0,
    });
    onboarding = true;
  } else if (role === "company") {
    // No company row yet — it is created when they submit their details.
    onboarding = true;
  }

  const token = signToken({
    userId: newUser[0].id,
    email: newUser[0].email,
    role: newUser[0].role,
  });

  // Email verification: the account works immediately, but proving control
  // of the address is required before a company can enter the review queue.
  // The link is real — it lands in the outbox table in development.
  try {
    const verifyTokenValue = await issueAuthToken(newUser[0].id, "email-verification", 60 * 24);
    await sendEmail({
      to: email,
      kind: "email-verification",
      subject: "HiMe AI — تأكيد البريد الإلكتروني",
      body: `مرحباً ${name}،\n\nأكمل التسجيل بزيارة هذا الرابط:\n${getConfig().FRONTEND_URL}/verify-email?token=${verifyTokenValue}\n\nالرابط صالح لمدة 24 ساعة.`,
    });
  } catch {
    // Verification is best-effort; registration must still succeed.
  }

  res.status(201).json({
    token,
    onboarding,
    user: {
      id: newUser[0].id,
      email: newUser[0].email,
      name: newUser[0].name,
      role: newUser[0].role,
      phone: newUser[0].phone,
      emailVerified: false,
    },
  });
});

router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, req.user!.userId),
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  });
});

router.patch("/me", authMiddleware, async (req: AuthRequest, res) => {
  const updateSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    phone: z.string().optional(),
    avatarUrl: z.string().url().optional(),
  });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const updated = await db.update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, req.user!.userId))
    .returning();

  res.json({
    id: updated[0].id,
    email: updated[0].email,
    name: updated[0].name,
    role: updated[0].role,
    phone: updated[0].phone,
    avatarUrl: updated[0].avatarUrl,
  });
});

// ─── Password reset ──────────────────────────────────────────────────────

/**
 * Starts a password reset. The answer is identical whether or not the email
 * exists — an auth endpoint must not double as an account-existence oracle.
 * The link is delivered through the outbox (see lib/email.ts).
 */
router.post("/forgot-password", authRateLimiter, async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }

  const email = sanitizeEmail(parsed.data.email);
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.email, email) });

  if (user && user.isActive) {
    const token = await issueAuthToken(user.id, "password-reset", 30);
    await sendEmail({
      to: email,
      kind: "password-reset",
      subject: "HiMe AI — إعادة تعيين كلمة المرور",
      body: `مرحباً ${user.name}،\n\nطلب إعادة تعيين كلمة المرور. افتح هذا الرابط (صالح لمدة 30 دقيقة):\n${getConfig().FRONTEND_URL}/reset-password?token=${token}\n\nإذا لم تطلب هذا، تجاهل الرسالة.`,
    });
  }

  res.json({
    ok: true,
    message: "إذا كان البريد مسجلاً لدينا فسيصلك رابط إعادة التعيين.",
  });
});

router.post("/reset-password", authRateLimiter, async (req, res) => {
  const parsed = z.object({
    token: z.string().min(10),
    password: z.string().min(8).max(100),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A reset token and a new password (8+ chars) are required" });
    return;
  }

  const userId = await consumeAuthToken(parsed.data.token, "password-reset");
  if (!userId) {
    res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one." });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  res.json({ ok: true });
});

// ─── Email verification ──────────────────────────────────────────────────

router.post("/verify-email", async (req, res) => {
  const parsed = z.object({ token: z.string().min(10) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A verification token is required" });
    return;
  }

  const userId = await consumeAuthToken(parsed.data.token, "email-verification");
  if (!userId) {
    res.status(400).json({ error: "This verification link is invalid or has expired." });
    return;
  }

  await db.update(usersTable)
    .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  res.json({ ok: true });
});

/** Re-sends the verification link. Same non-enumerating answer as forgot-password. */
router.post("/resend-verification", authRateLimiter, async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }

  const email = sanitizeEmail(parsed.data.email);
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.email, email) });

  if (user && user.isActive && !user.emailVerified) {
    const token = await issueAuthToken(user.id, "email-verification", 60 * 24);
    await sendEmail({
      to: email,
      kind: "email-verification",
      subject: "HiMe AI — تأكيد البريد الإلكتروني",
      body: `مرحباً ${user.name}،\n\nأكمل التسجيل بزيارة هذا الرابط:\n${getConfig().FRONTEND_URL}/verify-email?token=${token}\n\nالرابط صالح لمدة 24 ساعة.`,
    });
  }

  res.json({ ok: true, message: "إذا كان البريد بانتظر التأكيد فسيصلك رابط جديد." });
});

export default router;
