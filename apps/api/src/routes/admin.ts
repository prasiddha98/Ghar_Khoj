import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, roomsTable, messagesTable, verificationDocsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { authRequired, requireRole, type AuthedRequest } from "../middlewares/auth";





const router: IRouter = Router();

router.get("/admin/stats", authRequired, requireRole(["admin"]), async (req: AuthedRequest, res) => {
  try {
    const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
    const [roomsCount] = await db.select({ count: sql<number>`count(*)` }).from(roomsTable);
    const [messagesCount] = await db.select({ count: sql<number>`count(*)` }).from(messagesTable);
    const [verifiedCount] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.isVerified, true));
    const [pendingCount] = await db.select({ count: sql<number>`count(*)` }).from(verificationDocsTable).where(eq(verificationDocsTable.status, "pending"));
    const [availableCount] = await db.select({ count: sql<number>`count(*)` }).from(roomsTable).where(eq(roomsTable.isAvailable, true));
    const [unverifiedRoomsCount] = await db.select({ count: sql<number>`count(*)` }).from(roomsTable).where(eq(roomsTable.isVerified, false));

    return res.json({
      totalUsers: Number(usersCount.count),
      totalRooms: Number(roomsCount.count),
      pendingVerifications: Number(pendingCount.count),
      totalMessages: Number(messagesCount.count),
      verifiedUsers: Number(verifiedCount.count),
      availableRooms: Number(availableCount.count),
      unverifiedRooms: Number(unverifiedRoomsCount.count),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching admin stats");
    return res.status(500).json({ error: "internal_error", message: "Failed to fetch stats" });
  }
});

function normalizeVerificationMediaUrl(rawUrl: string | null) {
  if (!rawUrl) return null;
  try {
    return objectStorageService.normalizeObjectEntityPath(rawUrl);
  } catch {
    return rawUrl;
  }
}

router.get("/admin/verifications", authRequired, requireRole(["admin"]), async (req: AuthedRequest, res) => {
  try {
    const verifications = await db.select({
      id: verificationDocsTable.id,
      userId: verificationDocsTable.userId,
      docType: verificationDocsTable.docType,
      docUrl: verificationDocsTable.docUrl,
      selfieUrl: verificationDocsTable.selfieUrl,
      citizenshipNumber: verificationDocsTable.citizenshipNumber,
      fullNameCitizenship: verificationDocsTable.fullNameCitizenship,
      dateOfBirth: verificationDocsTable.dateOfBirth,
      issueDate: verificationDocsTable.issueDate,
      docPhotoUrl: verificationDocsTable.docPhotoUrl,
      status: verificationDocsTable.status,
      adminNote: verificationDocsTable.adminNote,
      createdAt: verificationDocsTable.createdAt,
    }).from(verificationDocsTable).orderBy(desc(verificationDocsTable.createdAt));

    const normalizedVerifications = verifications.map((verification) => ({
      ...verification,
      docUrl: normalizeVerificationMediaUrl(verification.docUrl),
      selfieUrl: normalizeVerificationMediaUrl(verification.selfieUrl),
      docPhotoUrl: normalizeVerificationMediaUrl(verification.docPhotoUrl),
    }));

    return res.json({ verifications: normalizedVerifications });
  } catch (err) {
    req.log.error({ err }, "Error fetching verifications");
    return res.status(500).json({ error: "internal_error", message: "Failed to fetch verifications" });
  }
});

router.get("/admin/users", authRequired, requireRole(["admin"]), async (req: AuthedRequest, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    return res.json({ users, total: users.length });
  } catch (err) {
    req.log.error({ err }, "Error fetching users");
    return res.status(500).json({ error: "internal_error", message: "Failed to fetch users" });
  }
});

router.get("/admin/rooms", authRequired, requireRole(["admin"]), async (req: AuthedRequest, res) => {
  try {
    const rooms = await db.select().from(roomsTable).orderBy(desc(roomsTable.createdAt));
    return res.json({ rooms, total: rooms.length });
  } catch (err) {
    req.log.error({ err }, "Error fetching rooms");
    return res.status(500).json({ error: "internal_error", message: "Failed to fetch rooms" });
  }
});

router.patch("/admin/rooms/:id/verify", authRequired, requireRole(["admin"]), async (req: AuthedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [room] = await db.update(roomsTable).set({ isVerified: true }).where(eq(roomsTable.id, id)).returning();
    if (!room) return res.status(404).json({ error: "not_found", message: "Room not found" });
    return res.json(room);
  } catch (err) {
    req.log.error({ err }, "Error verifying room");
    return res.status(500).json({ error: "internal_error", message: "Failed to verify room" });
  }
});

router.patch("/admin/users/:id/role", authRequired, requireRole(["admin"]), async (req: AuthedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { role } = req.body;
    if (!["tenant", "owner", "admin"].includes(role)) {
      return res.status(400).json({ error: "invalid_role", message: "Role must be tenant, owner, or admin" });
    }
    const [user] = await db.update(usersTable).set({ role }).where(eq(usersTable.id, id)).returning();
    if (!user) return res.status(404).json({ error: "not_found", message: "User not found" });
    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Error changing user role");
    return res.status(500).json({ error: "internal_error", message: "Failed to change role" });
  }
});

router.post("/admin/verifications/:docId/reject", authRequired, requireRole(["admin"]), async (req: AuthedRequest, res) => {
  try {
    const docId = parseInt(req.params.docId);
    const { note } = req.body;

    const [doc] = await db.select().from(verificationDocsTable).where(eq(verificationDocsTable.id, docId));
    if (!doc) {
      return res.status(404).json({ error: "not_found", message: "Verification not found" });
    }

    const updateResult = await db.update(verificationDocsTable)
      .set({ 
        status: "rejected", 
        adminNote: note || "Does not meet requirements",
      })
      .where(eq(verificationDocsTable.id, docId));

    if (!updateResult.rowCount) {
      return res.status(404).json({ error: "not_found", message: "Verification not found" });
    }

    await db.update(usersTable)
      .set({ verificationStatus: "rejected" })
      .where(eq(usersTable.id, doc.userId));

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error rejecting verification");
    return res.status(500).json({ error: "internal_error", message: "Failed to reject" });
  }
});

export default router;
