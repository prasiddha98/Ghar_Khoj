import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tenantPreferencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authRequired, requireSelfParam, type AuthedRequest } from "../middlewares/auth";
import { safeParseInt } from "../lib/http";


const router: IRouter = Router();

router.get("/tenant-preferences/:userId", authRequired, requireSelfParam("userId"), async (req: AuthedRequest, res) => {
  try {
    const userId = safeParseInt(req.params.userId);
    const [pref] = await db.select().from(tenantPreferencesTable).where(eq(tenantPreferencesTable.userId, userId));
    if (!pref) {
      return res.status(404).json({ error: "not_found", message: "No preferences found" });
    }
    return res.json(pref);
  } catch (err) {
    req.log.error({ err }, "Error fetching tenant preferences");
    return res.status(500).json({ error: "internal_error", message: "Failed to fetch preferences" });
  }
});

router.put("/tenant-preferences/:userId", authRequired, requireSelfParam("userId"), async (req: AuthedRequest, res) => {
  try {
    const userId = safeParseInt(req.params.userId);
    const { roomType, tenantType, city, minBudget, maxBudget, parking, amenities, notes } = req.body;

    const [existing] = await db.select().from(tenantPreferencesTable).where(eq(tenantPreferencesTable.userId, userId));

    if (existing) {
      const [updated] = await db.update(tenantPreferencesTable)
        .set({ roomType, tenantType, city, minBudget, maxBudget, parking, amenities: amenities || [], notes, updatedAt: new Date() })
        .where(eq(tenantPreferencesTable.userId, userId))
        .returning();
      return res.json(updated);
    } else {
      const [created] = await db.insert(tenantPreferencesTable)
        .values({ userId, roomType, tenantType, city, minBudget, maxBudget, parking, amenities: amenities || [], notes })
        .returning();
      return res.json(created);
    }
  } catch (err) {
    req.log.error({ err }, "Error upserting tenant preferences");
    return res.status(500).json({ error: "internal_error", message: "Failed to save preferences" });
  }
});

export default router;