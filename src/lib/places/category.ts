/**
 * The word a place is filed under ("Restaurant", "Bakery"), for its page,
 * list cards and the agent's place rows alike.
 *
 * Google lists a place's types alphabetically, and the stored primaryType is
 * just the first of them, so "establishment" beats "restaurant". Skip the
 * generic types and prefer the common kinds.
 */

function formatCategoryName(type: string): string {
  if (!type) return "";
  return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

const PRIORITY = ["restaurant", "bar", "cafe", "bakery", "coffee_shop", "night_club", "meal_takeaway", "meal_delivery"];
const GENERIC = ["establishment", "point_of_interest", "food", "store"];

export function placeCategory(primaryType: string | null | undefined, types: string[] | null | undefined): string {
  const t = types ?? [];
  const specific = primaryType && !GENERIC.includes(primaryType) ? primaryType : null;
  // A common kind wins, and so does a type set by hand (admin menu → Type),
  // which Google's own list never has.
  if (specific && (PRIORITY.includes(specific) || !t.includes(specific))) return formatCategoryName(specific);
  const best = PRIORITY.find((c) => t.includes(c)) ?? t.find((x) => !GENERIC.includes(x));
  return best ? formatCategoryName(best) : "";
}
