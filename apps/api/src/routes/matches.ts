import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { matchesTable, roomsTable, usersTable, contractsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authRequired, type AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

/**
 * POST /matches
 * SECURITY FIX: Add authRequired, force tenantId from authenticated user
 */
router.post("/matches", authRequired, async (req: AuthedRequest, res) => {
  try {
    const { ownerId, roomId, matchScore } = req.body;

    if (!ownerId || !roomId) {
      return res.status(400).json({ 
        error: "validation_error", 
        message: "ownerId and roomId are required" 
      });
    }

    const oId = parseInt(ownerId);
    const rId = parseInt(roomId);

    if (Number.isNaN(oId) || Number.isNaN(rId)) {
      return res.status(400).json({
        error: "validation_error",
        message: "Invalid IDs"
      });
    }

    // CRITICAL FIX: Force tenantId from authenticated user (prevent spoofing)
    const tenantId = req.user!.id;

    // Verify tenant exists and is verified
    const [tenant] = await db.select().from(usersTable).where(eq(usersTable.id, tenantId));
    if (!tenant) {
      return res.status(401).json({ error: "unauthorized", message: "Tenant not found" });
    }

    if (!tenant.isVerified) {
      return res.status(403).json({
        error: "forbidden",
        message: "You must be identity verified to show interest in properties"
      });
    }

    // Verify room exists
    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, rId));
    if (!room) {
      return res.status(404).json({
        error: "not_found",
        message: "Room not found"
      });
    }

    // Verify owner exists
    const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, oId));
    if (!owner) {
      return res.status(404).json({
        error: "not_found",
        message: "Owner not found"
      });
    }

    // Prevent tenant from creating match for wrong owner
    if (room.ownerId !== oId) {
      return res.status(400).json({
        error: "validation_error",
        message: "Owner ID does not match room owner"
      });
    }

    // Check for existing match (prevent duplicates)
    const [existing] = await db.select().from(matchesTable)
      .where(
        and(
          eq(matchesTable.tenantId, tenantId),
          eq(matchesTable.roomId, rId)
        )
      );

    if (existing) {
      return res.json(existing);
    }

    // Create match
    const [match] = await db.insert(matchesTable)
      .values({ 
        tenantId, 
        ownerId: oId, 
        roomId: rId, 
        matchScore: matchScore || 0, 
        status: "pending", 
        tenantStatus: "accepted", 
        ownerStatus: "pending" 
      })
      .returning();

    return res.status(201).json(match);
  } catch (err) {
    req.log.error({ err }, "Error creating match");
    return res.status(500).json({ 
      error: "internal_error", 
      message: "Failed to create match" 
    });
  }
});

/**
 * GET /matches/tenant/:tenantId
 * SECURITY FIX: Add authRequired, IDOR protection
 */
router.get("/matches/tenant/:tenantId", authRequired, async (req: AuthedRequest, res) => {
  try {
    const tenantIdParam = parseInt(req.params.tenantId);

    if (Number.isNaN(tenantIdParam)) {
      return res.status(400).json({
        error: "validation_error",
        message: "Invalid tenant ID"
      });
    }

    // CRITICAL FIX: Prevent IDOR - can only access own matches
    if (tenantIdParam !== req.user!.id) {
      return res.status(403).json({
        error: "forbidden",
        message: "Cannot access other user's matches"
      });
    }

    const matches = await db.select().from(matchesTable)
      .where(eq(matchesTable.tenantId, tenantIdParam));

    const enriched = await Promise.all(
      matches.map(async (m) => {
        const [room] = await db.select().from(roomsTable)
          .where(eq(roomsTable.id, m.roomId));
        const [owner] = await db.select().from(usersTable)
          .where(eq(usersTable.id, m.ownerId));

        return {
          ...m,
          room,
          owner: owner
            ? {
                id: owner.id,
                firstName: owner.firstName,
                lastName: owner.lastName,
                isVerified: owner.isVerified,
              }
            : null,
        };
      })
    );

    return res.json({ matches: enriched });
  } catch (err) {
    req.log.error({ err }, "Error fetching tenant matches");
    return res.status(500).json({ 
      error: "internal_error", 
      message: "Failed to fetch matches" 
    });
  }
});

/**
 * GET /matches/owner/:ownerId
 * SECURITY FIX: Add authRequired, IDOR protection
 */
router.get("/matches/owner/:ownerId", authRequired, async (req: AuthedRequest, res) => {
  try {
    const ownerIdParam = parseInt(req.params.ownerId);

    if (Number.isNaN(ownerIdParam)) {
      return res.status(400).json({
        error: "validation_error",
        message: "Invalid owner ID"
      });
    }

    // CRITICAL FIX: Prevent IDOR - can only access own matches
    if (ownerIdParam !== req.user!.id) {
      return res.status(403).json({
        error: "forbidden",
        message: "Cannot access other user's matches"
      });
    }

    const matches = await db.select().from(matchesTable)
      .where(eq(matchesTable.ownerId, ownerIdParam));

    const enriched = await Promise.all(
      matches.map(async (m) => {
        const [room] = await db.select().from(roomsTable)
          .where(eq(roomsTable.id, m.roomId));
        const [tenant] = await db.select().from(usersTable)
          .where(eq(usersTable.id, m.tenantId));

        return {
          ...m,
          room,
          tenant: tenant
            ? {
                id: tenant.id,
                firstName: tenant.firstName,
                lastName: tenant.lastName,
                isVerified: tenant.isVerified,
              }
            : null,
        };
      })
    );

    return res.json({ matches: enriched });
  } catch (err) {
    req.log.error({ err }, "Error fetching owner matches");
    return res.status(500).json({ 
      error: "internal_error", 
      message: "Failed to fetch matches" 
    });
  }
});

