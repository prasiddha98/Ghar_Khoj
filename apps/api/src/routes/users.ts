import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authRequired, requireSelfParam, type AuthedRequest } from "../middlewares/auth";
import { safeParseInt } from "../lib/http";

function stripPassword(user: Record<string, unknown>) {

  const { passwordHash: _pw, password_hash: _ph, ...safe } = user;
  return safe;
}

const router: IRouter = Router();

function parseUpdateUser(body: Record<string, unknown>) {
  const allowed = ["firstName", "lastName", "phone", "bio", "preferredCity", "profilePhoto"] as const;
  const result: Partial<Record<(typeof allowed)[number], string>> = {};
  for (const key of allowed) {
    if (typeof body[key] === "string") result[key] = body[key] as string;
  }
  return result;
}

router.get("/users/:id", async (req, res) => {
  try {
    const id = safeParseInt(req.params.id);
    const [user] = await db.select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      phone: usersTable.phone,
      role: usersTable.role,
      isVerified: usersTable.isVerified,
      verificationStatus: usersTable.verificationStatus,
      profilePhoto: usersTable.profilePhoto,
      bio: usersTable.bio,
      preferredCity: usersTable.preferredCity,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.id, id));

    if (!user) {
      return res.status(404).json({ error: "not_found", message: "User not found" });
    }
    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal_error", message: "Failed to fetch user" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { firstName, lastName, email, phone, role, preferredCity } = req.body;
    if (!firstName || !email) return res.status(400).json({ error: "validation_error", message: "firstName and email required" });
    const [user] = await db.insert(usersTable).values({ firstName, lastName, email, phone, role: role || "tenant", preferredCity }).returning();
    return res.status(201).json(stripPassword(user as any));
  } catch (err) {
    req.log.error({ err }, "Error creating user");
    return res.status(400).json({ error: "validation_error", message: "Invalid user data" });
  }
});

router.patch("/users/:id", authRequired, requireSelfParam("id"), async (req: AuthedRequest, res) => { 
  try {
    const id = safeParseInt(req.params.id);
    const data = parseUpdateUser(req.body);
    const [user] = await db.update(usersTable).set(data).where(eq(usersTable.id, id)).returning();
    if (!user) {
      return res.status(404).json({ error: "not_found", message: "User not found" });
    }
    return res.json(stripPassword(user as any));
  } catch (err) {
    req.log.error({ err }, "Error updating user");
    return res.status(400).json({ error: "validation_error", message: "Invalid data" });
  }
});

export default router;