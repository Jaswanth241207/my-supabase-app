# Deployment

Use a **test** Supabase project first, then repeat for production. Never test against production data.

## Frontend (Netlify, dist upload or Git)
1. `.env` must contain the target project's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (baked in at build time).
2. `npm run build` -> upload the `dist` folder (drag and drop) or connect a Git repo with build command `npm run build`, publish `dist`, and set the same variables in Netlify.
3. `public/_redirects` (SPA routing) and `public/_headers` (security headers) are copied into `dist`.
4. Supabase > Authentication > URL Configuration: Site URL = your Netlify URL; add `<url>/login`, `<url>/reset`, `<url>/app` to Redirect URLs.

## Expire unconfirmed orders automatically (pg_cron)
Dashboard > Database > Extensions: enable `pg_cron`. Then in the SQL Editor:
```sql
select cron.schedule('biteq-expire-orders', '* * * * *', $$select public._sweep_expired()$$);
select cron.schedule('biteq-purge-logs', '0 3 * * *', $$select public.purge_old_logs()$$);
```
(The cron job runs as the database owner, so the internal function is callable there.)

## Notification emails (Resend)
```bash
supabase login && supabase link --project-ref <ref>
supabase functions deploy notify-email --no-verify-jwt
supabase secrets set RESEND_API_KEY=... EMAIL_FROM="BITEQ <no-reply@your-domain>" APP_URL=https://your-app WEBHOOK_SECRET=<long-random>
```
Dashboard > Database > Webhooks > create: table `public.notifications`, event INSERT, target the `notify-email` function, header `x-webhook-secret: <same value>`. Verify your sender domain in Resend. Email failures never affect orders; they are logged in `email_log`.

## Backups
Free Supabase projects have no automatic daily backups. Before real use: upgrade (Pro) or export regularly (`pg_dump`). Storage images are not in database backups.

## Stage 2 reminder
Razorpay keys, webhook secret, inventory, seating, analytics, reviews, announcements and the chatbot are not part of this ZIP.
