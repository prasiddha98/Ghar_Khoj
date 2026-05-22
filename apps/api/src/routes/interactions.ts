import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { interactionsTable, roomsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authRequired, type AuthedRequest } from "../middlewares/auth";
import { safeParseInt } from "../lib/http";

const router: IRouter = Router();

/**
 * POST /interactions
 * SECURITY FIX: Add authRequired, force userId from authenticated user
 */
router.post("/interactions", authRequired, async (req: AuthedRequest, res) => {
  try {
    const { roomId, type } = req.body;

    if (!roomId || !type) {
      return res.status(400).json({
        error: "validation_error",
        message: "roomId and type are required",
      });
    }

    const validTypes = ["view", "save", "rent"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: "validation_error",
        message: `Invalid interaction type. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    const roomIdNum = parseInt(roomId);
    if (Number.isNaN(roomIdNum)) {
      return res.status(400).json({
        error: "validation_error",
        message: "Invalid room ID",
      });
    }

    const [room] = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, roomIdNum));

    if (!room) {
      return res.status(404).json({
        error: "not_found",
        message: "Room not found",
      });
    }

    // CRITICAL FIX: Force userId from authenticated user (prevent spoofing)
    const userId = req.user!.id;

    const [interaction] = await db
      .insert(interactionsTable)
      .values({
        userId,
        roomId: roomIdNum,
        type,
      })
      .returning();

    return res.status(201).json(interaction);
  } catch (err) {
    req.log.error({ err }, "Error creating interaction");
    return res.status(400).json({
      error: "validation_error",
      message: "Invalid data",
    });
  }
});

/**
 * GET /interactions/user/:userId
 * SECURITY FIX: Add authRequired, IDOR protection
 */
router.get(
  "/interactions/user/:userId",
  authRequired,
  async (req: AuthedRequest, res) => {
    try {
      const userIdParam = safeParseInt(req.params.userId);
      const { type } = req.query;

      if (Number.isNaN(userIdParam)) {
        return res.status(400).json({
          error: "validation_error",
          message: "Invalid user ID",
        });
      }

      // CRITICAL FIX: Prevent IDOR - can only access own interactions
      if (userIdParam !== req.user!.id) {
        return res.status(403).json({
          error: "forbidden",
          message: "Cannot access other user's interactions",
        });
      }

      const userId = userIdParam;

      const conditions = [eq(interactionsTable.userId, userId)];

      if (type) {
        const validTypes = ["view", "save", "rent"];
        if (!validTypes.includes(type as string)) {
          return res.status(400).json({
            error: "validation_error",
            message: `Invalid type filter. Must be one of: ${validTypes.join(", ")}`,
          });
        }
        conditions.push(eq(interactionsTable.type, type as string));
      }

      const interactions = await db
        .select()
        .from(interactionsTable)
        .where(and(...conditions));

      return res.json({ interactions });
    } catch (err) {
      req.log.error({ err }, "Error fetching interactions");
      return res.status(500).json({
        error: "internal_error",
        message: "Failed to fetch interactions",
      });
    }
  }
);

export default router;