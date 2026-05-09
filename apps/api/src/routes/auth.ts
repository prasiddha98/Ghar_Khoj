import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signAccessToken } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, role, preferredCity } = req.body;

    if (!firstName || !email || !password) {
      return res.status(400).json({ error: "validation_error", message: "First name, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "validation_error", message: "Password must be at least 6 characters" });
    }

    const safeRole = role === "owner" ? "owner" : "tenant";

    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
    if (existing.length > 0) {
      return res.status(409).json({ error: "conflict", message: "An account with this email already exists" });
    }

    const hash = await bcrypt.hash(password, 12);

    const [user] = await db.insert(usersTable).values({
      firstName: firstName.trim(),
      lastName: lastName?.trim() || null,
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      role: safeRole,
      preferredCity: preferredCity || null,
      passwordHash: hash,
    }).returning();

    const { passwordHash: _pw, ...safe } = user as any;
    return res.status(201).json(safe);
  } catch (err) {
    req.log.error({ err }, "Error registering user");
    return res.status(500).json({ error: "internal_error", message: "Registration failed" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "validation_error", message: "Email and password are required" });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));

    if (!user || !(user as any).passwordHash) {
      return res.status(401).json({ error: "auth_error", message: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, (user as any).passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "auth_error", message: "Invalid email or password" });
    }

    const { passwordHash: _pw, ...safe } = user as any;

    // Issue JWT so the frontend can call protected endpoints.
    const token = signAccessToken({ id: safe.id, role: safe.role });

    return res.json({ token, ...safe });
  } catch (err) {
    req.log.error({ err }, "Error logging in");
    return res.status(500).json({ error: "internal_error", message: "Login failed" });
  }
});

export default router;
