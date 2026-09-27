/**
 * Taxonomy v2 (docs/ENGINE_SPEC.md → Taxonomy): the seed data and the SQL
 * that applies it. After the seed the database is the source of truth.
 *
 *   npx tsx scripts/taxonomy-v2.ts > prisma/migrations/0004_taxonomy_v2/migration.sql
 *
 * The generated migration creates the v2 categories and tags (with
 * definitions and synonyms), moves the v1 tags that survive (same slug, new
 * category), merges the
 * rest into their v2 tag (re-pointing review_tags, place_tags and
 * aggregates, and keeping the old slug as a synonym), and marks the 31
 * seed-script "manual" place tags as ai.
 */

type TagSeed = { slug: string; name: string; definition: string; synonyms?: string[] };
type CategorySeed = { slug: string; name: string; weight: number; tags: TagSeed[] };

export const TAXONOMY_V2: CategorySeed[] = [
  {
    slug: "venue",
    name: "Venue",
    weight: 1.2,
    tags: [
      { slug: "restaurant", name: "Restaurant", definition: "A sit-down or order-at-the-counter place whose main business is serving meals.", synonyms: ["eatery", "spot"] },
      { slug: "bar", name: "Bar", definition: "A place whose main business is drinks, with or without food.", synonyms: ["pub", "tavern"] },
      { slug: "cocktail_bar", name: "Cocktail Bar", definition: "A bar known for mixed drinks: creators talk about the cocktails or the bartending.", synonyms: ["cocktails", "speakeasy", "mixology"] },
      { slug: "wine_bar", name: "Wine Bar", definition: "A bar built around wine, including natural wine bars.", synonyms: ["natural wine", "wine"] },
      { slug: "dive_bar", name: "Dive Bar", definition: "A cheap, unpretentious neighborhood bar.", synonyms: ["dive"] },
      { slug: "cafe", name: "Café", definition: "A coffee shop or café where coffee and light food are the draw.", synonyms: ["coffee shop", "coffeehouse"] },
      { slug: "bakery", name: "Bakery", definition: "A shop that bakes and sells bread, pastries or cakes.", synonyms: ["patisserie", "boulangerie"] },
      { slug: "deli", name: "Deli", definition: "A deli, bodega counter or sandwich shop that makes food to order.", synonyms: ["bodega", "sandwich shop"] },
      { slug: "food_hall", name: "Food Hall", definition: "A hall or market with several independent food stalls under one roof.", synonyms: ["food market", "market"] },
      { slug: "dessert_shop", name: "Dessert Shop", definition: "A shop whose main business is sweets: ice cream, cookies, doughnuts, candy or desserts.", synonyms: ["sweets", "ice cream shop", "doughnut shop"] },
    ],
  },
  {
    slug: "cuisine",
    name: "Cuisine",
    weight: 1.1,
    tags: [
      { slug: "american", name: "American", definition: "American food: burgers, diners, comfort food, new American menus.", synonyms: ["new american", "comfort food", "diner"] },
      { slug: "italian", name: "Italian", definition: "Italian food, including red-sauce joints and Italian-American.", synonyms: ["italian-american", "trattoria", "osteria"] },
      { slug: "mexican", name: "Mexican", definition: "Mexican food, including taquerias.", synonyms: ["taqueria", "tex-mex"] },
      { slug: "japanese", name: "Japanese", definition: "Japanese food: sushi, ramen, izakaya, omakase and more.", synonyms: ["izakaya", "omakase"] },
      { slug: "chinese", name: "Chinese", definition: "Chinese food of any region, including dim sum.", synonyms: ["dim sum", "cantonese", "sichuan", "szechuan"] },
      { slug: "korean", name: "Korean", definition: "Korean food, including Korean barbecue and fried chicken.", synonyms: ["kbbq", "korean bbq"] },
      { slug: "thai", name: "Thai", definition: "Thai food." },
      { slug: "vietnamese", name: "Vietnamese", definition: "Vietnamese food, including pho and banh mi.", synonyms: ["pho", "banh mi"] },
      { slug: "indian", name: "Indian", definition: "Indian and South Asian food.", synonyms: ["south asian", "pakistani", "bangladeshi"] },
      { slug: "mediterranean", name: "Mediterranean", definition: "Greek, Turkish, Levantine-leaning Mediterranean menus.", synonyms: ["greek", "turkish"] },
      { slug: "middle_eastern", name: "Middle Eastern", definition: "Middle Eastern food: falafel, shawarma, mezze.", synonyms: ["lebanese", "israeli", "falafel", "shawarma"] },
      { slug: "french", name: "French", definition: "French food, from bistros to fine dining.", synonyms: ["bistro", "brasserie"] },
      { slug: "caribbean", name: "Caribbean", definition: "Caribbean food: Jamaican, Trinidadian, Puerto Rican, Dominican and more.", synonyms: ["jamaican", "puerto rican", "dominican"] },
      { slug: "latin_american", name: "Latin American", definition: "Central and South American food outside Mexico.", synonyms: ["peruvian", "colombian", "argentinian", "venezuelan"] },
      { slug: "jewish_deli", name: "Jewish Deli", definition: "A Jewish deli or appetizing shop: pastrami, smoked fish, knishes.", synonyms: ["appetizing", "pastrami"] },
    ],
  },
  {
    slug: "food",
    name: "Food",
    weight: 1.3,
    tags: [
      { slug: "burger", name: "Burger", definition: "The creator eats or recommends a burger here.", synonyms: ["burgers", "cheeseburger"] },
      { slug: "smashburger", name: "Smashburger", definition: "A smashed, thin-patty burger with crispy edges.", synonyms: ["smash burger", "smashed burger"] },
      { slug: "pizza", name: "Pizza", definition: "The creator eats or recommends pizza here.", synonyms: ["slice", "pie", "detroit-style", "grandma slice"] },
      { slug: "pasta", name: "Pasta", definition: "The creator eats or recommends a pasta dish here.", synonyms: ["rigatoni", "spaghetti", "cacio e pepe"] },
      { slug: "tacos", name: "Tacos", definition: "The creator eats or recommends tacos here.", synonyms: ["taco"] },
      { slug: "birria", name: "Birria", definition: "Birria: stewed meat, usually as tacos with consommé for dipping.", synonyms: ["birria tacos", "quesabirria"] },
      { slug: "ramen", name: "Ramen", definition: "Japanese ramen." },
      { slug: "sushi", name: "Sushi", definition: "Sushi, sashimi or hand rolls.", synonyms: ["omakase", "hand roll"] },
      { slug: "wings", name: "Wings", definition: "Chicken wings.", synonyms: ["chicken wings", "buffalo wings"] },
      { slug: "bbq", name: "BBQ", definition: "Smoked, American-style barbecue.", synonyms: ["barbecue", "brisket", "smokehouse"] },
      { slug: "sandwich", name: "Sandwich", definition: "The creator eats or recommends a sandwich or hero here.", synonyms: ["sandwiches", "hero", "sub", "chopped cheese"] },
      { slug: "bagels", name: "Bagels", definition: "Bagels, including bagel sandwiches.", synonyms: ["bagel", "bacon egg and cheese"] },
      { slug: "coffee", name: "Coffee", definition: "Coffee drinks are part of the recommendation.", synonyms: ["espresso", "latte", "matcha"] },
      { slug: "pastries", name: "Pastries", definition: "Croissants, danishes, scones, cinnamon rolls and other baked pastries.", synonyms: ["croissant", "pastry", "baked goods", "cinnamon roll"] },
      { slug: "dessert", name: "Dessert", definition: "A sweet course or treat: cake, pie, cookies, doughnuts.", synonyms: ["desserts", "cake", "cookies", "doughnuts", "sweets"] },
      { slug: "ice_cream", name: "Ice Cream", definition: "Ice cream, gelato, soft serve or frozen custard.", synonyms: ["gelato", "soft serve", "frozen custard"] },
      { slug: "seafood", name: "Seafood", definition: "Fish or shellfish is the draw: oysters, lobster rolls, crudo.", synonyms: ["oysters", "lobster roll", "fish"] },
      { slug: "steak", name: "Steak", definition: "Steak or a steakhouse cut is the draw.", synonyms: ["steakhouse", "dry-aged", "ribeye"] },
      { slug: "dumplings", name: "Dumplings", definition: "Dumplings of any tradition: soup dumplings, gyoza, momos, pierogi.", synonyms: ["soup dumplings", "xiao long bao", "momos", "gyoza"] },
      { slug: "noodles", name: "Noodles", definition: "Asian noodle dishes other than ramen: hand-pulled, pho, pad thai, udon.", synonyms: ["hand-pulled noodles", "udon", "pad thai"] },
    ],
  },
  {
    slug: "vibe",
    name: "Vibe",
    weight: 1.0,
    tags: [
      { slug: "casual", name: "Casual", definition: "Creators describe it as laid-back, no-frills or come-as-you-are.", synonyms: ["laid-back", "no-frills", "low-key"] },
      { slug: "upscale", name: "Upscale", definition: "Creators describe a polished, fine-dining or special-occasion room and service.", synonyms: ["fine dining", "fancy", "classy", "gourmet", "michelin"] },
      { slug: "lively", name: "Lively", definition: "Creators describe it as loud, buzzy, packed or high-energy.", synonyms: ["buzzy", "energetic", "loud", "party"] },
      { slug: "chill", name: "Chill", definition: "Creators describe it as relaxed and easy to hang out in for a while.", synonyms: ["relaxed", "cozy"] },
      { slug: "romantic", name: "Romantic", definition: "Creators call it romantic: candlelit, dim, made for two.", synonyms: ["candlelit", "sexy"] },
      { slug: "intimate", name: "Intimate", definition: "Creators describe a small, tucked-away or few-seats room.", synonyms: ["small", "tiny", "hidden gem", "tucked away"] },
      { slug: "trendy", name: "Trendy", definition: "Creators call it new, hyped, viral or a hard reservation.", synonyms: ["hyped", "viral", "hot spot", "new", "modern"] },
      { slug: "classic", name: "Classic", definition: "Creators call it an institution, old-school or around for decades.", synonyms: ["institution", "old school", "old-school", "iconic", "legendary"] },
    ],
  },
  {
    slug: "occasion",
    name: "Occasion",
    weight: 1.0,
    tags: [
      { slug: "date_night", name: "Date Night", definition: "Creators call it good for a date, or describe an intimate, romantic setting.", synonyms: ["date spot", "romantic dinner", "date"] },
      { slug: "group_hang", name: "Group Hang", definition: "Creators say it works for a group: big tables, sharing plates, bringing friends.", synonyms: ["group friendly", "groups", "friends", "casual hang"] },
      { slug: "celebration", name: "Celebration", definition: "Creators suggest it for birthdays, anniversaries or a special occasion.", synonyms: ["birthday", "special occasion", "anniversary"] },
      { slug: "work_lunch", name: "Work Lunch", definition: "Creators suggest it for a quick or business lunch.", synonyms: ["lunch", "business lunch", "quick lunch"] },
      { slug: "solo", name: "Solo", definition: "Creators say it is good alone: counter seats, quick bites, a book and a coffee.", synonyms: ["solo dining", "eating alone"] },
      { slug: "late_night", name: "Late Night", definition: "Open late or recommended after midnight.", synonyms: ["late night", "after hours", "open late", "2am"] },
      { slug: "brunch", name: "Brunch", definition: "Creators go for brunch or weekend breakfast.", synonyms: ["breakfast", "weekend brunch"] },
    ],
  },
  {
    slug: "features",
    name: "Features",
    weight: 0.9,
    tags: [
      { slug: "takeout", name: "Takeout", definition: "Creators take food to go, or it is a grab-and-go counter.", synonyms: ["to go", "grab and go", "pickup"] },
      { slug: "delivery", name: "Delivery", definition: "Creators mention ordering delivery.", synonyms: ["delivers"] },
      { slug: "outdoor_seating", name: "Outdoor Seating", definition: "Creators mention a patio, sidewalk tables, a garden or outdoor seats.", synonyms: ["patio", "outdoor", "backyard", "garden"] },
      { slug: "rooftop", name: "Rooftop", definition: "A rooftop bar or dining room.", synonyms: ["roof", "rooftop bar"] },
      { slug: "reservations", name: "Reservations", definition: "Creators say to book ahead or describe how to get a table.", synonyms: ["book ahead", "resy", "hard reservation"] },
      { slug: "walk_in", name: "Walk-in", definition: "No reservations: creators say to walk in or wait in line.", synonyms: ["walk-ins", "no reservations", "line"] },
      { slug: "counter_service", name: "Counter Service", definition: "Order at the counter rather than table service.", synonyms: ["order at the counter", "fast casual"] },
    ],
  },
  {
    slug: "price",
    name: "Price",
    weight: 0.8,
    tags: [
      { slug: "affordable", name: "Affordable", definition: "Creators call it cheap, a deal or good value.", synonyms: ["cheap", "cheap eats", "budget", "good value", "deal"] },
      { slug: "splurge", name: "Splurge", definition: "Creators call it expensive or worth the splurge.", synonyms: ["expensive", "pricey", "worth the splurge", "$$$$"] },
    ],
  },
  {
    slug: "dietary",
    name: "Dietary",
    weight: 0.8,
    tags: [
      { slug: "vegetarian_friendly", name: "Vegetarian-friendly", definition: "Creators point out good vegetarian options.", synonyms: ["vegetarian", "veggie"] },
      { slug: "vegan", name: "Vegan", definition: "Vegan food, or a creator points out vegan options.", synonyms: ["plant-based", "plant based"] },
      { slug: "gluten_free", name: "Gluten-free", definition: "Creators point out gluten-free options.", synonyms: ["gf", "celiac"] },
      { slug: "halal", name: "Halal", definition: "Halal food." },
      { slug: "kosher", name: "Kosher", definition: "Kosher food." },
    ],
  },
];

