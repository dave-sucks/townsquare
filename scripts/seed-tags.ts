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

const TAG_CATEGORIES = [
  {
    slug: "vibe",
    displayName: "Vibe",
    description: "The atmosphere and feel of the place",
    searchWeight: 1.5,
    sortOrder: 1,
    iconName: "Sparkles",
    tags: [
      { slug: "classy", displayName: "Classy", sortOrder: 1 },
      { slug: "casual", displayName: "Casual", sortOrder: 2 },
      { slug: "dive-bar", displayName: "Dive Bar", sortOrder: 3 },
      { slug: "trendy", displayName: "Trendy", sortOrder: 4 },
      { slug: "cozy", displayName: "Cozy", sortOrder: 5 },
      { slug: "lively", displayName: "Lively", sortOrder: 6 },
      { slug: "romantic", displayName: "Romantic", sortOrder: 7 },
      { slug: "intimate", displayName: "Intimate", sortOrder: 8 },
      { slug: "upscale", displayName: "Upscale", sortOrder: 9 },
      { slug: "chill", displayName: "Chill", sortOrder: 10 },
    ],
  },
  {
    slug: "food-type",
    displayName: "Food Type",
    description: "The type of cuisine or food served",
    searchWeight: 2.0,
    sortOrder: 2,
    iconName: "Utensils",
    tags: [
      { slug: "burgers", displayName: "Burgers", sortOrder: 1 },
      { slug: "pizza", displayName: "Pizza", sortOrder: 2 },
      { slug: "sushi", displayName: "Sushi", sortOrder: 3 },
      { slug: "tacos", displayName: "Tacos", sortOrder: 4 },
      { slug: "italian", displayName: "Italian", sortOrder: 5 },
      { slug: "mexican", displayName: "Mexican", sortOrder: 6 },
      { slug: "asian-fusion", displayName: "Asian Fusion", sortOrder: 7 },
      { slug: "seafood", displayName: "Seafood", sortOrder: 8 },
      { slug: "steakhouse", displayName: "Steakhouse", sortOrder: 9 },
      { slug: "brunch", displayName: "Brunch", sortOrder: 10 },
      { slug: "chicken-sandwich", displayName: "Chicken Sandwich", sortOrder: 11 },
      { slug: "ramen", displayName: "Ramen", sortOrder: 12 },
      { slug: "thai", displayName: "Thai", sortOrder: 13 },
      { slug: "indian", displayName: "Indian", sortOrder: 14 },
      { slug: "mediterranean", displayName: "Mediterranean", sortOrder: 15 },
      { slug: "bbq", displayName: "BBQ", sortOrder: 16 },
      { slug: "french", displayName: "French", sortOrder: 17 },
      { slug: "chinese", displayName: "Chinese", sortOrder: 18 },
      { slug: "korean", displayName: "Korean", sortOrder: 19 },
      { slug: "vietnamese", displayName: "Vietnamese", sortOrder: 20 },
    ],
  },
  {
    slug: "occasion",
    displayName: "Good For",
    description: "What occasions the place is good for",
    searchWeight: 1.8,
    sortOrder: 3,
    iconName: "Calendar",
    tags: [
      { slug: "date-night", displayName: "Date Night", sortOrder: 1 },
      { slug: "group-dining", displayName: "Group Dining", sortOrder: 2 },
      { slug: "happy-hour", displayName: "Happy Hour", sortOrder: 3 },
      { slug: "late-night", displayName: "Late Night", sortOrder: 4 },
      { slug: "business-meal", displayName: "Business Meal", sortOrder: 5 },
      { slug: "birthday", displayName: "Birthday", sortOrder: 6 },
      { slug: "celebration", displayName: "Celebration", sortOrder: 7 },
      { slug: "quick-bite", displayName: "Quick Bite", sortOrder: 8 },
      { slug: "solo-dining", displayName: "Solo Dining", sortOrder: 9 },
      { slug: "family-friendly", displayName: "Family Friendly", sortOrder: 10 },
    ],
  },
  {
    slug: "features",
    displayName: "Features",
    description: "Special features and amenities",
    searchWeight: 1.2,
    sortOrder: 4,
    iconName: "Star",
    tags: [
      { slug: "outdoor-seating", displayName: "Outdoor Seating", sortOrder: 1 },
      { slug: "rooftop", displayName: "Rooftop", sortOrder: 2 },
      { slug: "live-music", displayName: "Live Music", sortOrder: 3 },
      { slug: "craft-cocktails", displayName: "Craft Cocktails", sortOrder: 4 },
      { slug: "natural-wine", displayName: "Natural Wine", sortOrder: 5 },
      { slug: "dog-friendly", displayName: "Dog Friendly", sortOrder: 6 },
      { slug: "private-dining", displayName: "Private Dining", sortOrder: 7 },
      { slug: "tasting-menu", displayName: "Tasting Menu", sortOrder: 8 },
      { slug: "reservations-required", displayName: "Reservations Required", sortOrder: 9 },
      { slug: "walk-ins-welcome", displayName: "Walk-ins Welcome", sortOrder: 10 },
      { slug: "open-kitchen", displayName: "Open Kitchen", sortOrder: 11 },
      { slug: "great-views", displayName: "Great Views", sortOrder: 12 },
    ],
  },
  {
    slug: "dietary",
    displayName: "Dietary",
    description: "Dietary options and accommodations",
    searchWeight: 1.0,
    sortOrder: 5,
    iconName: "Leaf",
    tags: [
      { slug: "vegetarian-friendly", displayName: "Vegetarian Friendly", sortOrder: 1 },
      { slug: "vegan-options", displayName: "Vegan Options", sortOrder: 2 },
      { slug: "gluten-free", displayName: "Gluten Free Options", sortOrder: 3 },
      { slug: "halal", displayName: "Halal", sortOrder: 4 },
      { slug: "kosher", displayName: "Kosher", sortOrder: 5 },
    ],
  },
  {
    slug: "drinks",
    displayName: "Drinks",
    description: "Drink specialties and options",
    searchWeight: 1.3,
    sortOrder: 6,
    iconName: "Wine",
    tags: [
      { slug: "great-wine-list", displayName: "Great Wine List", sortOrder: 1 },
      { slug: "cocktail-bar", displayName: "Cocktail Bar", sortOrder: 2 },
      { slug: "beer-selection", displayName: "Beer Selection", sortOrder: 3 },
      { slug: "sake", displayName: "Sake", sortOrder: 4 },
      { slug: "mezcal", displayName: "Mezcal", sortOrder: 5 },
      { slug: "whiskey-bar", displayName: "Whiskey Bar", sortOrder: 6 },
    ],
  },
];

