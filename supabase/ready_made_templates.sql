create table if not exists public.template_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.magnet_templates (
  id uuid primary key default gen_random_uuid(),
  template_number text not null unique,
  title text not null,
  category_id uuid references public.template_categories(id) on delete set null,
  image_url text not null,
  shape text not null default 'rectangle' check (shape in ('rectangle', 'round')),
  visible boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.magnet_templates
add column if not exists shape text not null default 'rectangle';

alter table public.magnet_templates
alter column shape set default 'rectangle';

update public.magnet_templates
set shape = 'rectangle'
where shape is null or shape not in ('rectangle', 'round');

alter table public.magnet_templates
alter column shape set not null;

alter table public.magnet_templates
drop constraint if exists magnet_templates_shape_check;

alter table public.magnet_templates
add constraint magnet_templates_shape_check
check (shape in ('rectangle', 'round'));

create sequence if not exists public.magnet_template_number_seq;

create or replace function public.assign_magnet_template_number()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and (new.template_number is null or new.template_number = '') then
    new.template_number = 'T-' || lpad(nextval('public.magnet_template_number_seq')::text, 4, '0');
  end if;

  if tg_op = 'UPDATE' then
    new.template_number = old.template_number;
  end if;

  return new;
end;
$$;

create or replace function public.set_template_library_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assign_magnet_template_number on public.magnet_templates;

create trigger assign_magnet_template_number
before insert or update on public.magnet_templates
for each row
execute function public.assign_magnet_template_number();

drop trigger if exists set_template_categories_updated_at on public.template_categories;

create trigger set_template_categories_updated_at
before update on public.template_categories
for each row
execute function public.set_template_library_updated_at();

drop trigger if exists set_magnet_templates_updated_at on public.magnet_templates;

create trigger set_magnet_templates_updated_at
before update on public.magnet_templates
for each row
execute function public.set_template_library_updated_at();

create index if not exists template_categories_sort_order_idx
on public.template_categories (sort_order, name);

create index if not exists magnet_templates_category_id_idx
on public.magnet_templates (category_id);

create index if not exists magnet_templates_visible_featured_idx
on public.magnet_templates (visible, featured);

alter table public.template_categories enable row level security;
alter table public.magnet_templates enable row level security;

drop policy if exists "Public can read visible template categories" on public.template_categories;

create policy "Public can read visible template categories"
on public.template_categories
for select
to anon, authenticated
using (visible = true);

drop policy if exists "Public can read visible magnet templates" on public.magnet_templates;

create policy "Public can read visible magnet templates"
on public.magnet_templates
for select
to anon, authenticated
using (visible = true);

insert into storage.buckets (id, name, public)
values ('ready-made-templates', 'ready-made-templates', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public can read ready-made template images" on storage.objects;

create policy "Public can read ready-made template images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'ready-made-templates');
