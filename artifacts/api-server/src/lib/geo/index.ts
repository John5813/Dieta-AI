/** Is a point inside Tashkent city? Used before online payment (delivery is Tashkent-only). */
import { TASHKENT_CITY } from "./tashkentBoundary";

/** Ray casting on [lat, lng] rings. */
function inRing(lat: number, lng: number, ring: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i]!, [yj, xj] = ring[j]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isValidCoord(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function inTashkent(lat: number, lng: number): boolean {
  return TASHKENT_CITY.some((ring) => inRing(lat, lng, ring));
}

export const mapLink = (lat: number, lng: number) => `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
