const TYPE_EMOJI_MAP: Record<string, string> = {
  restaurant: "🍽️",
  cafe: "☕",
  coffee_shop: "☕",
  bar: "🍺",
  bakery: "🥐",
  meal_delivery: "🥡",
  meal_takeaway: "🥡",
  ice_cream_shop: "🍦",
  pizza_restaurant: "🍕",
  sushi_restaurant: "🍣",
  steak_house: "🥩",
  seafood_restaurant: "🦞",
  hamburger_restaurant: "🍔",
  sandwich_shop: "🥪",
  mexican_restaurant: "🌮",
  chinese_restaurant: "🥢",
  japanese_restaurant: "🍱",
  indian_restaurant: "🍛",
  thai_restaurant: "🍜",
  korean_restaurant: "🍜",
  vietnamese_restaurant: "🍜",
  ramen_restaurant: "🍜",
  brunch_restaurant: "🥞",
  breakfast_restaurant: "🥞",
  dessert_shop: "🍰",
  donut_shop: "🍩",
  juice_shop: "🧃",
  bubble_tea_store: "🧋",
  wine_bar: "🍷",
  cocktail_bar: "🍸",
  brewery: "🍺",
  pub: "🍺",
  night_club: "🎶",
  park: "🌳",
  gym: "💪",
  spa: "💆",
  hotel: "🏨",
  museum: "🏛️",
  art_gallery: "🎨",
  movie_theater: "🎬",
  theater: "🎭",
  shopping_mall: "🛍️",
  clothing_store: "👗",
  book_store: "📚",
  grocery_store: "🛒",
  supermarket: "🛒",
  hair_salon: "💇",
  beauty_salon: "💅",
  dentist: "🦷",
  doctor: "🏥",
  pharmacy: "💊",
  hospital: "🏥",
  church: "⛪",
  mosque: "🕌",
  synagogue: "🕍",
  temple: "🛕",
  school: "🏫",
  university: "🎓",
  library: "📖",
  airport: "✈️",
  train_station: "🚂",
  bus_station: "🚌",
  gas_station: "⛽",
  car_wash: "🚗",
  stadium: "🏟️",
  amusement_park: "🎢",
  zoo: "🦁",
  aquarium: "🐠",
  bowling_alley: "🎳",
  golf_course: "⛳",
  beach: "🏖️",
  campground: "🏕️",
  ski_resort: "⛷️",
  tourist_attraction: "📍",
};

export function getDefaultEmoji(primaryType: string | null, types: string[] | null): string {
  if (primaryType) {
    const normalized = primaryType.toLowerCase().replace(/\s+/g, "_");
    if (TYPE_EMOJI_MAP[normalized]) {
      return TYPE_EMOJI_MAP[normalized];
    }
  }

  if (types && types.length > 0) {
    for (const type of types) {
      const normalized = type.toLowerCase().replace(/\s+/g, "_");
      if (TYPE_EMOJI_MAP[normalized]) {
        return TYPE_EMOJI_MAP[normalized];
      }
    }
  }

  return "📌";
}
