-- BITEQ schema (Stage 1: auth, menu, cart, orders, FIFO queue, notifications, admin).
-- Roles live on profiles.role (enum): two roles do not need separate roles/permissions tables.
create type user_role as enum ('user', 'admin');
create type account_status as enum ('active', 'suspended');
create type order_status as enum ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled');
create type payment_method as enum ('cash', 'online');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'cancelled');

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 60),
  phone text check (phone is null or phone ~ '^[0-9+ -]{7,15}$'),
  role user_role not null default 'user',
  status account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 40),
  description text check (char_length(description) <= 200),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.food_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  price numeric(10, 2) not null check (price >= 0 and price <= 100000),
  is_veg boolean not null default true,
  image_path text,
  prep_minutes int not null default 10 check (prep_minutes between 1 and 180),
  available_pieces int not null default 10 check (available_pieces >= 0),
  is_available boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index food_items_name_uq on public.food_items (lower(name));
create index food_items_category_idx on public.food_items (category_id);
create trigger food_touch before update on public.food_items for each row execute function public.touch_updated_at();

create table public.cart_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  food_item_id uuid not null references public.food_items(id) on delete cascade,
  quantity int not null check (quantity between 1 and 20),
  updated_at timestamptz not null default now(),
  primary key (user_id, food_item_id)
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.settings (key, value) values
  ('tax_percent', '5'), ('cash_enabled', 'true'), ('online_enabled', 'false'),
  ('pending_expiry_minutes', '15'), ('max_pending_orders', '3'), ('canteen_open', 'true'),
  ('canteen_full', 'false'), ('available_seats', '25'), ('total_seats', '50'),
  ('canteen_hours', '"8:00 AM - 6:00 PM"'), ('timezone', '"Asia/Kolkata"');

create sequence public.order_no_seq start 1001;
create sequence public.queue_no_seq start 1;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint not null unique default nextval('public.order_no_seq'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status order_status not null default 'pending',
  queue_no bigint unique,                       -- assigned by the server when the order is confirmed (FIFO)
  subtotal numeric(10, 2) not null,
  tax_amount numeric(10, 2) not null,
  discount_amount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  payment_method payment_method not null,
  notes text check (char_length(notes) <= 300),
  idempotency_key text not null,
  expires_at timestamptz,
  est_prep_minutes int not null default 10,
  confirmed_at timestamptz, ready_at timestamptz, completed_at timestamptz, cancelled_at timestamptz,
  cancel_reason text check (char_length(cancel_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_queue_idx on public.orders (status, queue_no);
create index orders_created_idx on public.orders (created_at);
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  food_item_id uuid references public.food_items(id) on delete set null,
  name_snapshot text not null,
  unit_price numeric(10, 2) not null,
  quantity int not null check (quantity > 0),
  line_total numeric(10, 2) not null,
  prep_minutes int not null default 10
);
create index order_items_order_idx on public.order_items (order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  method payment_method not null,
  status payment_status not null default 'pending',
  amount numeric(10, 2) not null,
  transaction_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.email_log (
  id bigserial primary key, notification_id uuid, status text not null, error text, created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigserial primary key,
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null, target_type text not null, target_id uuid,
  details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index audit_created_idx on public.audit_logs (created_at desc);
