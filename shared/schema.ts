import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, real, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const places = pgTable("places", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  googlePlaceId: text("google_place_id").notNull().unique(),
  name: text("name").notNull(),
  formattedAddress: text("formatted_address").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  primaryType: text("primary_type"),
  types: jsonb("types").$type<string[]>(),
  priceLevel: text("price_level"),
  photoRefs: jsonb("photo_refs").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const savedPlaceStatusEnum = pgEnum("saved_place_status", ["WANT", "BEEN"]);

export const savedPlaces = pgTable("saved_places", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  placeId: varchar("place_id", { length: 36 }).notNull().references(() => places.id),
  status: savedPlaceStatusEnum("status").notNull(),
  visitedAt: timestamp("visited_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertPlaceSchema = createInsertSchema(places).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedPlaceSchema = createInsertSchema(savedPlaces).omit({
  id: true,
  createdAt: true,
});

// Auth schemas
export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPlace = z.infer<typeof insertPlaceSchema>;
export type Place = typeof places.$inferSelect;
export type InsertSavedPlace = z.infer<typeof insertSavedPlaceSchema>;
export type SavedPlace = typeof savedPlaces.$inferSelect;
export type SavedPlaceStatus = "WANT" | "BEEN";

// Extended types for frontend
export type SavedPlaceWithPlace = SavedPlace & { place: Place };
export type PlaceWithSavedStatus = Place & { savedPlace?: SavedPlace };
