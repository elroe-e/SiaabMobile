# Siaab Mobile

Siaab Mobile is a responsive phone storefront and protected shop console built with Next.js App Router, React, TypeScript and Supabase. Customers can compare new and used phones, browse upcoming devices, estimate trade-ins and send requests to the shop. Staff can manage stock, reservations, sales and customer requests; owners can also manage store settings, private used-phone fields, trade-in values, audit history and full backups.

There is no online checkout or public registration. Purchases are confirmed directly with the shop.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```sh
npm install
Copy-Item .env.example .env.local
npm run dev
```

The local server prints its URL. With Supabase variables unset, the storefront uses the editable sample catalog and the admin sign-in explains that it is not configured.

Project checks:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

## Configure Supabase

1. Create a Supabase project and copy its project URL and anon/publishable key to `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

2. In the Supabase SQL Editor, run [`supabase/migrations/202610240001_initial_schema.sql`](./supabase/migrations/202610240001_initial_schema.sql), then [`supabase/seed.sql`](./supabase/seed.sql). The migration enables RLS, creates public-safe views, transactional sales/reservation functions, lead throttling, audit logging, photo storage policies and owner-only used-phone fields.
3. Configure Supabase Auth's Site URL as `http://localhost:3000/admin/login` for local development, and add `http://localhost:3000/**` to the redirect URL allow-list. In production, set the Site URL to the deployed admin login page and allow that site's `/admin/login` path. Invite and password-recovery links return to the admin login, where the user can set a password. Keep public sign-ups disabled; accounts are provisioned only by an owner.
4. Create the first owner from a trusted local terminal. Add these local-only values to `.env.local` (never to browser variables or a deployed site's environment):

   ```dotenv
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   ADMIN_EMAIL=owner@example.com
   ADMIN_PASSWORD=USE_A_UNIQUE_PASSWORD_OF_AT_LEAST_12_CHARACTERS
   ADMIN_FULL_NAME=Shop Owner
   ```

   Then run:

   ```sh
   npm run admin:provision-owner
   ```

   The script creates the Auth user if needed and assigns the owner profile through the service-role API. Do not share or commit `.env.local`. The service-role key bypasses RLS and must never be added to a `NEXT_PUBLIC_*` variable.
5. Open `/admin/login`. Owners can provision individual staff accounts from a trusted terminal by changing `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_FULL_NAME` in `.env.local`, then running `npm run admin:create-staff`. There is deliberately no public sign-up screen.

To run the database role checks locally, install the Supabase CLI and Docker, then run `supabase start` followed by `supabase test db`. [`supabase/tests/rls.sql`](./supabase/tests/rls.sql) checks staff/owner separation and confidential used-unit fields in a rollback-only transaction. Never use production customer data for the test.

The Supabase free plan currently includes 500 MB database storage, 1 GB file storage and pauses inactive projects after one week; quotas and plan terms can change. Keep photos optimized, monitor the owner-only storage meter, and review the provider's current limits before launch.

## Admin capabilities

- **Overview:** stock warnings, recent customer requests and sales totals.
- **Inventory:** add new variants, individual used units and upcoming models; review/edit specs; adjust prices, stock and visibility; upload/reorder/delete optimized photos; reserve used units for 1–14 days.
- **Sales:** record a transaction atomically with its stock update; eligible staff may undo recent sales, and owners can undo older sales.
- **Leads:** triage trade-in, contact and notify-me requests, save internal notes, and contact customers by phone or WhatsApp.
- **Owner-only settings:** shop details, sold badge period, low-stock threshold, trade-in rules/base values, private used-unit cost/IMEI/notes, audit history and full ZIP export.

Only owners can access settings, audit data, export, or private cost/IMEI fields. Staff and public catalog queries use restricted columns/views. Keep the database migration policies in place; do not replace authenticated queries with a service-role client.

## Specification lookup

The admin suggestion flow uses the bundled review-required library, Wikipedia and pasted text; optional Gemini lookup is last and is only enabled when `GEMINI_API_KEY` is supplied. The flow normalizes, validates, flags implausible values, preserves locked/known fields and requires a human review before storefront publication. Provider output is a suggestion, not a verified specification. Pasting manufacturer information is available when external sources fail.

## Backups and keep-alive

- Owners can download **Export everything** from Admin → Settings. The ZIP contains JSON records, customer requests, audit history, private used-unit data and uploaded photos. Treat it as sensitive personal data; store it encrypted and restrict access.
- Download and verify a backup at least monthly, before major data changes, and before changing providers. The Supabase free plan does not include managed daily backups.
- The GitHub Actions workflow [`.github/workflows/keep-supabase-alive.yml`](./.github/workflows/keep-supabase-alive.yml) checks the deployed health endpoint every three days. Set repository variable `SITE_URL` to the deployed origin and enable Actions. Scheduled workflows are best-effort; monitor runs and verify the Supabase project remains active.

## Deploy on Netlify

Netlify's current OpenNext adapter supports this app's App Router, middleware and route handlers with automatic framework detection. No Vercel Hobby deployment is required.

1. Push the project to a Git provider and import it into Netlify.
2. Use `npm run build` as the build command. Netlify detects Next.js automatically.
3. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` in the Netlify environment settings for the production context. Add `GEMINI_API_KEY` only if you intend to use the optional AI lookup.
4. Do **not** add `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, or other provisioning secrets to the Netlify site. Provision accounts locally.
5. Set the deployed origin as the Supabase Auth site URL/allowed redirect URL and as the GitHub Actions `SITE_URL` repository variable.
6. Deploy and verify `/api/health`, `/admin/login`, public catalog data and customer request submissions.

Netlify's Free plan currently has usage credits and project/account limits; Netlify's plan terms, commercial eligibility and Supabase quotas can change. Check both providers' current terms and usage before relying on a no-cost production deployment. See [Netlify Next.js support](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [Netlify pricing](https://www.netlify.com/pricing/) and [Supabase pricing](https://supabase.com/pricing).

## Editable sample data and contact details

- Sample catalog: [`src/data/phones.ts`](./src/data/phones.ts)
- Sample upcoming devices: [`src/data/upcoming.ts`](./src/data/upcoming.ts)
- Sample trade-in values: [`src/data/tradeInValues.ts`](./src/data/tradeInValues.ts)
- Sample trade-in logic: [`src/lib/tradeIn.ts`](./src/lib/tradeIn.ts)
- Sample shop details: [`src/data/shop.ts`](./src/data/shop.ts)
- Supabase schema and sample records: [`supabase/`](./supabase)

All sample prices, stock, warranties, device details, trade-in values, upcoming dates and expected prices are illustrative. Verify them before publication. See [`ASSUMPTIONS.md`](./ASSUMPTIONS.md).

## Stack

- Next.js 15 App Router, React 18, TypeScript and Tailwind CSS.
- Supabase Postgres, Auth and Storage, with RLS and server-side API validation.
- Recharts, Lucide icons, Zod, Vitest and Testing Library.
- Netlify as the documented free-tier Next.js host; provider plans and usage quotas are subject to change.

## Adding a phone (admin)

Admin → Inventory → **Add inventory** opens a two-step form.

1. **Phone details:** type, brand, model, colour(s), RAM, storage, price, quantity and photos. For several colours write them with commas (for example `Black, Blue`); each colour gets its own stock line with the same quantity. Customers see the colours but cannot choose one. If the model already exists, the form adds the new colour or storage to it instead of creating a duplicate.
2. **Specifications:** the app looks up the remaining specifications automatically (saved library, Wikipedia, then the optional Google AI source). Review the list, tick **These specifications look right** and the phone is published. Without that tick it is saved as a draft and stays hidden. If nothing is found you can paste specifications copied from any website, or save and customers see "Not specified".

Photos chosen in step 1 are shrunk to WebP (under 200 KB) and uploaded as soon as the phone is saved. The first photo is the main one.

### Free spec lookup for brand-new phones

Wikipedia rarely has articles for phones released in the last year, so for new models the optional Google AI source does most of the work. It uses Google's free Gemini API:

1. Create a free key at Google AI Studio (aistudio.google.com) with the shop's Google account.
2. Add it to the host's environment variables as `GEMINI_API_KEY` (SmarterASP.NET: Node.js project → **Environment Variables**), then redeploy. Never put the key in the repository or in chat.
3. Optional: `GEMINI_MODEL` overrides the model name (default `gemini-2.5-flash`). If lookups start failing with an HTTP 404, Google has retired that name; set a current one.

Free-tier limits apply; when Google answers "busy", wait a minute or paste the specifications instead. AI-found specifications are suggestions: always check them before ticking the confirmation box.

## Two-factor sign-in (optional)

Admin → Settings → **Two-factor sign-in** → *Turn on two-factor*. Scan the QR code with Google Authenticator, Microsoft Authenticator or Authy and enter the 6-digit code. From then on sign-in asks for a code after the password. The card is in the owner's Settings page, so it protects the owner account; staff accounts keep signing in with a password.

Lost the phone? In the Supabase dashboard open **Authentication → Users**, pick the account and delete its authenticator factor; the account then signs in with just the password again.

## Languages

The storefront has an English / አማርኛ switch in the header (remembered in a cookie). Translations live in [`src/i18n/am.ts`](./src/i18n/am.ts): the key is the exact English text and any text without an entry stays in English. Product names, specifications and the admin panel are not translated. Have a native Amharic speaker review the wording before launch. A test fails if new storefront text is added without an Amharic entry.

## Other small settings

- Lines under the price on phone pages: [`src/data/assurances.ts`](./src/data/assurances.ts). Change them to match the shop's real policy.
- Backup reminder: the admin overview and settings show how long ago this browser last downloaded **Export everything**.
- Share button on phone pages uses the phone's share sheet where available, with WhatsApp, Telegram and copy-link as fallbacks.
