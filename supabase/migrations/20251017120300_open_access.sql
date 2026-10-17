-- Usuario interno para scans en modo acceso libre (OPEN_ACCESS=1)
create extension if not exists pgcrypto;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'open-access@internal.local',
  crypt('open-access-not-used', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Acceso libre"}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (id, display_name)
values ('00000000-0000-4000-8000-000000000001', 'Acceso libre')
on conflict (id) do nothing;

grant execute on function public.map_listings_in_bbox to anon;

create policy listings_read_anon on public.listings
  for select to anon
  using (status in ('active', 'demo'));

create policy listing_investment_read_anon on public.listing_investment
  for select to anon using (true);
