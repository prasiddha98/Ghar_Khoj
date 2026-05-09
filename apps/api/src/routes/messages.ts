import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { messagesTable, usersTable } from "@workspace/db";
import { eq, or, and, desc, inArray } from "drizzle-orm";
import { authRequired, type AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

/**
 * POST /messages
 * SECURITY FIX: Add authRequired, force senderId from req.user, prevent spoofing
 */
router.post("/messages", authRequired, async (req: AuthedRequest, res) => {
  try {
    const { receiverId, roomId, content, mediaUrl, mediaType } = req.body;
    
    if (receiverId === undefined) {
      return res.status(400).json({ 
        error: "validation_error", 
        message: "receiverId is required" 
      });
    }

    const receiverIdNum = parseInt(receiverId);
    if (Number.isNaN(receiverIdNum)) {
      return res.status(400).json({
        error: "validation_error",
        message: "Invalid receiverId"
      });
    }

    // CRITICAL FIX: Force senderId from authenticated user (prevent spoofing)
    const senderId = req.user!.id;

    // Verify both users exist
    const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, senderId));
    const [receiver] = await db.select().from(usersTable).where(eq(usersTable.id, receiverIdNum));

    if (!sender) {
      return res.status(401).json({ error: "unauthorized", message: "User not found" });
    }

    if (!receiver) {
      return res.status(404).json({ 
        error: "not_found", 
        message: "Recipient user not found" 
      });
    }

    // Prevent self-messaging
    if (senderId === receiverIdNum) {
      return res.status(400).json({
        error: "validation_error",
        message: "Cannot send messages to yourself"
      });
    }

    const [message] = await db.insert(messagesTable).values({
      senderId,
      receiverId: receiverIdNum,
      roomId: roomId ? parseInt(roomId) : null,
      content: content || "",
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
    }).returning();

    return res.status(201).json(message);
  } catch (err) {
    req.log.error({ err }, "Error sending message");
    return res.status(400).json({ 
      error: "validation_error", 
      message: "Invalid data" 
    });
  }
});

/**
 * GET /messages/conversations/:userId
 * SECURITY FIX: Add authRequired, IDOR protection
 */
router.get(
  "/messages/conversations/:userId",
  authRequired,
  async (req: AuthedRequest, res) => {
    try {
      const userIdParam = parseInt(req.params.userId);

      if (Number.isNaN(userIdParam)) {
        return res.status(400).json({
          error: "validation_error",
          message: "Invalid user ID"
        });
      }

      // CRITICAL FIX: Prevent IDOR - can only access own conversations
      if (userIdParam !== req.user!.id) {
        return res.status(403).json({
          error: "forbidden",
          message: "Cannot access other user's conversations"
        });
      }

      const userId = userIdParam;

      const allMessages = await db
        .select()
        .from(messagesTable)
        .where(
          or(
            eq(messagesTable.senderId, userId), 
            eq(messagesTable.receiverId, userId)
          )
        )
        .orderBy(desc(messagesTable.createdAt));

      const partnerMap = new Map<number, { 
        lastMessage: typeof allMessages[0]; 
        unreadCount: number 
      }>();

      for (const msg of allMessages) {
        const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        if (!partnerMap.has(partnerId)) {
          partnerMap.set(partnerId, { lastMessage: msg, unreadCount: 0 });
        }
        if (msg.receiverId === userId && !msg.isRead) {
          partnerMap.get(partnerId)!.unreadCount += 1;
        }
      }

      const partnerIds = Array.from(partnerMap.keys());
      const partners = partnerIds.length > 0
        ? await db.select().from(usersTable).where(inArray(usersTable.id, partnerIds))
        : [];

      const conversations = partnerIds.map(pid => {
        const partner = partners.find(p => p.id === pid);
        const { lastMessage, unreadCount } = partnerMap.get(pid)!;
        
        // Don't expose password hash
        const safePartner = partner ? {
          id: partner.id,
          firstName: partner.firstName,
          lastName: partner.lastName,
          isVerified: partner.isVerified,
        } : null;

        return { partnerId: pid, partner: safePartner, lastMessage, unreadCount };
      });

      return res.json({ conversations });
    } catch (err) {
      req.log.error({ err }, "Error fetching conversations");
      return res.status(500).json({ 
        error: "internal_error", 
        message: "Failed to fetch conversations" 
      });
    }
  }
);

/**
 * GET /messages/:userId/:otherUserId
 * SECURITY FIX: Add authRequired, IDOR protection
 */
router.get(
  "/messages/:userId/:otherUserId",
  authRequired,
  async (req: AuthedRequest, res) => {
    try {
      const userIdParam = parseInt(req.params.userId);
      const otherUserId = parseInt(req.params.otherUserId);

      if (Number.isNaN(userIdParam) || Number.isNaN(otherUserId)) {
        return res.status(400).json({
          error: "validation_error",
          message: "Invalid user IDs"
        });
      }

      // CRITICAL FIX: Prevent IDOR - can only access conversations you're part of
      if (userIdParam !== req.user!.id) {
        return res.status(403).json({
          error: "forbidden",
          message: "Cannot access other user's messages"
        });
      }

      const userId = userIdParam;

      const messages = await db
        .select()
        .from(messagesTable)
        .where(
          or(
            and(eq(messagesTable.senderId, userId), eq(messagesTable.receiverId, otherUserId)),
            and(eq(messagesTable.senderId, otherUserId), eq(messagesTable.receiverId, userId))
          )
        )
        .orderBy(messagesTable.createdAt);

      // Mark messages as read when user views them
      await db.update(messagesTable)
        .set({ isRead: true })
        .where(
          and(
            eq(messagesTable.senderId, otherUserId), 
            eq(messagesTable.receiverId, userId)
          )
        );

      return res.json({ messages });
    } catch (err) {
      req.log.error({ err }, "Error fetching messages");
      return res.status(500).json({ 
        error: "internal_error", 
        message: "Failed to fetch messages" 
      });
    }
  }
);

export default router;