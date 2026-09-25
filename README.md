# Teens2Inspire

A dark editorial media platform for Jewish teen girls. Built with Next.js App Router, Supabase, Cloudflare R2, and Stripe. Supabase stores accounts and content metadata; private Cloudflare R2 stores media files. The public library reads published records from Supabase; without project credentials it renders designed empty states rather than invented episodes or events.

## Start locally

1. Install Node.js 22 or later.
2. Copy `.env.example` to `.env.local` and enter the Supabase, Cloudflare R2, and Stripe values you have configured.
3. For the connected Teens2Inspire database, the compatibility and owner-security migrations in `supabase/migrations/` are already applied. Do not rerun them in the SQL editor. For a different database, first create the base tables and roles documented below, then apply each migration once in filename order.
4. Run `npm install`, then `npm run dev` and open `http://localhost:3000`.

Only the Supabase URL and publishable key belong in the browser environment. The client also accepts Supabase's legacy anon key name. Never add a service-role key, Cloudflare R2 credentials, Stripe secret, or email-provider key to `NEXT_PUBLIC_*` variables.

## Supabase setup

- Enable email/password sign-in in Supabase Auth. The database trigger creates each user's `profiles` row from signup metadata.
- Set the Supabase Auth Site URL to the public site origin and allow its `/auth/callback` URL. For local work, allow `http://localhost:3000/auth/callback` (or the port you use).
- Promote the owner's account after sign-up, using the Supabase SQL editor: `update public.profiles set role='administrator' where id=(select id from auth.users where email='YOUR-ADMIN-EMAIL');` Replace the email with the owner's sign-in email. The update runs only from the Supabase dashboard, never from the public app.
- Only the `administrator` role can access the Studio, publish or edit content, create school codes, or upload files. Database row-level security also enforces this rule.
- Create one private Cloudflare R2 bucket named `teens2inspire-media` (or set your chosen name in the environment) and an R2 API token limited to object read/write access for that bucket. New content uploads (cover art, audio, videos, PDFs, and resource files) go there. Content records keep `r2://` object references in Supabase. The app continues to serve existing files from Supabase Storage, so they do not break, but it does not copy them automatically. Keep the old Supabase buckets until existing files have been migrated and checked.
- Set R2 bucket CORS to allow `PUT` from the exact Vercel site origin and `http://localhost:3000` for local development. Allow the `Content-Type` request header and expose `ETag`. Do not use `*` origins. Keep the bucket private and do not enable the `r2.dev` public URL.
- Protected videos are streamed through a server route that rechecks the signed-in account, verified email, active paid Stripe Personal/Family subscription, and video publication status for every byte-range request. Their R2 source URLs are never sent to the browser. Public content is served through short-lived signed reads only after checking that its Supabase record is published.
- The connected Supabase database has migration `20260925011400_r2_video_asset_refs` applied. It accepts both existing Supabase video references and new R2 video references during the transition.
- To move existing Supabase media into R2 after adding the R2 credentials and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`, run `node --env-file=.env.local scripts/migrate-supabase-media-to-r2.mjs`. It copies existing artwork, audio, downloads, and protected videos, then updates the Supabase references. It leaves the originals in Supabase as a rollback copy; remove old buckets only after checking the site and R2 files.
- Under-13 signup is blocked until a verified parent-consent provider is connected. The current age choice is a temporary age gate, not verifiable parental consent.
- Upload audio, PDFs, artwork, and videos through Teens2Inspire Studio. Uploads are restricted to the owner account and 100 MB per file. Video source URLs are never exposed to the browser.
- Contact submissions are stored in `messages`; email notifications are not configured yet.
- The connected project already has one owner account with the administrator role. New accounts start without paid access; only the signed Stripe webhook can activate paid video membership.

## Current product surface

Home, Listen, Watch, Resources, Events, Search, content details, Contact, email/password sign-up and sign-in, profile, saved content, and a role-gated Teens2Inspire Studio are included. Content cards, categories, event lists, and search results come from published Supabase rows. Drafts are excluded by query and row-level security.

For content publishing, enter a unique lowercase slug and choose draft, published, or archived. Uploads are limited to 100 MB. The Studio editor can create, update, archive, and remove content; deleting a content row also removes its saved references.

## Production deployment

This is a server-rendered Next.js app with API routes and cookie-based authentication. Deploy it to a host that supports the Next.js App Router and Node.js server runtime; do not publish it as a static export.

Before building, set these variables in the deployment environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the existing legacy anon key name is also supported)
- `NEXT_PUBLIC_SITE_URL` set to the site's public origin
- `SUPABASE_SERVICE_ROLE_KEY` (server only, required for protected video delivery, private video metadata, and Stripe webhook updates)
- `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` (server only; create the R2 bucket and token first)
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (server only)
- `STRIPE_PRICE_PERSONAL_MONTHLY` and `STRIPE_PRICE_FAMILY_MONTHLY` (Stripe Price IDs)

Next.js embeds `NEXT_PUBLIC_*` values in browser code at build time, so configure them before the production build. Keep using the existing Supabase project and publishable key; never add a service-role key, Cloudflare credential, or Stripe secret to a `NEXT_PUBLIC_*` variable. Set the Supabase Auth Site URL to the deployed origin and allow the deployed `/auth/callback` URL for confirmation and password-reset links. Add the eventual custom-domain origin to the R2 CORS list when you launch.

The standard build and start commands are `npm ci`, `npm run build`, and `npm start`. The migrations in this package match entries already recorded in the connected project; do not run them again. Set `NEXT_PUBLIC_SITE_URL` to the final custom-domain origin after launch, and update Supabase Auth redirect URLs and the Stripe webhook URL to that same domain.

The app can be installed from a supported mobile browser as a Progressive Web App (PWA). On iPhone/iPad, use Safari's Share menu and choose Add to Home Screen. This installs a web app shortcut; it does not create an App Store or Android APK download.

Before launch, configure an IP-based rate limit in the Vercel Firewall for account/contact API requests. Exclude the protected video streaming route, which makes repeated byte-range requests for seeking and playback. Review the rule in observe/log mode before blocking requests.

## Monthly memberships and school codes

Personal is `$7.99/month`; Family is `$9.99/month` and includes three profiles total. Create monthly recurring USD prices for those exact amounts in the existing Stripe account and set their Price IDs in the server environment. Stripe Checkout creates subscriptions on the server; the signed `/api/stripe/webhook` endpoint updates membership state. Enable Stripe's customer billing portal if members should manage or cancel subscriptions there. Never put Stripe secrets or the Supabase service-role key in browser-visible environment variables or chat.

Configure a Stripe webhook for `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`, pointing to `https://YOUR-DOMAIN/api/stripe/webhook`; put its signing secret in `STRIPE_WEBHOOK_SECRET`. Paid signup stays unavailable until server secrets, both monthly prices, and the membership migration are ready.

School memberships are free with a code. After applying the membership migration, an administrator can sign in to Teens2Inspire Studio and create a limited-use code. The full code is shown once; only its hash is stored. Codes are not seeded automatically.
