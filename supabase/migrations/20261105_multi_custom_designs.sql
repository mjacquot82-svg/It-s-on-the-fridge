-- Support multiple custom magnet designs per order.
-- Safe to run more than once. Does not delete existing rows.

alter table public.fridge_order_images
  add column if not exists design_index integer;

update public.fridge_order_images
set design_index = 0
where design_index is null;

alter table public.fridge_order_images
  alter column design_index set default 0;

alter table public.fridge_order_images
  alter column design_index set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fridge_order_images_design_index_check'
  ) then
    alter table public.fridge_order_images
      add constraint fridge_order_images_design_index_check
      check (design_index >= 0);
  end if;
end $$;

create index if not exists fridge_order_images_order_design_idx
on public.fridge_order_images (order_id, design_index);

comment on column public.fridge_order_images.design_index is
  'Zero-based index of the custom magnet design within a multi-design custom_photo order. Ready-made orders do not use this table.';
