-- Helpers
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active') $$;
create function public.is_active() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active') $$;
create function public._bypass() returns void language sql as $$ select set_config('biteq.bypass', '1', true) $$;
create function public._require_admin() returns void language plpgsql security definer set search_path = public as $$
begin if not is_admin() then raise exception 'forbidden'; end if; end $$;
create function public._audit(p_action text, p_type text, p_id uuid, p_details jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into audit_logs (admin_id, action, target_type, target_id, details) values (auth.uid(), p_action, p_type, p_id, p_details) $$;
create function public._notify(p_user uuid, p_type text, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, link) values (p_user, p_type, p_title, p_body, p_link) $$;
create function public._notify_admins(p_type text, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, link) select id, p_type, p_title, p_body, p_link from profiles where role = 'admin' and status = 'active' $$;

-- Profile creation (email/password and Google sign-in both create a profile)
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), 'user'), 60));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.guard_profile() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('biteq.bypass', true), '') <> '1' and (new.role <> old.role or new.status <> old.status or new.id <> old.id) then
    raise exception 'forbidden';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile();

-- Audit trail for admin edits of menu data and settings
create function public.audit_row() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into audit_logs (admin_id, action, target_type, target_id, details) values (auth.uid(), 'delete_' || tg_table_name, tg_table_name, nullif(to_jsonb(old) ->> 'id', '')::uuid, to_jsonb(old));
    return old;
  end if;
  insert into audit_logs (admin_id, action, target_type, target_id, details) values (auth.uid(), lower(tg_op) || '_' || tg_table_name, tg_table_name, nullif(to_jsonb(new) ->> 'id', '')::uuid, to_jsonb(new));
  return new;
end $$;
create trigger food_audit after insert or update or delete on public.food_items for each row execute function public.audit_row();
create trigger categories_audit after insert or update or delete on public.categories for each row execute function public.audit_row();

-- Cart (server validates availability; no direct client writes)
create function public.cart_set(p_food uuid, p_qty int) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_active() then raise exception 'unauthorized'; end if;
  if p_qty is null or p_qty <= 0 then delete from cart_items where user_id = auth.uid() and food_item_id = p_food; return; end if;
  if p_qty > 20 then raise exception 'quantity_limit'; end if;
  if not exists (select 1 from food_items f join categories c on c.id = f.category_id where f.id = p_food and f.is_available and c.is_active and (f.available_pieces is null or f.available_pieces >= p_qty)) then
    raise exception 'item_unavailable';
  end if;
  insert into cart_items (user_id, food_item_id, quantity) values (auth.uid(), p_food, p_qty)
  on conflict (user_id, food_item_id) do update set quantity = excluded.quantity, updated_at = now();
end $$;

create function public.reorder_to_cart(p_order uuid) returns int language plpgsql security definer set search_path = public as $$
declare r record; v_skipped int := 0;
begin
  if auth.uid() is null or not is_active() then raise exception 'unauthorized'; end if;
  if not exists (select 1 from orders where id = p_order and user_id = auth.uid()) then raise exception 'not_found'; end if;
  for r in select food_item_id, quantity from order_items where order_id = p_order and food_item_id is not null loop
    if exists (select 1 from food_items f join categories c on c.id = f.category_id where f.id = r.food_item_id and f.is_available and c.is_active) then
      insert into cart_items (user_id, food_item_id, quantity) values (auth.uid(), r.food_item_id, r.quantity)
      on conflict (user_id, food_item_id) do update set quantity = least(20, cart_items.quantity + excluded.quantity);
    else v_skipped := v_skipped + 1; end if;
  end loop;
  return v_skipped;
end $$;

-- Expiry of unconfirmed (pending) orders: database-backed, not a browser timer.
create function public._sweep_expired() returns void language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with ex as (
    update orders set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Expired: not confirmed in time'
     where status = 'pending' and expires_at < now() returning id, user_id, order_no),
  p as (update payments set status = 'cancelled' where order_id in (select id from ex)),
  n as (insert into notifications (user_id, type, title, body, link)
        select user_id, 'order_cancelled', 'Order expired', 'Order #' || order_no || ' expired because it was not confirmed in time.', '/app/orders/' || id from ex)
  select count(*) into v_n from ex;
