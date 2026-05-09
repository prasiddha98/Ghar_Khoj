import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contractsTable, usersTable, roomsTable } from "@workspace/db";
import { eq, or, desc } from "drizzle-orm";
import { authRequired, requireSelfParam, type AuthedRequest } from "../middlewares/auth";


const router: IRouter = Router();

router.post("/contracts", authRequired, async (req: AuthedRequest, res) => {
  try {
    const { matchId, tenantId, ownerId, roomId, rentAmount, startDate, endDate, terms } = req.body;
    if (!matchId || !tenantId || !ownerId || !roomId || !rentAmount || !startDate || !endDate) {
      return res.status(400).json({ error: "validation_error", message: "All fields required" });
    }

    const [existing] = await db.select().from(contractsTable).where(eq(contractsTable.matchId, matchId));
    if (existing) return res.json(existing);

    const [contract] = await db.insert(contractsTable)
      .values({ matchId, tenantId, ownerId, roomId, rentAmount, startDate, endDate, terms, status: "draft" })
      .returning();
    return res.status(201).json(contract);
  } catch (err) {
    req.log.error({ err }, "Error creating contract");
    return res.status(500).json({ error: "internal_error", message: "Failed to create contract" });
  }
});

router.get("/contracts/match/:matchId", async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId);
    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.matchId, matchId));
    if (!contract) return res.status(404).json({ error: "not_found", message: "Contract not found" });
    return res.json(contract);
  } catch (err) {
    req.log.error({ err }, "Error fetching contract");
    return res.status(500).json({ error: "internal_error", message: "Failed to fetch contract" });
  }
});

router.get("/contracts/user/:userId", authRequired, requireSelfParam("userId"), async (req: AuthedRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const contracts = await db.select().from(contractsTable)
      .where(or(eq(contractsTable.tenantId, userId), eq(contractsTable.ownerId, userId)))
      .orderBy(desc(contractsTable.createdAt));

    const enriched = await Promise.all(contracts.map(async (c) => {
      const [tenant] = await db.select().from(usersTable).where(eq(usersTable.id, c.tenantId));
      const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, c.ownerId));
      const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, c.roomId));
      return {
        ...c,
        tenant: tenant ? { id: tenant.id, firstName: tenant.firstName, lastName: tenant.lastName } : null,
        owner: owner ? { id: owner.id, firstName: owner.firstName, lastName: owner.lastName } : null,
        room: room ? { id: room.id, title: room.title, city: room.city, address: room.address } : null,
      };
    }));

    return res.json({ contracts: enriched });
  } catch (err) {
    req.log.error({ err }, "Error fetching user contracts");
    return res.status(500).json({ error: "internal_error", message: "Failed to fetch contracts" });
  }
});

router.patch("/contracts/:id/sign", authRequired, async (req: AuthedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { role, signature } = req.body;

    if (!["tenant", "owner"].includes(role) || !signature?.trim()) {
      return res.status(400).json({ error: "validation_error", message: "role and signature required" });
    }

    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
    if (!contract) return res.status(404).json({ error: "not_found", message: "Contract not found" });

    const now = new Date();
    const update = role === "owner"
      ? { ownerSignature: signature, ownerSignedAt: now }
      : { tenantSignature: signature, tenantSignedAt: now };

    const [updated] = await db.update(contractsTable).set(update).where(eq(contractsTable.id, id)).returning();

    const newStatus = updated.ownerSignature && updated.tenantSignature
      ? "fully_signed"
      : role === "owner"
      ? "owner_signed"
      : "tenant_signed";

    const [final] = await db.update(contractsTable).set({ status: newStatus }).where(eq(contractsTable.id, id)).returning();
    return res.json(final);
  } catch (err) {
    req.log.error({ err }, "Error signing contract");
    return res.status(500).json({ error: "internal_error", message: "Failed to sign contract" });
  }
});

router.patch("/contracts/:id/verify", authRequired, async (req: AuthedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { decision, adminNote } = req.body;

    if (!["verified", "cancelled"].includes(decision)) {
      return res.status(400).json({ error: "validation_error", message: "decision must be verified or cancelled" });
    }

    const [updated] = await db.update(contractsTable)
      .set({ status: decision, adminNote, adminVerifiedAt: new Date() })
      .where(eq(contractsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "not_found", message: "Contract not found" });
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error verifying contract");
    return res.status(500).json({ error: "internal_error", message: "Failed to verify contract" });
  }
});

router.get("/admin/contracts", authRequired, async (req: AuthedRequest, res) => {
  try {
    const contracts = await db.select().from(contractsTable).orderBy(desc(contractsTable.createdAt));

    const enriched = await Promise.all(contracts.map(async (c) => {
      const [tenant] = await db.select().from(usersTable).where(eq(usersTable.id, c.tenantId));
      const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, c.ownerId));
      const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, c.roomId));
      return {
        ...c,
        tenant: tenant ? { id: tenant.id, firstName: tenant.firstName, lastName: tenant.lastName, email: tenant.email } : null,
        owner: owner ? { id: owner.id, firstName: owner.firstName, lastName: owner.lastName, email: owner.email } : null,
        room: room ? { id: room.id, title: room.title, city: room.city, address: room.address, price: room.price } : null,
      };
    }));

    return res.json({ contracts: enriched });
  } catch (err) {
    req.log.error({ err }, "Error fetching admin contracts");
    return res.status(500).json({ error: "internal_error", message: "Failed to fetch contracts" });
  }
});

export default router;
