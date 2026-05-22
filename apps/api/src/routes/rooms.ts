import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { roomsTable, insertRoomSchema, contractsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc, or, inArray } from "drizzle-orm";
import { authRequired, requireSelfParam, type AuthedRequest } from "../middlewares/auth";
import { safeParseInt } from "../lib/http";


const router: IRouter = Router();

async function refreshRoomAvailability() {
  const today = new Date().toISOString().split("T")[0];
  // Only mark rooms as unavailable when contract is fully signed by both parties or verified by admin
  const activeContracts = await db.select({ roomId: contractsTable.roomId })
    .from(contractsTable)
    .where(and(
      or(
        eq(contractsTable.status, "fully_signed"),
        eq(contractsTable.status, "verified")
      ),
      gte(contractsTable.endDate, today)
    ));

  const activeRoomIds = activeContracts.map((c) => c.roomId);

  if (activeRoomIds.length > 0) {
    // Only mark rooms with a fully signed or verified contract as unavailable.
    // Do not override manual rented/available state for rooms without active contracts.
    await db.update(roomsTable).set({ isAvailable: false }).where(inArray(roomsTable.id, activeRoomIds));
  }
}

router.get("/rooms", async (req, res) => {
  try {
    await refreshRoomAvailability();
    const { city, minPrice, maxPrice, roomType, tenantType, parking, isVerified, limit = "20", offset = "0" } = req.query;


    const conditions: ReturnType<typeof eq>[] = [];

    if (city) conditions.push(eq(roomsTable.city, city as string));
    if (roomType) conditions.push(eq(roomsTable.roomType, roomType as string));
    if (tenantType) conditions.push(eq(roomsTable.tenantType, tenantType as string));
    if (parking === "true") conditions.push(eq(roomsTable.parking, true));
    if (parking === "false") conditions.push(eq(roomsTable.parking, false));
    if (isVerified === "true") conditions.push(eq(roomsTable.isVerified, true));
    if (isVerified === "false") conditions.push(eq(roomsTable.isVerified, false));
    if (minPrice) conditions.push(gte(roomsTable.price, parseFloat(minPrice as string)));
    if (maxPrice) conditions.push(lte(roomsTable.price, parseFloat(maxPrice as string)));

    const query = db.select().from(roomsTable).orderBy(desc(roomsTable.createdAt));
    const rooms = conditions.length > 0
      ? await query.where(and(...conditions)).limit(parseInt(limit as string)).offset(parseInt(offset as string))
      : await query.limit(parseInt(limit as string)).offset(parseInt(offset as string));

    const countQuery = conditions.length > 0
      ? db.select({ count: sql<number>`count(*)` }).from(roomsTable).where(and(...conditions))
      : db.select({ count: sql<number>`count(*)` }).from(roomsTable);
    const countResult = await countQuery;
    const total = Number(countResult[0].count);

    res.json({ rooms, total });
  } catch (err) {
    req.log.error({ err }, "Error fetching rooms");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch rooms" });
  }
});

router.get("/rooms/:id", async (req, res) => {
  try {
    await refreshRoomAvailability();
    const id = safeParseInt(req.params.id);
    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, id));
    if (!room) {
      return res.status(404).json({ error: "not_found", message: "Room not found" });
    }
    return res.json(room);
  } catch (err) {
    req.log.error({ err }, "Error fetching room");
    return res.status(500).json({ error: "internal_error", message: "Failed to fetch room" });
  }
});

router.post("/rooms", authRequired, async (req: AuthedRequest, res) => {
  try {
    const data = insertRoomSchema.parse(req.body);
    const [room] = await db.insert(roomsTable).values(data).returning();
    res.status(201).json(room);
  } catch (err) {
    req.log.error({ err }, "Error creating room");
    res.status(400).json({ error: "validation_error", message: "Invalid room data" });
  }
});