end $$;
create function public.sweep_expired() returns void language sql security definer set search_path = public as $$ select public._sweep_expired() $$;

-- Checkout: prices, tax, availability and ownership are all recomputed here. Idempotent per (user, key).
create function public.place_order(p_method payment_method, p_notes text, p_key text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_no bigint; v_sub numeric(10, 2); v_tax numeric(10, 2); v_pct numeric; v_cnt int; v_bad int; v_prep int; v_exp int; v_pend int; v_max int;
begin
  if auth.uid() is null or not is_active() then raise exception 'unauthorized'; end if;
  if coalesce(trim(p_key), '') = '' or length(p_key) > 80 then raise exception 'invalid_request'; end if;
  perform _sweep_expired();
  select id into v_id from orders where user_id = auth.uid() and idempotency_key = p_key;
  if v_id is not null then return v_id; end if;
  if not coalesce((select (value #>> '{}')::boolean from settings where key = 'canteen_open'), false) then raise exception 'canteen_closed'; end if;
  if p_method = 'cash' and not coalesce((select (value #>> '{}')::boolean from settings where key = 'cash_enabled'), false) then raise exception 'method_unavailable'; end if;
  if p_method = 'online' and not coalesce((select (value #>> '{}')::boolean from settings where key = 'online_enabled'), false) then raise exception 'method_unavailable'; end if;
  v_max := coalesce((select (value #>> '{}')::int from settings where key = 'max_pending_orders'), 3);
  select count(*) into v_pend from orders where user_id = auth.uid() and status = 'pending';
  if v_pend >= v_max then raise exception 'too_many_pending'; end if;

  select count(*), count(*) filter (where not f.is_available or not c.is_active or (f.available_pieces is not null and f.available_pieces < ci.quantity)), coalesce(sum(f.price * ci.quantity), 0), coalesce(max(f.prep_minutes), 10)
    into v_cnt, v_bad, v_sub, v_prep
    from cart_items ci join food_items f on f.id = ci.food_item_id join categories c on c.id = f.category_id where ci.user_id = auth.uid();
  if v_cnt = 0 then raise exception 'cart_empty'; end if;
  if v_bad > 0 then raise exception 'item_unavailable'; end if;

  v_pct := coalesce((select (value #>> '{}')::numeric from settings where key = 'tax_percent'), 0);
  v_tax := round(v_sub * v_pct / 100, 2);
  v_exp := coalesce((select (value #>> '{}')::int from settings where key = 'pending_expiry_minutes'), 15);
  begin
    insert into orders (user_id, subtotal, tax_amount, total, payment_method, notes, idempotency_key, expires_at, est_prep_minutes)
    values (auth.uid(), v_sub, v_tax, v_sub + v_tax, p_method, nullif(left(trim(coalesce(p_notes, '')), 300), ''), p_key, now() + make_interval(mins => v_exp), v_prep)
    returning id, order_no into v_id, v_no;
  exception when unique_violation then
    select id into v_id from orders where user_id = auth.uid() and idempotency_key = p_key;
    return v_id;
  end;
  insert into order_items (order_id, food_item_id, name_snapshot, unit_price, quantity, line_total, prep_minutes)
  select v_id, f.id, f.name, f.price, ci.quantity, f.price * ci.quantity, f.prep_minutes
    from cart_items ci join food_items f on f.id = ci.food_item_id where ci.user_id = auth.uid();
  update food_items f
     set available_pieces = greatest(0, f.available_pieces - ci.quantity),
         is_available = case when f.available_pieces - ci.quantity <= 0 then false else f.is_available end
    from cart_items ci
   where ci.user_id = auth.uid() and f.id = ci.food_item_id;
  insert into payments (order_id, method, amount) values (v_id, p_method, v_sub + v_tax);
  delete from cart_items where user_id = auth.uid();
  perform _notify(auth.uid(), 'order_placed', 'Order placed', 'Order #' || v_no || ' is waiting for confirmation.', '/app/orders/' || v_id);
  perform _notify_admins('new_order', 'New order #' || v_no, 'A new order needs confirmation.', '/admin/orders');
  return v_id;
end $$;

create function public.user_cancel_order(p_order uuid) returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype;
begin
  perform _sweep_expired();
  select * into o from orders where id = p_order and user_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  if o.status not in ('pending', 'confirmed') then raise exception 'invalid_transition'; end if;
  update orders set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Cancelled by customer' where id = o.id;
  update payments set status = 'cancelled' where order_id = o.id;
  perform _notify_admins('order_cancelled', 'Order #' || o.order_no || ' cancelled', 'Cancelled by the customer.', '/admin/orders');
end $$;

-- Admin order workflow with strict transitions. Queue number is assigned here, by the server, at confirmation time.
create function public.admin_set_order_status(p_order uuid, p_status order_status, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; v_ok boolean; v_msg text;
begin
  perform _require_admin();
  perform _sweep_expired();
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  v_ok := (o.status = 'pending' and p_status in ('confirmed', 'cancelled'))
       or (o.status = 'confirmed' and p_status in ('preparing', 'cancelled'))
       or (o.status = 'preparing' and p_status in ('ready', 'cancelled'))
       or (o.status = 'ready' and p_status in ('completed', 'cancelled'));
  if not v_ok then raise exception 'invalid_transition'; end if;
  if p_status = 'cancelled' and coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  update orders set status = p_status,
    queue_no = case when p_status = 'confirmed' then nextval('queue_no_seq') else queue_no end,
    confirmed_at = case when p_status = 'confirmed' then now() else confirmed_at end,
    ready_at = case when p_status = 'ready' then now() else ready_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
    cancel_reason = case when p_status = 'cancelled' then left(p_reason, 300) else cancel_reason end,
    expires_at = case when p_status = 'confirmed' then null else expires_at end
   where id = o.id;
  if p_status = 'completed' then update payments set status = 'paid' where order_id = o.id;
  elsif p_status = 'cancelled' then update payments set status = case when status = 'paid' then 'refunded'::payment_status else 'cancelled'::payment_status end where order_id = o.id;
  end if;
  v_msg := case p_status
    when 'confirmed' then 'Your order is confirmed and in the queue.'
    when 'preparing' then 'Your order is being prepared.'
    when 'ready' then 'Your order is ready for pickup!'
    when 'completed' then 'Order completed. Enjoy your meal!'
    else 'Your order was cancelled: ' || coalesce(p_reason, '') end;
  perform _notify(o.user_id, 'order_' || p_status::text, 'Order #' || o.order_no || ' ' || p_status::text, v_msg, '/app/orders/' || o.id);
  perform _audit('order_' || p_status::text, 'order', o.id, jsonb_build_object('order_no', o.order_no, 'reason', p_reason));
end $$;

-- Queue position (FIFO by confirmed queue number) and a rough wait estimate
create function public.queue_info(p_order uuid) returns table (queue_position int, est_minutes int)
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; v_ahead int; v_wait int;
begin
  select * into o from orders where id = p_order and (user_id = auth.uid() or is_admin());
  if not found then raise exception 'not_found'; end if;
  if o.status in ('confirmed', 'preparing') then
    select count(*)::int, coalesce(sum(est_prep_minutes), 0)::int into v_ahead, v_wait
      from orders where status in ('confirmed', 'preparing') and queue_no < o.queue_no;
    return query select v_ahead + 1, v_wait + o.est_prep_minutes;
  elsif o.status = 'ready' then return query select 0, 0;
  else return query select null::int, null::int; end if;
end $$;

create function public.popular_items(p_limit int default 5) returns table (food_item_id uuid, name text, qty bigint)
language sql stable security definer set search_path = public as $$
  select oi.food_item_id, max(oi.name_snapshot), sum(oi.quantity)::bigint as qty
    from order_items oi join orders o on o.id = oi.order_id
   where o.status <> 'cancelled' and oi.food_item_id is not null and auth.uid() is not null
   group by oi.food_item_id order by qty desc limit least(greatest(p_limit, 1), 20) $$;

-- Admin: statistics (all from real rows), users
create function public.admin_stats() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tz text; v_today timestamptz;
begin
  perform _require_admin();
  perform _sweep_expired();
  v_tz := coalesce((select value #>> '{}' from settings where key = 'timezone'), 'Asia/Kolkata');
  v_today := date_trunc('day', now() at time zone v_tz) at time zone v_tz;
  return jsonb_build_object(
    'users', (select count(*) from profiles),
    'orders_total', (select count(*) from orders),
    'orders_today', (select count(*) from orders where created_at >= v_today),
    'pending', (select count(*) from orders where status = 'pending'),
    'confirmed', (select count(*) from orders where status = 'confirmed'),
    'preparing', (select count(*) from orders where status = 'preparing'),
    'ready', (select count(*) from orders where status = 'ready'),
    'completed', (select count(*) from orders where status = 'completed'),
    'cancelled', (select count(*) from orders where status = 'cancelled'),
    'sales_total', (select coalesce(sum(total), 0) from orders where status = 'completed'),
    'revenue_today', (select coalesce(sum(total), 0) from orders where status = 'completed' and completed_at >= v_today),
    'revenue_week', (select coalesce(sum(total), 0) from orders where status = 'completed' and completed_at >= v_today - interval '6 days'),
    'revenue_month', (select coalesce(sum(total), 0) from orders where status = 'completed' and completed_at >= v_today - interval '29 days'),
    'popular', (select coalesce(jsonb_agg(jsonb_build_object('name', n, 'qty', q)), '[]'::jsonb) from (
        select max(oi.name_snapshot) n, sum(oi.quantity) q from order_items oi join orders o on o.id = oi.order_id
         where o.status <> 'cancelled' group by oi.food_item_id order by sum(oi.quantity) desc limit 5) t));
end $$;

create function public.admin_list_users(p_search text default '', p_limit int default 20, p_offset int default 0)
returns table (id uuid, full_name text, email text, phone text, role user_role, status account_status, created_at timestamptz, order_count bigint)
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  return query select p.id, p.full_name, u.email::text, p.phone, p.role, p.status, p.created_at, (select count(*) from orders o where o.user_id = p.id)
    from profiles p join auth.users u on u.id = p.id
   where coalesce(p_search, '') = '' or position(lower(p_search) in lower(p.full_name)) > 0 or position(lower(p_search) in lower(u.email)) > 0
   order by p.created_at desc limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end $$;

create function public.admin_set_user_status(p_user uuid, p_status account_status, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  if p_user = auth.uid() or exists (select 1 from profiles where id = p_user and role = 'admin') then raise exception 'forbidden'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  perform _bypass();
  update profiles set status = p_status where id = p_user;
  perform _audit('user_' || p_status::text, 'profile', p_user, jsonb_build_object('reason', p_reason));
  if p_status = 'suspended' then begin delete from auth.sessions where user_id = p_user; exception when others then null; end; end if;
end $$;

-- Run ONCE in the SQL editor after the person has signed up. No default admin credentials exist.
create function public.promote_admin(p_email text) returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is null then raise exception 'No user with that email. Sign up first.'; end if;
  perform _bypass();
  update profiles set role = 'admin' where id = v_id;
  insert into audit_logs (admin_id, action, target_type, target_id) values (null, 'admin_promoted', 'profile', v_id);
end $$;

create function public.purge_old_logs() returns void language sql security definer set search_path = public as $$
  delete from email_log where created_at < now() - interval '90 days';
  delete from notifications where read_at is not null and created_at < now() - interval '180 days';
$$;
