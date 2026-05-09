import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// adjust import path if needed
import { usersTable } from "./users";

export const verificationDocsTable = pgTable("verification_docs", {
  id: serial("id").primaryKey(),

  userId: integer("user_id").notNull(),

  docType: text("doc_type").notNull(),

  docUrl: text("doc_url").notNull(),

  selfieUrl: text("selfie_url").notNull(),

  citizenshipNumber: text("citizenship_number"),

  fullNameCitizenship: text("full_name_citizenship"),

  dateOfBirth: text("date_of_birth"),

  issueDate: text("issue_date"),

  docPhotoUrl: text("doc_photo_url"),

  status: text("status").notNull().default("pending"),

  adminNote: text("admin_note"),

  approvedAt: timestamp("approved_at"),

  approvedBy: integer("approved_by").references(() => usersTable.id),

  rejectedAt: timestamp("rejected_at"),

  rejectedBy: integer("rejected_by").references(() => usersTable.id),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVerificationDocSchema =
  createInsertSchema(verificationDocsTable).omit({
    id: true,
    createdAt: true,
  });

export type InsertVerificationDoc = z.infer<
  typeof insertVerificationDocSchema
>;

export type VerificationDoc =
  typeof verificationDocsTable.$inferSelect;