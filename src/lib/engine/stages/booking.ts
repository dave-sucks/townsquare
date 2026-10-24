/**
 * Booking (code, per place): where the place takes reservations, from its
 * website (lib/places/booking.ts). Runs with a place's refresh when it was
 * never checked or last checked over a month ago; a link an admin set or
 * cleared is left alone.
 */

import { prisma } from "@/lib/prisma";
import { checkBooking } from "@/lib/places/booking";
import type { StepResult } from "../write/runs";

const RECHECK_MS = 30 * 24 * 3600_000;

export type BookingResult = {
  skipped?: boolean;
  reason?: string;
  provider?: string | null;
  url?: string | null;
  website?: string | null;
  reservable?: boolean | null;
};

export async function runBooking(placeId: string, opts: { force?: boolean } = {}): Promise<StepResult<BookingResult>> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { googlePlaceId: true, name: true, neighborhood: true, formattedAddress: true, bookingCheckedAt: true, bookingManual: true },
  });
  if (!place) return { output: { skipped: true, reason: "place no longer exists" }, status: "skipped" };
  if (place.bookingManual) return { output: { skipped: true, reason: "an admin set the booking link" }, status: "skipped" };
  if (!opts.force && place.bookingCheckedAt && Date.now() - place.bookingCheckedAt.getTime() < RECHECK_MS) {
    return { output: { skipped: true, reason: "checked in the last month" }, status: "skipped" };
  }

  const check = await checkBooking({ googlePlaceId: place.googlePlaceId, name: place.name, neighborhood: place.neighborhood, address: place.formattedAddress });
  await prisma.place.update({
    where: { id: placeId },
    data: {
      website: check.website,
      reservable: check.reservable,
      bookingProvider: check.booking?.provider ?? null,
      bookingUrl: check.booking?.url ?? null,
      bookingCheckedAt: new Date(),
    },
  });
  return { output: { provider: check.booking?.provider ?? null, url: check.booking?.url ?? null, website: check.website, reservable: check.reservable } };
}
