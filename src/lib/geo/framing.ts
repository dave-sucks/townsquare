/**
 * The pins a map should frame: the main cluster, not every pin. One
 * out-of-town result (a Las Vegas post in a list of New York spots) would
 * otherwise zoom the map out to the whole country. Pins outside the frame
 * stay on the map; they're just not what the camera fits to.
 *
 * Client-safe (no server imports), so map components can use it.
 */

const CLUSTER_RADIUS_MI = 30;
/** Trim only when the cluster is most of the set; a spread-out answer keeps every pin. */
const CLUSTER_SHARE = 0.6;

function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

function median(values: number[]): number {
  const s = [...values].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function framingPoints<T>(items: T[], coords: (item: T) => { lat: number; lng: number }): T[] {
  if (items.length < 3) return items;
  const points = items.map(coords);
  const center = { lat: median(points.map((p) => p.lat)), lng: median(points.map((p) => p.lng)) };
  const near = items.filter((_, i) => milesBetween(center, points[i]) <= CLUSTER_RADIUS_MI);
  return near.length >= Math.ceil(items.length * CLUSTER_SHARE) ? near : items;
}
