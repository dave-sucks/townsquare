"use client";

/**
 * "Book a table" on a place: a date and party size, and a button to the
 * place's own page on Resy, OpenTable, Tock or SevenRooms with both filled
 * in, so the booking app opens on that day's times. Native date and select
 * inputs, so it works inside the mobile drawer too.
 */

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { BOOKING_PROVIDERS, PROVIDER_LABEL, bookingHref, type BookingProvider } from "@/lib/places/booking-link";
import { cn } from "@/lib/utils";

const SEATS = [1, 2, 3, 4, 5, 6, 7, 8];

/** Today in the viewer's time zone, as YYYY-MM-DD. */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function BookingBar({ provider, url, className }: { provider: string | null | undefined; url: string | null | undefined; className?: string }) {
  const [date, setDate] = React.useState(today);
  const [seats, setSeats] = React.useState(2);
  if (!url || !BOOKING_PROVIDERS.includes(provider as BookingProvider)) return null;
  const booking = { provider: provider as BookingProvider, url };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} data-testid="booking-bar">
      <Input
        type="date"
        value={date}
        min={today()}
        onChange={(e) => setDate(e.target.value || today())}
        className="h-8 w-auto"
        aria-label="Date"
        data-testid="input-booking-date"
      />
      <NativeSelect value={String(seats)} onChange={(e) => setSeats(Number(e.target.value))} className="w-auto" aria-label="Party size" data-testid="select-booking-seats">
        {SEATS.map((n) => (
          <NativeSelectOption key={n} value={String(n)}>
            {n} {n === 1 ? "person" : "people"}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button size="sm" nativeButton={false} render={<a href={bookingHref(booking, { date, seats })} target="_blank" rel="noopener noreferrer" />} data-testid="button-book">
        Book on {PROVIDER_LABEL[booking.provider]}
        <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3.5" />
      </Button>
    </div>
  );
}