async function seedTags() {
  console.log("Starting tag seeding...");

  for (const category of TAG_CATEGORIES) {
    console.log(`Creating category: ${category.displayName}`);
    
    const createdCategory = await prisma.tagCategory.upsert({
      where: { slug: category.slug },
      update: {
        displayName: category.displayName,
        description: category.description,
        searchWeight: category.searchWeight,
        sortOrder: category.sortOrder,
        iconName: category.iconName,
      },
      create: {
        slug: category.slug,
        displayName: category.displayName,
        description: category.description,
        searchWeight: category.searchWeight,
        sortOrder: category.sortOrder,
        iconName: category.iconName,
      },
    });

    for (const tag of category.tags) {
      await prisma.tag.upsert({
        where: { slug: tag.slug },
        update: {
          displayName: tag.displayName,
          sortOrder: tag.sortOrder,
          categoryId: createdCategory.id,
        },
        create: {
          slug: tag.slug,
          displayName: tag.displayName,
          sortOrder: tag.sortOrder,
          categoryId: createdCategory.id,
        },
      });
    }
  }

  console.log("Tag categories and tags seeded successfully!");
}

async function seedPlaceTags() {
  console.log("Assigning random tags to existing places...");

  const places = await prisma.place.findMany({ take: 50 });
  const tags = await prisma.tag.findMany({
    include: { category: true },
  });

  if (places.length === 0) {
    console.log("No places found to tag.");
    return;
  }

  if (tags.length === 0) {
    console.log("No tags found.");
    return;
  }

  const tagsByCategory = tags.reduce((acc, tag) => {
    const categorySlug = tag.category.slug;
    if (!acc[categorySlug]) {
      acc[categorySlug] = [];
    }
    acc[categorySlug].push(tag);
    return acc;
  }, {} as Record<string, typeof tags>);

  for (const place of places) {
    const tagsToAssign: string[] = [];

    if (tagsByCategory["vibe"]) {
      const vibeCount = Math.floor(Math.random() * 2) + 1;
      const shuffledVibes = [...tagsByCategory["vibe"]].sort(() => Math.random() - 0.5);
      tagsToAssign.push(...shuffledVibes.slice(0, vibeCount).map(t => t.id));
    }

    if (tagsByCategory["food-type"]) {
      const foodCount = Math.floor(Math.random() * 2) + 1;
      const shuffledFood = [...tagsByCategory["food-type"]].sort(() => Math.random() - 0.5);
      tagsToAssign.push(...shuffledFood.slice(0, foodCount).map(t => t.id));
    }

    if (tagsByCategory["occasion"] && Math.random() > 0.3) {
      const occasionCount = Math.floor(Math.random() * 2) + 1;
      const shuffledOccasion = [...tagsByCategory["occasion"]].sort(() => Math.random() - 0.5);
      tagsToAssign.push(...shuffledOccasion.slice(0, occasionCount).map(t => t.id));
    }

    if (tagsByCategory["features"] && Math.random() > 0.4) {
      const featureCount = Math.floor(Math.random() * 2) + 1;
      const shuffledFeatures = [...tagsByCategory["features"]].sort(() => Math.random() - 0.5);
      tagsToAssign.push(...shuffledFeatures.slice(0, featureCount).map(t => t.id));
    }

    for (const tagId of tagsToAssign) {
      try {
        await prisma.placeTag.upsert({
          where: {
            placeId_tagId: { placeId: place.id, tagId },
          },
          update: {},
          create: {
            placeId: place.id,
            tagId,
            source: "manual",
            confidence: 0.9 + Math.random() * 0.1,
          },
        });
      } catch (e) {
        // Skip if already exists
      }
    }

    console.log(`Tagged place: ${place.name} with ${tagsToAssign.length} tags`);
  }

  console.log("Place tags seeded successfully!");
}

async function main() {
  try {
    await seedTags();
    await seedPlaceTags();
  } catch (error) {
    console.error("Error seeding:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
