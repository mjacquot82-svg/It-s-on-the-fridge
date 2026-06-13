create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_settings_app_key_unique unique (app, key)
);

create or replace function public.set_app_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_app_settings_updated_at on public.app_settings;

create trigger set_app_settings_updated_at
before update on public.app_settings
for each row
execute function public.set_app_settings_updated_at();

insert into public.app_settings (app, key, value)
values
  ('itsonthefridge', 'round_price', '5'::jsonb),
  ('itsonthefridge', 'rectangle_price', '7'::jsonb),
  ('itsonthefridge', 'promotion_text', '""'::jsonb),
  ('itsonthefridge', 'promotion_enabled', 'false'::jsonb)
on conflict (app, key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "Public can read itsonthefridge settings" on public.app_settings;

create policy "Public can read itsonthefridge settings"
on public.app_settings
for select
to anon, authenticated
using (app = 'itsonthefridge');
