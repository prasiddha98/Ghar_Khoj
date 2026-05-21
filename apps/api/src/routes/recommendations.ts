import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  roomsTable,
  interactionsTable,
  usersTable,
  tenantPreferencesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { authRequired, type AuthedRequest } from "../middlewares/auth";
import { buildRecommendationResults } from "../../../../services/ml/algorithms/recommendation";

const router: IRouter = Router();

/**
 * POST /recommendations
 * SECURITY FIX: Add authRequired, force userId from authenticated user
 */
router.post("/recommendations", authRequired, async (req: AuthedRequest, res) => {
  try {
    const { latitude, longitude, limit = 10, filters } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: "validation_error",
        message: "latitude and longitude are required",
      });
    }

    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({
        error: "validation_error",
        message: "Invalid latitude or longitude",
      });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        error: "validation_error",
        message: "Coordinates out of range",
      });
    }

    const limitNum = typeof limit === "number" ? limit : parseInt(limit as string, 10);
    if (Number.isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        error: "validation_error",
        message: "Limit must be between 1 and 100",
      });
    }

    // CRITICAL FIX: Force userId from authenticated user (prevent IDOR)
    const userId = req.user!.id;

    // Tenant preferences (used to filter + slightly adjust ranking)
    const [tenantPref] = await db
      .select()
      .from(tenantPreferencesTable)
      .where(eq(tenantPreferencesTable.userId, userId));

    const [user] = await db
      .select({ preferredCity: usersTable.preferredCity })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const allRooms = await db.select().from(roomsTable);

    if (allRooms.length === 0) {
      return res.json({ results: [], total: 0 });
    }

    const allInteractions = await db.select().from(interactionsTable);
    const allUsers = await db.select().from(usersTable);

    const results = buildRecommendationResults({
      rooms: allRooms,
      users: allUsers,
      interactions: allInteractions,
      tenantPref,
      userPreferredCity: user?.preferredCity || null,
      filters,
      latitude: lat,
      longitude: lon,
      userId,
      limit: limitNum,
    });

    return res.json({ results, total: results.length });
  } catch (err) {
    req.log.error({ err }, "Error generating recommendations");
    return res.status(500).json({
      error: "internal_error",
      message: "Failed to generate recommendations",
    });
  }
});

export default router;