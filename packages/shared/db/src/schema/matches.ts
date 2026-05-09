import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  roomId: integer("room_id").notNull(),
  status: text("status").notNull().default("pending"),
  tenantStatus: text("tenant_status").notNull().default("pending"),
  ownerStatus: text("owner_status").notNull().default("pending"),
  matchScore: integer("match_score").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
