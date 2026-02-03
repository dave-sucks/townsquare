import { prisma } from "../src/lib/prisma";

const PLACE_TYPE_EMOJIS: Record<string, string> = {
  restaurant: "🍽️",
  italian_restaurant: "🍝",
  pizza_restaurant: "🍕",
  sushi_restaurant: "🍣",
  japanese_restaurant: "🍱",
  chinese_restaurant: "🥡",
  mexican_restaurant: "🌮",
  thai_restaurant: "🍜",
  indian_restaurant: "🍛",
  korean_restaurant: "🍲",
  vietnamese_restaurant: "🍜",
  greek_restaurant: "🥙",
  french_restaurant: "🥐",
  american_restaurant: "🍔",
  hamburger_restaurant: "🍔",
  seafood_restaurant: "🦞",
  steak_house: "🥩",
  bbq_restaurant: "🍖",
  ramen_restaurant: "🍜",
  noodle_restaurant: "🍜",
  vegetarian_restaurant: "🥗",
  vegan_restaurant: "🥗",
  mediterranean_restaurant: "🫒",
  middle_eastern_restaurant: "🧆",
  spanish_restaurant: "🥘",
  brunch_restaurant: "🥞",
  breakfast_restaurant: "🥞",
  sandwich_shop: "🥪",
  deli: "🥪",
  
  cafe: "☕",
  coffee_shop: "☕",
  bakery: "🥐",
  dessert_shop: "🍰",
  ice_cream_shop: "🍦",
  donut_shop: "🍩",
  chocolate_shop: "🍫",
  candy_store: "🍬",
  
  bar: "🍸",
  wine_bar: "🍷",
  cocktail_bar: "🍹",
  beer_bar: "🍺",
  pub: "🍺",
  brewery: "🍻",
  night_club: "🪩",
  
  fast_food_restaurant: "🍟",
  food_court: "🍱",
  food_truck: "🚚",
  
  grocery_store: "🛒",
  supermarket: "🛒",
  convenience_store: "🏪",
  farmers_market: "🥬",
  butcher_shop: "🥩",
  fish_market: "🐟",
  
  hotel: "🏨",
  resort_hotel: "🏖️",
  motel: "🛏️",
  bed_and_breakfast: "🏡",
  
  museum: "🏛️",
  art_gallery: "🎨",
  movie_theater: "🎬",
  theater: "🎭",
  concert_hall: "🎵",
  
  park: "🌳",
  beach: "🏖️",
  hiking_area: "🥾",
  campground: "⛺",
  zoo: "🦁",
  aquarium: "🐠",
  botanical_garden: "🌷",
  
  gym: "💪",
  spa: "💆",
  yoga_studio: "🧘",
  
  shopping_mall: "🛍️",
  clothing_store: "👕",
  shoe_store: "👟",
  jewelry_store: "💎",
  bookstore: "📚",
  
  tourist_attraction: "📸",
  landmark: "🗿",
  church: "⛪",
  temple: "🛕",
  mosque: "🕌",
  synagogue: "🕍",
  
  airport: "✈️",
  train_station: "🚂",
  bus_station: "🚌",
  
  hospital: "🏥",
  pharmacy: "💊",
  doctor: "👨‍⚕️",
  dentist: "🦷",
  
  school: "🏫",
  university: "🎓",
  library: "📖",
  
  bank: "🏦",
  atm: "💵",
  
  hair_salon: "💇",
  beauty_salon: "💅",
  
  gas_station: "⛽",
  car_wash: "🚗",
  car_repair: "🔧",
  
  laundry: "🧺",
  dry_cleaning: "👔",
  
  florist: "💐",
  pet_store: "🐾",
  veterinarian: "🐕",
};

const FALLBACK_EMOJI = "📍";

function getEmojiForPlace(primaryType: string | null, types: string[] | null): string {
  if (primaryType && PLACE_TYPE_EMOJIS[primaryType]) {
    return PLACE_TYPE_EMOJIS[primaryType];
  }
  
  if (types) {
    for (const type of types) {
      if (PLACE_TYPE_EMOJIS[type]) {
        return PLACE_TYPE_EMOJIS[type];
      }
    }
  }
  
  return FALLBACK_EMOJI;
}

async function backfillEmojis() {
  const savedPlaces = await prisma.savedPlace.findMany({
    where: {
      emoji: null,
    },
    include: {
      place: {
        select: {
          name: true,
          primaryType: true,
          types: true,
        },
      },
    },
  });

  console.log(`Found ${savedPlaces.length} saved places without emojis`);

  let updated = 0;
  let errors = 0;

  for (const savedPlace of savedPlaces) {
    try {
      const types = savedPlace.place.types as string[] | null;
      const emoji = getEmojiForPlace(
        savedPlace.place.primaryType,
        types
      );
      
      await prisma.savedPlace.update({
        where: { id: savedPlace.id },
        data: { emoji },
      });
      
      console.log(`✓ ${savedPlace.place.name}: ${emoji} (${savedPlace.place.primaryType || 'no type'})`);
      updated++;
    } catch (error: any) {
      console.error(`✗ ${savedPlace.place.name}: ${error.message}`);
      errors++;
    }
  }

  console.log(`\nComplete: ${updated} updated, ${errors} errors`);
  
  await prisma.$disconnect();
}

backfillEmojis();
