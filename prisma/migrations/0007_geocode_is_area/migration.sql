-- Resolve needs to know whether a geocoded name is an area (a city or a
-- neighborhood tag) or a venue. The cache is rebuilt on demand.
ALTER TABLE "geocode_cache" ADD COLUMN "is_area" BOOLEAN;
DELETE FROM "geocode_cache";
