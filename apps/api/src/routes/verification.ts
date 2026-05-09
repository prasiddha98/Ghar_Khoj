import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { verificationDocsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authRequired, requireRole, type AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

/**
 * POST /verification
 * SECURITY FIX: Force userId from authenticated user
 */
router.post("/verification", authRequired, async (req: AuthedRequest, res) => {
  try {
    console.log('Verification request body:', req.body);
    console.log('User from auth:', req.user);

    const {
      docType,
      citizenshipNumber,
      fullNameCitizenship,
      dateOfBirth,
      issueDate,
      docUrl,
      selfieUrl,
      docPhotoUrl,
    } = req.body;

    // Validate required fields with specific error messages
    const errors: Array<{ field: string; message: string }> = [];

    if (!docType || typeof docType !== 'string' || docType.trim() === '') {
      errors.push({ field: 'docType', message: 'Document type is required and must be a non-empty string' });
    }

    if (!citizenshipNumber || typeof citizenshipNumber !== 'string' || citizenshipNumber.trim() === '') {
      errors.push({ field: 'citizenshipNumber', message: 'Document number is required and must be a non-empty string' });
    }

    if (!fullNameCitizenship || typeof fullNameCitizenship !== 'string' || fullNameCitizenship.trim() === '') {
      errors.push({ field: 'fullNameCitizenship', message: 'Full name is required and must be a non-empty string' });
    }

    if (!dateOfBirth || typeof dateOfBirth !== 'string' || dateOfBirth.trim() === '') {
      errors.push({ field: 'dateOfBirth', message: 'Date of birth is required and must be a valid date string' });
    }

    if (!issueDate || typeof issueDate !== 'string' || issueDate.trim() === '') {
      errors.push({ field: 'issueDate', message: 'Issue date is required and must be a valid date string' });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: "validation_error",
        message: "Validation failed",
        details: errors,
      });
    }

    // Validate date formats
    let parsedDateOfBirth: Date;
    let parsedIssueDate: Date;

    try {
      parsedDateOfBirth = new Date(dateOfBirth);
      if (isNaN(parsedDateOfBirth.getTime())) {
        throw new Error('Invalid dateOfBirth format');
      }
    } catch {
      return res.status(400).json({
        error: "validation_error",
        message: "Invalid dateOfBirth format. Use ISO date string (YYYY-MM-DD)",
        field: "dateOfBirth"
      });
    }

    try {
      parsedIssueDate = new Date(issueDate);
      if (isNaN(parsedIssueDate.getTime())) {
        throw new Error('Invalid issueDate format');
      }
    } catch {
      return res.status(400).json({
        error: "validation_error",
        message: "Invalid issueDate format. Use ISO date string (YYYY-MM-DD)",
        field: "issueDate"
      });
    }

    // Validate logical date constraints
    const now = new Date();
    if (parsedDateOfBirth > now) {
      return res.status(400).json({
        error: "validation_error",
        message: "Date of birth cannot be in the future",
        field: "dateOfBirth"
      });
    }

    if (parsedIssueDate > now) {
      return res.status(400).json({
        error: "validation_error",
        message: "Issue date cannot be in the future",
        field: "issueDate"
      });
    }

    if (parsedDateOfBirth > parsedIssueDate) {
      return res.status(400).json({
        error: "validation_error",
        message: "Date of birth cannot be after issue date",
        field: "dateOfBirth"
      });
    }

    // CRITICAL FIX: Force userId from authenticated user (prevent submitting for others)
    const userId = req.user!.id;
    console.log('Using userId:', userId);

    const [existing] = await db
      .select()
      .from(verificationDocsTable)
      .where(eq(verificationDocsTable.userId, userId));

    console.log('Existing verification:', existing);

    if (existing) {
      if (existing.status === "pending") {
        return res.status(409).json({
          error: "conflict",
          message: "Verification already pending. Awaiting admin review.",
        });
      } else if (existing.status === "approved") {
        return res.status(409).json({
          error: "conflict",
          message: "You are already verified.",
        });
      }
    }

    const normalizedDocUrl = typeof docUrl === 'string' && docUrl.trim() !== '' ? docUrl.trim() : "pending-upload";
    const normalizedSelfieUrl = typeof selfieUrl === 'string' && selfieUrl.trim() !== '' ? selfieUrl.trim() : "pending-upload";
    const normalizedDocPhotoUrl = typeof docPhotoUrl === 'string' && docPhotoUrl.trim() !== '' ? docPhotoUrl.trim() : null;

    console.log('Inserting verification doc with data:', {
      userId,
      docType: docType.trim(),
      citizenshipNumber: citizenshipNumber.trim(),
      fullNameCitizenship: fullNameCitizenship.trim(),
      dateOfBirth: dateOfBirth,
      issueDate: issueDate,
      docUrl: normalizedDocUrl,
      selfieUrl: normalizedSelfieUrl,
      docPhotoUrl: normalizedDocPhotoUrl,
    });

    const [doc] = await db
      .insert(verificationDocsTable)
      .values({
        userId,
        docType: docType.trim(),
        docUrl: normalizedDocUrl,
        selfieUrl: normalizedSelfieUrl,
        citizenshipNumber: citizenshipNumber.trim(),
        fullNameCitizenship: fullNameCitizenship.trim(),
        dateOfBirth: dateOfBirth, // Store as received (should be YYYY-MM-DD)
        issueDate: issueDate, // Store as received (should be YYYY-MM-DD)
        docPhotoUrl: normalizedDocPhotoUrl,
        status: "pending",
      })
      .returning();

    console.log('Inserted doc:', doc);

    await db
      .update(usersTable)
      .set({ verificationStatus: "pending" })
      .where(eq(usersTable.id, userId));

    console.log('Updated user verification status');

    return res.status(201).json(doc);
  } catch (err: any) {
    req.log.error({ err }, "Error submitting verification");

    // Log the actual error for debugging
    console.error('Verification error:', err);

    // Handle specific database errors
    if (err.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        error: "conflict",
        message: "A verification request already exists for this user"
      });
    }

    if (err.code === '23503') { // Foreign key constraint violation
      return res.status(400).json({
        error: "validation_error",
        message: "Invalid user reference"
      });
    }

    if (err.code === '23502') { // Not null constraint violation
      return res.status(400).json({
        error: "validation_error",
        message: "Required field is missing"
      });
    }

    // Handle validation errors from Drizzle/Zod
    if (err.name === 'ZodError') {
      const validationErrors = err.errors.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({
        error: "validation_error",
        message: "Data validation failed",
        details: validationErrors,
      });
    }

    // Handle other specific errors with field information if available
    if (err.message) {
      // Try to extract field name from error message
      let field: string | undefined;
      if (err.message.includes('dateOfBirth')) field = 'dateOfBirth';
      else if (err.message.includes('issueDate')) field = 'issueDate';
      else if (err.message.includes('citizenshipNumber')) field = 'citizenshipNumber';
      else if (err.message.includes('fullName')) field = 'fullNameCitizenship';
      else if (err.message.includes('docType')) field = 'docType';

      return res.status(400).json({
        error: "validation_error",
        message: err.message,
        field: field
      });
    }

    // Generic fallback with more details
    return res.status(400).json({
      error: "validation_error",
      message: "An error occurred while processing your verification request",
      details: process.env.NODE_ENV === 'development' ? err.toString() : undefined
    });
  }
});

