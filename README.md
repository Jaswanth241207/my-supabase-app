# BITEQ - Skip the Queue, Grab Your Bite.

Canteen ordering app. React + TypeScript + Vite + Tailwind (light theme) on the front; Supabase (Auth, Postgres + Row Level Security, Storage, Realtime) behind it.

## Status: Stage 1 of 2 (read this first)

| | |
|---|---|
| **Stage 1 (in this ZIP)** | Email signup with confirmation link, login, password reset, Google login (needs setup), admin role enforced in Postgres, menu (search, filter, sort, veg/non-veg), food detail, cart, checkout (cash), server-side price/tax/availability checks, duplicate-checkout protection, FIFO queue with server-assigned queue numbers, order tracking (realtime), order history + reorder, expiry of unconfirmed orders, in-app notifications, admin: overview stats, food + category management (with image upload), orders (search/filter/status), queue, users (suspend), canteen settings |
| **Stage 2 (NOT built yet)** | Razorpay online payments + webhook verification, inventory + recipes, seating management, analytics + CSV export, reviews/ratings (verified buyers only), announcements, support chatbot, admin audit-log page |

Nothing marked Stage 2 exists in the app, and the UI does not pretend otherwise (online payment is shown as "not enabled yet").

**Verification status.** This code was written without network access. Verified here: the pure logic tests (`pricing`, `orderStatus`: 11 passing) and a syntax check of all files. **Not run yet:** `npm install`, type-check, build, Vitest for validation, the SQL migrations, `supabase/tests/rls_checks.sql`, Playwright. Run them on a TEST Supabase project first (steps below) and fix anything they reveal.

## 1. Install
```bash
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
# fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Supabase > Project Settings > API)
npm run typecheck && npm run lint && npm test && npm run build
npm run dev               # http://localhost:5173
```

## 2. Database (Supabase SQL Editor, run each file separately, in order)
1. `supabase/migrations/20260201000001_schema.sql`
2. `supabase/migrations/20260201000002_functions.sql`
3. `supabase/migrations/20260201000003_rls_storage.sql`
4. Security + business-rule checks (TEST project): `supabase/tests/rls_checks.sql` -> expect `ALL BITEQ CHECKS PASSED`
5. Optional sample menu: `supabase/seed_sample_menu.sql` (placeholder items, edit or delete later)

## 3. Auth settings (Supabase > Authentication)
- Providers > Email: enable **Confirm email**; minimum password length 10.
- URL Configuration: Site URL = your app URL; Redirect URLs: `<app>/login`, `<app>/reset`, `<app>/app` (plus the localhost equivalents for development).
- While testing you may turn "Confirm email" off to avoid the built-in email rate limit; turn it back on, and configure SMTP (Resend), before real users.
- **Google login:** Google Cloud Console > create OAuth client (Web). Authorized redirect URI = `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the client ID/secret into Supabase > Authentication > Providers > Google and enable it. Until then the Google button will show an error.

## 4. First administrator (no default password exists)
Sign up in the app, confirm the email, then in the SQL Editor: `select public.promote_admin('you@example.com');`

## 5. Use it
- Admin > Categories: create categories. Admin > Foods: add dishes with images (Supabase Storage bucket `food-images`).
- Customer: Menu > cart > checkout (cash). Order is **pending** until admin confirms; unconfirmed orders expire after 15 minutes (setting `pending_expiry_minutes`).
- Admin > Orders / Queue: Confirm (assigns the next queue number) > Preparing > Ready > Completed (marks cash as paid). Cancelling needs a reason.
- Expiry is database-backed: `sweep_expired()` runs whenever orders are loaded or placed. For automatic expiry with nobody online, schedule `select public._sweep_expired();` every minute with pg_cron (docs/DEPLOYMENT.md).

## 6. Emails
Auth emails (signup confirmation, password reset) come from Supabase Auth: set Resend SMTP (`smtp.resend.com`, 465, user `resend`, password = Resend API key) with a verified domain.
Order notification emails: deploy `supabase/functions/notify-email` and add a Database Webhook on `public.notifications` INSERT (header `x-webhook-secret`), exactly as in docs/DEPLOYMENT.md. Without it, in-app notifications still work.

## 7. Layout
`src/lib` (pricing, order rules, validation, API layer) · `src/pages` (customer pages) · `src/pages/admin` · `src/auth` (auth + cart state) · `supabase/migrations` · `supabase/tests` · `e2e`.
Design choices: roles are an enum on `profiles`; prices are recomputed in `place_order()` (never trusted from the browser); order/payment/queue changes happen only in SECURITY DEFINER functions; the menu images bucket is public-read, admin-write.
