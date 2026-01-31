import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { signupSchema, loginSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import session from "express-session";
import MemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const PgStore = connectPgSimple(session);

  app.use(
    session({
      store: new PgStore({
        pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "beli-secret-key-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // Auth middleware
  const requireAuth = (req: Request, res: Response, next: Function) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const data = signupSchema.parse(req.body);
      
      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }
      
      const existingUsername = await storage.getUserByUsername(data.username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }
      
      const user = await storage.createUser(data.email, data.username, data.password);
      req.session.userId = user.id;
      
      res.json({ user: { id: user.id, email: user.email, username: user.username, createdAt: user.createdAt } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Signup error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      const validPassword = await bcrypt.compare(data.password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      req.session.userId = user.id;
      
      res.json({ user: { id: user.id, email: user.email, username: user.username, createdAt: user.createdAt } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    res.json({ user: { id: user.id, email: user.email, username: user.username, createdAt: user.createdAt } });
  });

  // Google Places API proxy routes
  app.get("/api/places/autocomplete", requireAuth, async (req, res) => {
    try {
      const query = req.query.query as string;
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }
      
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=establishment&key=${apiKey}`
      );
      const data = await response.json();
      
      res.json(data);
    } catch (error) {
      console.error("Autocomplete error:", error);
      res.status(500).json({ message: "Failed to search places" });
    }
  });

  app.get("/api/places/details", requireAuth, async (req, res) => {
    try {
      const placeId = req.query.placeId as string;
      if (!placeId) {
        return res.status(400).json({ message: "Place ID is required" });
      }
      
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=place_id,name,formatted_address,geometry,types,price_level,photos&key=${apiKey}`
      );
      const data = await response.json();
      
      res.json(data);
    } catch (error) {
      console.error("Place details error:", error);
      res.status(500).json({ message: "Failed to get place details" });
    }
  });

  // Save place
  app.post("/api/places/save", requireAuth, async (req, res) => {
    try {
      const { googlePlaceId, name, formattedAddress, lat, lng, types, priceLevel, photoRefs, status } = req.body;
      
      if (!googlePlaceId || !name || !formattedAddress || lat === undefined || lng === undefined || !status) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      if (status !== "WANT" && status !== "BEEN") {
        return res.status(400).json({ message: "Status must be WANT or BEEN" });
      }
      
      // Upsert place
      const place = await storage.upsertPlace({
        googlePlaceId,
        name,
        formattedAddress,
        lat,
        lng,
        primaryType: types?.[0] || null,
        types: types || null,
        priceLevel: priceLevel || null,
        photoRefs: photoRefs || null,
      });
      
      // Check if already saved
      const existing = await storage.getSavedPlace(req.session.userId!, place.id);
      if (existing) {
        const updated = await storage.updateSavedPlaceStatus(req.session.userId!, place.id, status);
        return res.json({ savedPlace: updated, place });
      }
      
      // Create saved place
      const savedPlace = await storage.createSavedPlace({
        userId: req.session.userId!,
        placeId: place.id,
        status,
      });
      
      res.json({ savedPlace, place });
    } catch (error) {
      console.error("Save place error:", error);
      res.status(500).json({ message: "Failed to save place" });
    }
  });

  // Get saved places
  app.get("/api/saved-places", requireAuth, async (req, res) => {
    try {
      const savedPlaces = await storage.getSavedPlacesByUserId(req.session.userId!);
      res.json(savedPlaces);
    } catch (error) {
      console.error("Get saved places error:", error);
      res.status(500).json({ message: "Failed to get saved places" });
    }
  });

  // Get place with saved status
  app.get("/api/places/:id", requireAuth, async (req, res) => {
    try {
      const place = await storage.getPlaceWithSavedStatus(req.params.id, req.session.userId!);
      if (!place) {
        return res.status(404).json({ message: "Place not found" });
      }
      res.json(place);
    } catch (error) {
      console.error("Get place error:", error);
      res.status(500).json({ message: "Failed to get place" });
    }
  });

  // Update saved place status
  app.put("/api/places/:id/status", requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      if (status !== "WANT" && status !== "BEEN") {
        return res.status(400).json({ message: "Status must be WANT or BEEN" });
      }
      
      const place = await storage.getPlace(req.params.id);
      if (!place) {
        return res.status(404).json({ message: "Place not found" });
      }
      
      // Check if saved place exists
      const existing = await storage.getSavedPlace(req.session.userId!, req.params.id);
      if (!existing) {
        // Create new saved place
        const savedPlace = await storage.createSavedPlace({
          userId: req.session.userId!,
          placeId: req.params.id,
          status,
        });
        return res.json({ savedPlace });
      }
      
      const updated = await storage.updateSavedPlaceStatus(req.session.userId!, req.params.id, status);
      res.json({ savedPlace: updated });
    } catch (error) {
      console.error("Update status error:", error);
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  // Remove saved place
  app.delete("/api/places/:id/remove", requireAuth, async (req, res) => {
    try {
      await storage.deleteSavedPlace(req.session.userId!, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Remove place error:", error);
      res.status(500).json({ message: "Failed to remove place" });
    }
  });

  // Google Maps script proxy
  app.get("/api/maps/script", (req, res) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).send("Google Maps API key not configured");
    }
    res.redirect(`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&callback=initMap`);
  });

  return httpServer;
}