/**
 * POST /verification/:userId/approve
 * SECURITY FIX: Add requireRole(['admin'])
 */
router.post(
  "/verification/:docId/approve",
  authRequired,
  requireRole(["admin"]),
  async (req: AuthedRequest, res) => {
    try {
      const docId = parseInt(req.params.docId);

      if (Number.isNaN(docId)) {
        return res.status(400).json({
          error: "validation_error",
          message: "Invalid verification document ID",
        });
      }

      const [doc] = await db
        .select()
        .from(verificationDocsTable)
        .where(eq(verificationDocsTable.id, docId));

      if (!doc) {
        return res.status(404).json({
          error: "not_found",
          message: "Verification document not found",
        });
      }

      const updateResult = await db
        .update(verificationDocsTable)
        .set({
          status: "approved",
        })
        .where(eq(verificationDocsTable.id, docId));

      if (!updateResult.rowCount) {
        return res.status(404).json({ error: "not_found", message: "Verification document not found" });
      }

      await db
        .update(usersTable)
        .set({
          isVerified: true,
          verificationStatus: "approved",
        })
        .where(eq(usersTable.id, doc.userId));

      return res.json({ success: true });
    } catch (err) {
      req.log.error({ err }, "Error approving verification");
      return res.status(500).json({
        error: "internal_error",
        message: "Failed to approve",
      });
    }
  }
);

/**
 * POST /verification/:userId/reject
 * SECURITY FIX: Add requireRole(['admin'])
 */
router.post(
  "/verification/:docId/reject",
  authRequired,
  requireRole(["admin"]),
  async (req: AuthedRequest, res) => {
    try {
      const docId = parseInt(req.params.docId);
      const { note } = req.body;

      if (Number.isNaN(docId)) {
        return res.status(400).json({
          error: "validation_error",
          message: "Invalid verification document ID",
        });
      }

      const [doc] = await db
        .select()
        .from(verificationDocsTable)
        .where(eq(verificationDocsTable.id, docId));

      if (!doc) {
        return res.status(404).json({
          error: "not_found",
          message: "Verification document not found",
        });
      }

      const updateResult = await db
        .update(verificationDocsTable)
        .set({
          status: "rejected",
          adminNote: note || "Verification rejected.",
        })
        .where(eq(verificationDocsTable.id, docId));

      if (!updateResult.rowCount) {
        return res.status(404).json({ error: "not_found", message: "Verification document not found" });
      }

      await db
        .update(usersTable)
        .set({
          isVerified: false,
          verificationStatus: "rejected",
        })
        .where(eq(usersTable.id, doc.userId));

      return res.json({ success: true });
    } catch (err) {
      req.log.error({ err }, "Error rejecting verification");
      return res.status(500).json({
        error: "internal_error",
        message: "Failed to reject",
      });
    }
  }
);

export default router;