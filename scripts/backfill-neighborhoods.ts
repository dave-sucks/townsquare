import { prisma } from "../src/lib/prisma";

async function backfillNeighborhoods() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY not set");
    process.exit(1);
  }

  const places = await prisma.place.findMany({
    where: {
      neighborhood: null,
    },
  });

  console.log(`Found ${places.length} places without neighborhood data`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const place of places) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place.googlePlaceId)}&fields=address_components&key=${apiKey}`
      );
      const data = await response.json();

      if (data.status !== "OK") {
        console.log(`${place.name}: ${data.status}`);
        errors++;
        continue;
      }

      const addressComponents = data.result?.address_components || [];
      let neighborhood: string | null = null;
      let locality: string | null = null;

      for (const component of addressComponents) {
        const types = component.types || [];
        if (types.includes("neighborhood") && !neighborhood) {
          neighborhood = component.long_name;
        }
        if (types.includes("sublocality_level_1") && !neighborhood) {
          neighborhood = component.long_name;
        }
        if (types.includes("sublocality") && !neighborhood) {
          neighborhood = component.long_name;
        }
        if (types.includes("locality") && !locality) {
          locality = component.long_name;
        }
      }

      if (neighborhood || locality) {
        await prisma.place.update({
          where: { id: place.id },
          data: {
            neighborhood,
            locality,
          },
        });
        console.log(`✓ ${place.name}: ${neighborhood || locality}`);
        updated++;
      } else {
        console.log(`- ${place.name}: no neighborhood data found`);
        skipped++;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      console.error(`✗ ${place.name}: ${error.message}`);
      errors++;
    }
  }

  console.log(`\nComplete: ${updated} updated, ${skipped} skipped, ${errors} errors`);
  
  await prisma.$disconnect();
}

backfillNeighborhoods();
