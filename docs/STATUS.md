# BITEQ status

## Executed in the authoring sandbox
- Logic tests: `tests/pricing.test.ts`, `tests/orderStatus.test.ts` - 11 passed (Node runner with a Vitest-compatible shim).
- Type-check of `src/lib/pricing.ts` and `src/lib/orderStatus.ts` (strict) - passed.
- Syntax parse of every `.ts`/`.tsx` file - no syntax errors.

## Written, NOT executed (run these on a TEST project)
- `npm install`, `npm run typecheck`, `npm run lint`, `npm run build`
- `tests/validation.test.ts` (needs zod)
- The three SQL migrations and `supabase/tests/rls_checks.sql`
- Playwright: smoke tests (no backend needed) and journeys (need test accounts)

## Not built (Stage 2)
Razorpay payments + webhooks, inventory/recipes, seating, analytics + CSV, reviews, announcements, chatbot, audit-log page.

## Needs your configuration
Supabase project, Auth URLs, Google OAuth (optional), Resend SMTP + verified domain, notify-email function + webhook, pg_cron schedule, first admin via `promote_admin`.

## Known limits
- Wait-time estimate assumes orders are prepared one after another (conservative).
- Cash orders are marked paid when the admin completes the order.
- Customers can read the non-secret `settings` table (tax, hours, payment flags).
