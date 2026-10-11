import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { usersTable, candidatesTable } from "@workspace/db/schema";
import { signToken, authMiddleware, type AuthRequest } from "../middleware/auth";
import { authRateLimiter } from "../middleware/rate-limiter";
import { sanitizeEmail } from "../middleware/sanitizer";

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

  res.status(201).json({
    token,
    onboarding,
    user: {
      id: newUser[0].id,
      email: newUser[0].email,
      name: newUser[0].name,
      role: newUser[0].role,
      phone: newUser[0].phone,
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

export default router;
