/**
 * Human category label from Google place types. Moved from the old
 * chat-dashboard so the agent's place rows and the rest of the app agree.
 */

function formatCategoryName(type: string): string {
  if (!type) return "";
  return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

const PRIORITY = ["restaurant", "cafe", "bar", "bakery", "night_club", "meal_takeaway", "meal_delivery"];
const GENERIC = ["establishment", "point_of_interest", "food", "store"];

export function getChatCategory(primaryType: string | null | undefined, types: string[] | null | undefined): string {
  const t = types ?? [];
  if (primaryType && PRIORITY.includes(primaryType)) return formatCategoryName(primaryType);
  if (t.length > 0) {
    for (const cat of PRIORITY) {
      if (t.includes(cat)) return formatCategoryName(cat);
    }
    const nonGeneric = t.filter((x) => !GENERIC.includes(x));
    if (nonGeneric.length > 0) return formatCategoryName(nonGeneric[0]);
  }
  if (primaryType && !["establishment", "point_of_interest", "food"].includes(primaryType)) {
    return formatCategoryName(primaryType);
  }
  return "";
}
