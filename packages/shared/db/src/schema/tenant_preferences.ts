import { pgTable, serial, integer, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tenantPreferencesTable = pgTable("tenant_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  roomType: text("room_type"),
  tenantType: text("tenant_type"),
  city: text("city"),
  minBudget: real("min_budget"),
  maxBudget: real("max_budget"),
  parking: boolean("parking").default(false),
  amenities: text("amenities").array().notNull().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTenantPreferenceSchema = createInsertSchema(tenantPreferencesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTenantPreference = z.infer<typeof insertTenantPreferenceSchema>;
export type TenantPreference = typeof tenantPreferencesTable.$inferSelect;
