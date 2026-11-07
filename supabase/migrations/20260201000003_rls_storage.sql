alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.food_items enable row level security;
alter table public.cart_items enable row level security;
alter table public.settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.email_log enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy categories_select on public.categories for select to authenticated using (is_active or public.is_admin());
create policy categories_write on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy food_select on public.food_items for select to authenticated using (
  public.is_admin() or exists (select 1 from public.categories c where c.id = food_items.category_id and c.is_active));
create policy food_write on public.food_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy cart_select on public.cart_items for select to authenticated using (user_id = auth.uid());

create policy settings_select on public.settings for select to authenticated using (true);
create policy settings_write on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy orders_select on public.orders for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy order_items_select on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_items.order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy payments_select on public.payments for select to authenticated using (
  exists (select 1 from public.orders o where o.id = payments.order_id and (o.user_id = auth.uid() or public.is_admin())));

create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy audit_select on public.audit_logs for select to authenticated using (public.is_admin());

-- Privileges: anon gets nothing. Sensitive tables have no client write access at all (writes go through SECURITY DEFINER functions).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke insert, update, delete on public.cart_items, public.orders, public.order_items, public.payments, public.audit_logs from authenticated;
revoke all on public.email_log from authenticated;
revoke delete, insert on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
revoke delete, insert on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Functions: nothing is callable by API roles unless listed here.
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin(), public.is_active(), public.cart_set(uuid, int), public.reorder_to_cart(uuid),
  public.sweep_expired(), public.place_order(payment_method, text, text), public.user_cancel_order(uuid),
  public.admin_set_order_status(uuid, order_status, text), public.queue_info(uuid), public.popular_items(int),
  public.admin_stats(), public.admin_list_users(text, int, int), public.admin_set_user_status(uuid, account_status, text) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders, public.notifications;
  end if;
end $$;

-- Storage: food images are public to read (they appear on the menu); only admins can write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-images', 'food-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy food_images_insert on storage.objects for insert to authenticated with check (bucket_id = 'food-images' and public.is_admin());
create policy food_images_update on storage.objects for update to authenticated using (bucket_id = 'food-images' and public.is_admin());
create policy food_images_delete on storage.objects for delete to authenticated using (bucket_id = 'food-images' and public.is_admin());
