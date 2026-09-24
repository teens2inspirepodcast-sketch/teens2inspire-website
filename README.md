# Teens2Inspire

A dark editorial media platform for Jewish teen girls. Built with Next.js App Router and Supabase. The public library reads published records from Supabase; without project credentials it renders designed empty states rather than invented episodes or events.

## Start locally

1. Install Node.js 22 or later.
2. Copy `.env.example` to `.env.local` and enter the Supabase project URL and publishable key.
3. Apply both SQL files in `supabase/migrations/` in filename order in the Supabase SQL editor (or with the Supabase CLI). The second adds membership fields, private profile photos, family profiles, and hashed school codes to the existing project.
4. Run `npm install`, then `npm run dev` and open `http://localhost:3000`.

Only the Supabase URL and publishable key belong in the browser environment. The client also accepts Supabase's legacy anon key name. Do not add a service-role key or email-provider key to `NEXT_PUBLIC_*` variables.

## Supabase setup

- Enable email/password sign-in in Supabase Auth. The database trigger creates each user's `profiles` row from signup metadata.
- Set the Supabase Auth Site URL to the public site origin and allow its `/auth/callback` URL. For local work, allow `http://localhost:3000/auth/callback` (or the port you use).
- Promote the first trusted studio account after it has signed up, using the Supabase SQL editor: `update public.profiles set role='administrator' where id=(select id from auth.users where email='YOUR-ADMIN-EMAIL');`
- Roles are `user`, `content_editor`, `event_manager`, and `administrator`. Database row-level security and the server routes enforce the role boundaries.
- The `media`, `artwork`, and `downloads` buckets are private. Studio uploads go to `media`; the `/api/media/...` route serves an object only after a published content record references it. Private downloads remain private.
- Add approved public audio, video, resource, and cover files through Teens2Inspire Studio. The site stores private object references and exposes them only after publication.
- Contact submissions are stored in `messages`; email notifications are not configured yet.

## Current product surface

Home, Listen, Watch, Resources, Events, Search, content details, Contact, email/password sign-up and sign-in, profile, saved content, and a role-gated Teens2Inspire Studio are included. Content cards, categories, event lists, and search results come from published Supabase rows. Drafts are excluded by query and row-level security.

For content publishing, enter a unique lowercase slug and choose draft, published, or archived. Uploads are limited to 100 MB. The Studio editor can create, update, archive, and remove content; deleting a content row also removes its saved references.

## Production deployment

This is a server-rendered Next.js app with API routes and cookie-based authentication. Deploy it to a host that supports the Next.js App Router and Node.js server runtime; do not publish it as a static export.

Before building, set these variables in the deployment environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the existing legacy anon key name is also supported)
- `NEXT_PUBLIC_SITE_URL` set to the site's public origin
- `SUPABASE_SERVICE_ROLE_KEY` (server only, required for Stripe webhook updates)
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (server only)
- `STRIPE_PRICE_PERSONAL_MONTHLY` and `STRIPE_PRICE_FAMILY_MONTHLY` (Stripe Price IDs)

Next.js embeds `NEXT_PUBLIC_*` values in browser code at build time, so configure them before the production build. Keep using the existing Supabase project and publishable key; never add a service-role key to a `NEXT_PUBLIC_*` variable. Set the Supabase Auth Site URL to the deployed origin and allow the deployed `/auth/callback` URL for confirmation and password-reset links.

The standard build and start commands are `npm ci`, `npm run build`, and `npm start`. Keep the Supabase migration and storage buckets in the existing project; check whether the migration has already been applied before running it again.

## Monthly memberships and school codes

Personal is `$7.99/month`; Family is `$9.99/month` and includes three profiles total. Create monthly recurring USD prices for those exact amounts in the existing Stripe account and set their Price IDs in the server environment. Stripe Checkout creates subscriptions on the server; the signed `/api/stripe/webhook` endpoint updates membership state. Enable Stripe's customer billing portal if members should manage or cancel subscriptions there. Never put Stripe secrets or the Supabase service-role key in browser-visible environment variables or chat.

Configure a Stripe webhook for `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`, pointing to `https://YOUR-DOMAIN/api/stripe/webhook`; put its signing secret in `STRIPE_WEBHOOK_SECRET`. Paid signup stays unavailable until server secrets, both monthly prices, and the membership migration are ready.

School memberships are free with a code. After applying the membership migration, an administrator can sign in to Teens2Inspire Studio and create a limited-use code. The full code is shown once; only its hash is stored. Codes are not seeded automatically.
