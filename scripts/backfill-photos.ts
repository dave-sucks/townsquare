import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function createPrismaClient(): PrismaClient {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

async function backfillPhotos() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY not set");
    process.exit(1);
  }

  // Get all places and filter in JS since Prisma's JSON array query is tricky
  const allPlaces = await prisma.place.findMany();
  const places = allPlaces.filter(place => 
    !place.photoRefs || (Array.isArray(place.photoRefs) && place.photoRefs.length === 0)
  );

  console.log(`Found ${places.length} places without photos out of ${allPlaces.length} total`);

  let updated = 0;
  for (const place of places) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place.googlePlaceId)}&fields=photos&key=${apiKey}`
      );
      const data = await response.json() as { status: string; result?: { photos?: { photo_reference: string }[] } };

      if (data.status !== "OK") {
        console.log(`${place.name}: ${data.status}`);
        continue;
      }

      const photoRefs = data.result?.photos?.slice(0, 5).map((p) => p.photo_reference) || [];
      
      if (photoRefs.length > 0) {
        await prisma.place.update({
          where: { id: place.id },
          data: { photoRefs },
        });
        console.log(`${place.name}: ${photoRefs.length} photos`);
        updated++;
      } else {
        console.log(`${place.name}: no photos found`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: unknown) {
      console.error(`${place.name}: ${(error as Error).message}`);
    }
  }

  console.log(`Updated ${updated} places`);
  await prisma.$disconnect();
  process.exit(0);
}

backfillPhotos();
