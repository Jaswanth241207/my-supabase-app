-- Migration 04: Canteen features & storage fix
-- 1. Available pieces (inventory stock) per dish
alter table public.food_items
  add column if not exists available_pieces int not null default 10 check (available_pieces >= 0);

-- 2. Canteen seating capacity and live full/vacant status settings
insert into public.settings (key, value)
values
  ('canteen_full', 'false'),
  ('available_seats', '25'),
  ('total_seats', '50')
on conflict (key) do nothing;

-- 3. Storage bucket for dish images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-images', 'food-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'food_images_insert') then
    create policy food_images_insert on storage.objects for insert to authenticated with check (bucket_id = 'food-images' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'food_images_update') then
    create policy food_images_update on storage.objects for update to authenticated using (bucket_id = 'food-images' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'food_images_delete') then
    create policy food_images_delete on storage.objects for delete to authenticated using (bucket_id = 'food-images' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'food_images_select') then
    create policy food_images_select on storage.objects for select to public using (bucket_id = 'food-images');
  end if;
end $$;
