-- Cache de análisis IA (Gemini) por listing
create table if not exists public.listing_ai_insights (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  analysis jsonb not null,
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listing_ai_insights_updated_at_idx
  on public.listing_ai_insights (updated_at desc);

alter table public.listing_ai_insights enable row level security;

-- Solo lectura vía service role / API; usuarios no leen directo
create policy "listing_ai_insights service only"
  on public.listing_ai_insights
  for all
  using (false)
  with check (false);

comment on table public.listing_ai_insights is 'Cache server-side análisis Gemini por listing';
