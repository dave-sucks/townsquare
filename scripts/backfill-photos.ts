import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function backfillPhotos() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY not set");
    process.exit(1);
  }

  // Get all places and filter in JS since JSON field queries are tricky
  const allPlaces = await prisma.place.findMany();
  const places = allPlaces.filter(p => 
    !p.photoRefs || 
    (Array.isArray(p.photoRefs) && (p.photoRefs as any[]).length === 0)
  );

  console.log(`Found ${places.length} places without photos`);

  for (const place of places) {
    console.log(`\nProcessing: ${place.name}`);
    console.log(`  Current place_id: ${place.googlePlaceId}`);
    
    try {
      // First try to get details with current place ID
      let response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place.googlePlaceId)}&fields=photos,price_level&key=${apiKey}`
      );
      let data = await response.json();

      // If NOT_FOUND, search by name + address to get fresh place ID
      if (data.status === "NOT_FOUND" || data.status === "INVALID_REQUEST") {
        console.log(`  Place ID invalid, searching for: ${place.name} ${place.formattedAddress}`);
        
        // Use text search to find the place
        const searchQuery = encodeURIComponent(`${place.name} ${place.formattedAddress}`);
        const searchResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&key=${apiKey}`
        );
        const searchData = await searchResponse.json();

        if (searchData.status !== "OK" || !searchData.results?.length) {
          console.log(`  Text search failed: ${searchData.status}`);
          continue;
        }

        const foundPlace = searchData.results[0];
        console.log(`  Found via text search: ${foundPlace.name}`);
        console.log(`  New place_id: ${foundPlace.place_id}`);

        // Update the place ID in database
        const newPlaceId = foundPlace.place_id;
        const photoRefs = foundPlace.photos?.slice(0, 5).map((p: any) => p.photo_reference) || [];
        
        const updates: any = {
          googlePlaceId: newPlaceId,
        };
        
        if (photoRefs.length > 0) {
          updates.photoRefs = photoRefs;
        }
        if (foundPlace.price_level) {
          updates.priceLevel = "$".repeat(foundPlace.price_level);
        }

        await prisma.place.update({
          where: { id: place.id },
          data: updates,
        });
        
        console.log(`  Updated with ${photoRefs.length} photos (from text search)`);
      } else if (data.status === "OK") {
        // Got a valid response from existing place ID
        const photoRefs = data.result?.photos?.slice(0, 5).map((p: any) => p.photo_reference) || [];
        const updates: any = {};
        
        if (photoRefs.length > 0) {
          updates.photoRefs = photoRefs;
        }
        if (data.result?.price_level) {
          updates.priceLevel = "$".repeat(data.result.price_level);
        }
        
        if (Object.keys(updates).length > 0) {
          await prisma.place.update({
            where: { id: place.id },
            data: updates,
          });
          console.log(`  Updated with ${photoRefs.length} photos`);
        } else {
          console.log(`  No photos available`);
        }
      } else {
        console.log(`  API error: ${data.status}`);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error: any) {
      console.error(`  Error: ${error.message}`);
    }
  }

  console.log("\nDone!");
  await pool.end();
}

backfillPhotos();
