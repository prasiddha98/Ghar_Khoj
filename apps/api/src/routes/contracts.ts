import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contractsTable, usersTable, roomsTable, matchesTable } from "@workspace/db";
import { eq, or, desc } from "drizzle-orm";
import { authRequired, requireSelfParam, type AuthedRequest } from "../middlewares/auth";


const router: IRouter = Router();

router.post("/contracts", authRequired, async (req: AuthedRequest, res) => {
  try {
    const { matchId, tenantId, ownerId, roomId, rentAmount, startDate, endDate, terms } = req.body;
    
    // Validate all required fields exist
    if (!matchId || !tenantId || !ownerId || !roomId || rentAmount === undefined || !startDate || !endDate) {
      return res.status(400).json({ error: "validation_error", message: "All fields required" });
    }

    // Validate rentAmount is a positive number
    const rentAmountNum = typeof rentAmount === 'string' ? parseInt(rentAmount) : rentAmount;
    if (isNaN(rentAmountNum) || rentAmountNum <= 0) {
      return res.status(400).json({ error: "validation_error", message: "Rent amount must be a positive number" });
    }

    // Check if contract already exists for this match
    const [existing] = await db.select().from(contractsTable).where(eq(contractsTable.matchId, matchId));
    if (existing) return res.json(existing);

    // Ensure the contract rent matches the room price from the match
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!match) {
      return res.status(404).json({ error: "not_found", message: "Match not found" });
    }
    if (match.roomId !== roomId) {
      return res.status(400).json({ error: "validation_error", message: "Room does not match the selected match" });
    }

    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId));
    if (!room) {
      return res.status(404).json({ error: "not_found", message: "Room not found" });
    }

    const rentAmountToUse = Number(room.price);

    // Create new contract
    const [contract] = await db.insert(contractsTable)
      .values({ 
        matchId, 
        tenantId, 
        ownerId, 
        roomId, 
        rentAmount: rentAmountToUse, 
        startDate, 
        endDate, 
        terms, 
        status: "draft" 
      })
      .returning();

    await db.update(roomsTable)
      .set({ isAvailable: false })
      .where(eq(roomsTable.id, roomId));

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

router.get("/contracts/:id", authRequired, async (req: AuthedRequest, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, contractId));
    
    if (!contract) {
      return res.status(404).json({ error: "not_found", message: "Contract not found" });
    }

    // Verify user has access
    if (contract.tenantId !== req.user.id && contract.ownerId !== req.user.id) {
      return res.status(403).json({ error: "forbidden", message: "Not authorized to view this contract" });
    }

    // Enrich with related data
    const [tenant] = await db.select().from(usersTable).where(eq(usersTable.id, contract.tenantId));
    const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, contract.ownerId));
    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, contract.roomId));

    const enriched = {
      ...contract,
      tenant: tenant ? { id: tenant.id, firstName: tenant.firstName, lastName: tenant.lastName } : null,
      owner: owner ? { id: owner.id, firstName: owner.firstName, lastName: owner.lastName } : null,
      room: room ? { id: room.id, title: room.title, city: room.city, address: room.address } : null,
    };

    return res.json(enriched);
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

    if (newStatus === "fully_signed") {
      await db.update(roomsTable)
        .set({ isAvailable: false })
        .where(eq(roomsTable.id, updated.roomId));
    }

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

    // SECURITY: Check if user is admin
    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "forbidden", message: "Only admins can verify contracts" });
    }

    if (!["verified", "cancelled"].includes(decision)) {
      return res.status(400).json({ error: "validation_error", message: "decision must be verified or cancelled" });
    }

    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
    if (!contract) return res.status(404).json({ error: "not_found", message: "Contract not found" });

    // Prevent re-verification
    if (contract.status === "verified" || contract.status === "cancelled") {
      return res.status(400).json({ error: "validation_error", message: "Contract already finalized" });
    }

    const [updated] = await db.update(contractsTable)
      .set({ status: decision, adminNote, adminVerifiedAt: new Date() })
      .where(eq(contractsTable.id, id))
      .returning();

    // If verified, mark room as rented (is_available = false)
    if (decision === "verified" && contract.roomId) {
      await db.update(roomsTable)
        .set({ isAvailable: false })
        .where(eq(roomsTable.id, contract.roomId));
    }

    if (!updated) return res.status(404).json({ error: "not_found", message: "Contract not found" });
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error verifying contract");
    return res.status(500).json({ error: "internal_error", message: "Failed to verify contract" });
  }
});

router.get("/admin/contracts", authRequired, async (req: AuthedRequest, res) => {
  try {
    // SECURITY: Check if user is admin
    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "forbidden", message: "Only admins can view all contracts" });
    }

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

router.post("/contracts/:contractId/pdf-upload-url", authRequired, async (req: AuthedRequest, res) => {
  try {
    const { contractId } = req.params;
    
    // Verify the contract exists and the user has access
    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, parseInt(contractId)));
    if (!contract) {
      return res.status(404).json({ error: "not_found", message: "Contract not found" });
    }
    
    // Check if user is owner or tenant
    if (contract.ownerId !== req.user.id && contract.tenantId !== req.user.id) {
      return res.status(403).json({ error: "forbidden", message: "Not authorized to access this contract" });
    }
    
    // Generate upload URL for the PDF
    const { ObjectStorageService } = await import("../lib/objectStorage");
    const storage = new ObjectStorageService();
    const uploadUrl = await storage.getObjectEntityUploadURL();
    
    // Return the upload URL to the frontend
    return res.json({ uploadUrl });
  } catch (err) {
    req.log.error({ err }, "Error generating PDF upload URL");
    return res.status(500).json({ error: "internal_error", message: "Failed to generate upload URL" });
  }
});

router.post("/contracts/:contractId/pdf-store-url", authRequired, async (req: AuthedRequest, res) => {
  try {
    const { contractId } = req.params;
    const { objectPath } = req.body;
    
    if (!objectPath) {
      return res.status(400).json({ error: "validation_error", message: "objectPath required" });
    }
    
    // Verify the contract exists and the user has access
    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, parseInt(contractId)));
    if (!contract) {
      return res.status(404).json({ error: "not_found", message: "Contract not found" });
    }
    
    // Check if user is owner or tenant
    if (contract.ownerId !== req.user.id && contract.tenantId !== req.user.id) {
      return res.status(403).json({ error: "forbidden", message: "Not authorized to access this contract" });
    }
    
    // Update the contract with the PDF URL
    const normalizedObjectPath = storage.normalizeObjectEntityPath(objectPath);

    const [updated] = await db.update(contractsTable)
      .set({ contractPdfUrl: normalizedObjectPath })
      .where(eq(contractsTable.id, parseInt(contractId)))
      .returning();
    
    return res.json({ contractPdfUrl: updated.contractPdfUrl });
  } catch (err) {
    req.log.error({ err }, "Error storing PDF URL");
    return res.status(500).json({ error: "internal_error", message: "Failed to store PDF URL" });
  }
});

export default router;