/**
 * PATCH /matches/:id/respond
 * SECURITY FIX: Add authRequired, validate user is participant
 */
router.patch("/matches/:id/respond", authRequired, async (req: AuthedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { decision } = req.body;

    if (Number.isNaN(id)) {
      return res.status(400).json({
        error: "validation_error",
        message: "Invalid match ID"
      });
    }

    if (!decision || !["accepted", "rejected"].includes(decision)) {
      return res.status(400).json({
        error: "validation_error",
        message: "Invalid decision. Must be 'accepted' or 'rejected'"
      });
    }

    const [match] = await db.select().from(matchesTable)
      .where(eq(matchesTable.id, id));

    if (!match) {
      return res.status(404).json({
        error: "not_found",
        message: "Match not found"
      });
    }

    // CRITICAL FIX: Determine actor role from match ownership (prevent spoofing)
    const userId = req.user!.id;
    let updateField: Record<string, string>;

    if (match.tenantId === userId) {
      updateField = { tenantStatus: decision };
    } else if (match.ownerId === userId) {
      updateField = { ownerStatus: decision };
    } else {
      return res.status(403).json({
        error: "forbidden",
        message: "You are not a participant in this match"
      });
    }

    const [updated] = await db.update(matchesTable)
      .set(updateField)
      .where(eq(matchesTable.id, id))
      .returning();

    const newStatus =
      updated.tenantStatus === "accepted" && updated.ownerStatus === "accepted"
        ? "accepted"
        : updated.tenantStatus === "rejected" || updated.ownerStatus === "rejected"
        ? "rejected"
        : "pending";

    const [final] = await db.update(matchesTable)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(matchesTable.id, id))
      .returning();

    // If match is now accepted, create a contract automatically
    if (newStatus === "accepted") {
      const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, final.roomId));
      if (room) {
        // Create contract with default 1-year term and room price
        const startDate = new Date().toISOString().split('T')[0]; // Today
        const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 1 year from now

        await db.insert(contractsTable).values({
          matchId: final.id,
          tenantId: final.tenantId,
          ownerId: final.ownerId,
          roomId: final.roomId,
          rentAmount: room.price,
          startDate,
          endDate,
          status: "draft",
          terms: `Standard rental agreement for ${room.title} located at ${room.address}, ${room.city}. Monthly rent: NPR ${room.price.toLocaleString()}. Term: ${startDate} to ${endDate}.`
        });
      }
    }

    return res.json(final);
  } catch (err) {
    req.log.error({ err }, "Error responding to match");
    return res.status(500).json({ 
      error: "internal_error", 
      message: "Failed to respond" 
    });
  }
});

/**
 * GET /matches/participants/:tenantId/:ownerId
 * Get match between two specific participants (for contract creation in chat)
 */
router.get("/matches/participants/:tenantId/:ownerId", authRequired, async (req: AuthedRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const ownerId = parseInt(req.params.ownerId);

    if (Number.isNaN(tenantId) || Number.isNaN(ownerId)) {
      return res.status(400).json({
        error: "validation_error",
        message: "Invalid IDs"
      });
    }

    // Verify user is one of the participants
    if (req.user!.id !== tenantId && req.user!.id !== ownerId) {
      return res.status(403).json({
        error: "forbidden",
        message: "You are not a participant in this match"
      });
    }

    const [match] = await db.select().from(matchesTable)
      .where(
        and(
          eq(matchesTable.tenantId, tenantId),
          eq(matchesTable.ownerId, ownerId)
        )
      );

    if (!match) {
      return res.status(404).json({
        error: "not_found",
        message: "No accepted match between these participants"
      });
    }

    // Enrich with room and user details
    const [room] = await db.select().from(roomsTable)
      .where(eq(roomsTable.id, match.roomId));
    const [tenant] = await db.select().from(usersTable)
      .where(eq(usersTable.id, match.tenantId));
    const [owner] = await db.select().from(usersTable)
      .where(eq(usersTable.id, match.ownerId));

    return res.json({
      ...match,
      room,
      tenant: tenant
        ? {
            id: tenant.id,
            firstName: tenant.firstName,
            lastName: tenant.lastName,
            email: tenant.email,
            phone: tenant.phone,
          }
        : null,
      owner: owner
        ? {
            id: owner.id,
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email,
            phone: owner.phone,
          }
        : null,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching match by participants");
    return res.status(500).json({
      error: "internal_error",
      message: "Failed to fetch match"
    });
  }
});

export default router;