/** v1 tags merged into a v2 tag: old slug → target slug. */
export const MERGES: Record<string, string> = {
  "dive-bar": "dive_bar",
  smashburger_food: "smashburger",
  birria_tacos: "birria",
  expensive: "splurge",
  pricey: "splurge",
  cheap: "affordable",
  casual_hang: "group_hang",
  group_friendly: "group_hang",
  classy: "upscale",
  gourmet: "upscale",
  michelin: "upscale",
  modern: "trendy",
  old_school: "classic",
  "dry-aged": "steak",
  "detroit-style": "pizza",
};

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const arr = (xs: string[]) => (xs.length ? `ARRAY[${xs.map(q).join(", ")}]::text[]` : `'{}'::text[]`);

function sql(): string {
  const out: string[] = [
    "-- Taxonomy v2: generated by scripts/taxonomy-v2.ts. Data only; additive.",
    "",
  ];

  // Categories
  TAXONOMY_V2.forEach((c, i) => {
    out.push(
      `INSERT INTO tag_categories (slug, display_name, search_weight, sort_order) VALUES (${q(c.slug)}, ${q(c.name)}, ${c.weight}, ${i + 1})`,
      `  ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, search_weight = EXCLUDED.search_weight, sort_order = EXCLUDED.sort_order;`,
    );
  });
  // v1 categories that end up empty sort after the v2 ones.
  out.push(`UPDATE tag_categories SET sort_order = 100 + sort_order WHERE slug NOT IN (${TAXONOMY_V2.map((c) => q(c.slug)).join(", ")});`, "");

  // Tags: insert new, or move + define existing ones.
  for (const c of TAXONOMY_V2) {
    c.tags.forEach((t, i) => {
      out.push(
        `INSERT INTO tags (category_id, slug, display_name, description, synonyms, sort_order, status)`,
        `  SELECT id, ${q(t.slug)}, ${q(t.name)}, ${q(t.definition)}, ${arr(t.synonyms ?? [])}, ${i + 1}, 'active' FROM tag_categories WHERE slug = ${q(c.slug)}`,
        `  ON CONFLICT (slug) DO UPDATE SET category_id = EXCLUDED.category_id, display_name = EXCLUDED.display_name,`,
        `    description = EXCLUDED.description, synonyms = EXCLUDED.synonyms, sort_order = EXCLUDED.sort_order, status = 'active', merged_into_id = NULL;`,
      );
    });
  }
  out.push("");

  // Merges: re-point rows to the target tag, drop the duplicates, deprecate the old tag.
  for (const [from, to] of Object.entries(MERGES)) {
    const src = `(SELECT id FROM tags WHERE slug = ${q(from)})`;
    const dst = `(SELECT id FROM tags WHERE slug = ${q(to)})`;
    out.push(
      `-- ${from} → ${to}`,
      `UPDATE review_tags rt SET tag_id = ${dst} WHERE rt.tag_id = ${src}`,
      `  AND NOT EXISTS (SELECT 1 FROM review_tags x WHERE x.review_id = rt.review_id AND x.tag_id = ${dst});`,
      `DELETE FROM review_tags WHERE tag_id = ${src};`,
      `UPDATE place_tags pt SET tag_id = ${dst} WHERE pt.tag_id = ${src}`,
      `  AND NOT EXISTS (SELECT 1 FROM place_tags x WHERE x.place_id = pt.place_id AND x.tag_id = ${dst});`,
      `DELETE FROM place_tags WHERE tag_id = ${src};`,
      `DELETE FROM place_tag_aggregates WHERE tag_id = ${src};`,
      `UPDATE tags SET synonyms = (SELECT array_agg(DISTINCT s) FROM unnest(synonyms || ARRAY[${q(from.replace(/[-_]/g, " "))}]) s)`,
      `  WHERE slug = ${q(to)};`,
      `UPDATE tags SET status = 'deprecated', merged_into_id = ${dst} WHERE slug = ${q(from)};`,
    );
  }
  out.push("");

  // Anything else left in a v1-only category and not defined above is retired.
  out.push(
    `UPDATE tags SET status = 'deprecated' WHERE status = 'active' AND slug NOT IN (${TAXONOMY_V2.flatMap((c) => c.tags.map((t) => q(t.slug))).join(", ")});`,
    "",
    "-- The 31 'manual' place tags came from a seed script that assigned tags at random;",
    "-- they are not admin overrides.",
    "UPDATE place_tags SET source = 'ai' WHERE source = 'manual';",
    "",
  );
  return out.join("\n");
}

if (process.argv[1]?.endsWith("taxonomy-v2.ts")) process.stdout.write(sql());
