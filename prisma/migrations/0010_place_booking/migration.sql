-- Where a place takes reservations: its website and Google's reservable flag,
-- and its booking page on Resy, OpenTable, Tock or SevenRooms.
ALTER TABLE "places"
  ADD COLUMN "website" TEXT,
  ADD COLUMN "reservable" BOOLEAN,
  ADD COLUMN "booking_provider" TEXT,
  ADD COLUMN "booking_url" TEXT,
  ADD COLUMN "booking_checked_at" TIMESTAMP(6),
  ADD COLUMN "booking_manual" BOOLEAN NOT NULL DEFAULT false;
