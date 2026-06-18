create table if not exists public.fridge_orders (
  id uuid primary key default gen_random_uuid(),
  public_order_number text not null unique,
  order_type text not null check (order_type in ('custom_photo', 'ready_made')),
  email_status text not null default 'received' check (email_status in ('received', 'email_pending', 'email_sent', 'email_failed')),
  customer_name text,
  customer_first_name text,
  customer_last_name text,
  customer_email text not null,
  customer_phone text not null,
  customer_notes text,
  total_quantity integer not null check (total_quantity > 0),
  magnet_type text check (magnet_type in ('round', 'rectangle')),
  order_payload jsonb not null default '{}'::jsonb,
  resend_message_id text,
  email_error text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fridge_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.fridge_orders(id) on delete cascade,
  template_number text not null,
  template_title text not null,
  template_image_url text,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.fridge_order_images (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.fridge_orders(id) on delete cascade,
  image_type text not null check (image_type in ('original', 'print_ready')),
  bucket text not null,
  object_path text not null,
  content_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  created_at timestamptz not null default now()
);

create or replace function public.set_fridge_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_fridge_orders_updated_at on public.fridge_orders;

create trigger set_fridge_orders_updated_at
before update on public.fridge_orders
for each row
execute function public.set_fridge_orders_updated_at();

create index if not exists fridge_orders_email_status_idx
on public.fridge_orders (email_status, created_at desc);

create index if not exists fridge_orders_customer_email_idx
on public.fridge_orders (customer_email);

create index if not exists fridge_order_items_order_id_idx
on public.fridge_order_items (order_id);

create index if not exists fridge_order_images_order_id_idx
on public.fridge_order_images (order_id);

alter table public.fridge_orders enable row level security;
alter table public.fridge_order_items enable row level security;
alter table public.fridge_order_images enable row level security;

insert into storage.buckets (id, name, public)
values ('fridge-order-images', 'fridge-order-images', false)
on conflict (id) do update
set public = false;
