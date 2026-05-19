import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  roomId: integer("room_id").notNull(),
  rentAmount: integer("rent_amount").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  terms: text("terms"),
  ownerSignature: text("owner_signature"),
  tenantSignature: text("tenant_signature"),
  ownerSignedAt: timestamp("owner_signed_at"),
  tenantSignedAt: timestamp("tenant_signed_at"),
  status: text("status").notNull().default("draft"),
  contractPdfUrl: text("contract_pdf_url"),
  adminVerifiedAt: timestamp("admin_verified_at"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContractSchema = createInsertSchema(contractsTable).omit({
  id: true,
  createdAt: true,
  ownerSignedAt: true,
  tenantSignedAt: true,
  adminVerifiedAt: true,
});
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contractsTable.$inferSelect;
