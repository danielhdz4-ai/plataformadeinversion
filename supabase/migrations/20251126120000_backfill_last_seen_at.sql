-- Backfill: last_seen_at = scraped_at si es NULL (listings activos legacy)
update public.listings
   set last_seen_at = scraped_at
 where last_seen_at is null
   and status = 'active'
   and scraped_at is not null;