async function roomHasActiveContract(roomId: number) {
  const today = new Date().toISOString().split("T")[0];
  const [count] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contractsTable)
    .where(and(
      eq(contractsTable.roomId, roomId),
      or(
        eq(contractsTable.status, "draft"),
        eq(contractsTable.status, "owner_signed"),
        eq(contractsTable.status, "tenant_signed"),
        eq(contractsTable.status, "fully_signed"),
        eq(contractsTable.status, "verified")
      ),
      gte(contractsTable.endDate, today)
    ));
  return Number(count.count) > 0;
}

router.get("/rooms/owner/:ownerId", authRequired, requireSelfParam("ownerId"), async (req: AuthedRequest, res) => {
  try {
    await refreshRoomAvailability();
    const ownerId = safeParseInt(req.params.ownerId);
    const rooms = await db.select().from(roomsTable).where(eq(roomsTable.ownerId, ownerId));
    const roomIds = rooms.map((room) => room.id);
    const activeContracts = roomIds.length > 0
      ? await db.select({ roomId: contractsTable.roomId }).from(contractsTable)
        .where(and(
          inArray(contractsTable.roomId, roomIds),
          or(
            eq(contractsTable.status, "draft"),
            eq(contractsTable.status, "owner_signed"),
            eq(contractsTable.status, "tenant_signed"),
            eq(contractsTable.status, "fully_signed"),
            eq(contractsTable.status, "verified")
          ),
          gte(contractsTable.endDate, new Date().toISOString().split("T")[0])
        ))
      : [];
    const activeRoomSet = new Set(activeContracts.map((c) => c.roomId));
    const enrichedRooms = rooms.map((room) => ({
      ...room,
      hasActiveContract: activeRoomSet.has(room.id),
    }));
    res.json({ rooms: enrichedRooms, total: enrichedRooms.length });
  } catch (err) {
    req.log.error({ err }, "Error fetching owner rooms");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch rooms" });
  }
});

router.patch("/rooms/:id", authRequired, async (req: AuthedRequest, res) => {
  // authorization: only the room owner can update

  try {
    const id = safeParseInt(req.params.id);
    const allowed = ["title", "description", "price", "roomType", "tenantType", "parking", "amenities", "photos", "isAvailable", "nearbyLandmarks"] as const;
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const [existingRoom] = await db.select().from(roomsTable).where(eq(roomsTable.id, id));
    if (!existingRoom) return res.status(404).json({ error: "not_found", message: "Room not found" });


    if (!req.user || existingRoom.ownerId !== req.user.id) {
      return res.status(403).json({ error: "forbidden", message: "Cannot update other user's room" });
    }

    if (req.body.isAvailable !== undefined) {
      const newAvailability = req.body.isAvailable === true || req.body.isAvailable === "true";
      if (newAvailability && await roomHasActiveContract(id)) {
        return res.status(409).json({
          error: "conflict",
          message: "Cannot mark this room available while an active rental contract exists.",
        });
      }
      update.isAvailable = newAvailability;
    }

    const [room] = await db.update(roomsTable).set(update).where(eq(roomsTable.id, id)).returning();
    return res.json(room);
  } catch (err) {
    req.log.error({ err }, "Error updating room");
    return res.status(400).json({ error: "validation_error", message: "Invalid data" });
  }
});

router.delete("/rooms/:id", authRequired, async (req: AuthedRequest, res) => {
  try {
    const id = safeParseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "validation_error", message: "Invalid id" });

    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, id));
    if (!room) return res.status(404).json({ error: "not_found", message: "Room not found" });

    // Allow room owner or admin to delete
    if (!req.user || (room.ownerId !== req.user.id && req.user.role !== "admin")) {
      return res.status(403).json({ error: "forbidden", message: "Cannot delete other user's room" });
    }

    await db.delete(roomsTable).where(eq(roomsTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting room");
    return res.status(500).json({ error: "internal_error", message: "Failed to delete room" });
  }
});

export default router;
