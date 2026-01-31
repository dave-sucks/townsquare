import { db } from "./db";
import { users, places, savedPlaces, type User, type InsertUser, type Place, type InsertPlace, type SavedPlace, type InsertSavedPlace, type SavedPlaceWithPlace, type PlaceWithSavedStatus } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(email: string, username: string, password: string): Promise<User>;
  
  getPlace(id: string): Promise<Place | undefined>;
  getPlaceByGooglePlaceId(googlePlaceId: string): Promise<Place | undefined>;
  upsertPlace(place: InsertPlace): Promise<Place>;
  
  getSavedPlace(userId: string, placeId: string): Promise<SavedPlace | undefined>;
  getSavedPlacesByUserId(userId: string): Promise<SavedPlaceWithPlace[]>;
  createSavedPlace(savedPlace: InsertSavedPlace): Promise<SavedPlace>;
  updateSavedPlaceStatus(userId: string, placeId: string, status: "WANT" | "BEEN"): Promise<SavedPlace | undefined>;
  deleteSavedPlace(userId: string, placeId: string): Promise<boolean>;
  
  getPlaceWithSavedStatus(placeId: string, userId: string): Promise<PlaceWithSavedStatus | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(email: string, username: string, password: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(users).values({
      email,
      username,
      passwordHash,
    }).returning();
    return user;
  }

  async getPlace(id: string): Promise<Place | undefined> {
    const [place] = await db.select().from(places).where(eq(places.id, id));
    return place;
  }

  async getPlaceByGooglePlaceId(googlePlaceId: string): Promise<Place | undefined> {
    const [place] = await db.select().from(places).where(eq(places.googlePlaceId, googlePlaceId));
    return place;
  }

  async upsertPlace(place: InsertPlace): Promise<Place> {
    const existing = await this.getPlaceByGooglePlaceId(place.googlePlaceId);
    if (existing) {
      const [updated] = await db.update(places)
        .set({ ...place, updatedAt: new Date() })
        .where(eq(places.googlePlaceId, place.googlePlaceId))
        .returning();
      return updated;
    }
    const [newPlace] = await db.insert(places).values(place).returning();
    return newPlace;
  }

  async getSavedPlace(userId: string, placeId: string): Promise<SavedPlace | undefined> {
    const [savedPlace] = await db.select()
      .from(savedPlaces)
      .where(and(eq(savedPlaces.userId, userId), eq(savedPlaces.placeId, placeId)));
    return savedPlace;
  }

  async getSavedPlacesByUserId(userId: string): Promise<SavedPlaceWithPlace[]> {
    const results = await db.select({
      savedPlace: savedPlaces,
      place: places,
    })
    .from(savedPlaces)
    .innerJoin(places, eq(savedPlaces.placeId, places.id))
    .where(eq(savedPlaces.userId, userId))
    .orderBy(savedPlaces.createdAt);

    return results.map(r => ({
      ...r.savedPlace,
      place: r.place,
    }));
  }

  async createSavedPlace(savedPlace: InsertSavedPlace): Promise<SavedPlace> {
    const [result] = await db.insert(savedPlaces).values({
      ...savedPlace,
      visitedAt: savedPlace.status === "BEEN" ? new Date() : null,
    }).returning();
    return result;
  }

  async updateSavedPlaceStatus(userId: string, placeId: string, status: "WANT" | "BEEN"): Promise<SavedPlace | undefined> {
    const [updated] = await db.update(savedPlaces)
      .set({ 
        status, 
        visitedAt: status === "BEEN" ? new Date() : null 
      })
      .where(and(eq(savedPlaces.userId, userId), eq(savedPlaces.placeId, placeId)))
      .returning();
    return updated;
  }

  async deleteSavedPlace(userId: string, placeId: string): Promise<boolean> {
    const result = await db.delete(savedPlaces)
      .where(and(eq(savedPlaces.userId, userId), eq(savedPlaces.placeId, placeId)));
    return true;
  }

  async getPlaceWithSavedStatus(placeId: string, userId: string): Promise<PlaceWithSavedStatus | undefined> {
    const [place] = await db.select().from(places).where(eq(places.id, placeId));
    if (!place) return undefined;

    const [savedPlace] = await db.select()
      .from(savedPlaces)
      .where(and(eq(savedPlaces.placeId, placeId), eq(savedPlaces.userId, userId)));

    return {
      ...place,
      savedPlace: savedPlace || undefined,
    };
  }
}

export const storage = new DatabaseStorage();
