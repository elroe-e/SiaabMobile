# Siaab Mobile

Siaab Mobile is a responsive phone storefront and protected shop console built with Next.js App Router, React, TypeScript and PostgreSQL. Customers can compare new and used phones, browse upcoming devices, estimate trade-ins and send requests to the shop. Staff can manage stock, reservations, sales and customer requests; owners can also manage store settings, private used-phone fields, trade-in values, audit history and full backups.

There is no online checkout or public registration. Purchases are confirmed directly with the shop.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```sh
npm install
Copy-Item .env.example .env.local
npm run dev
```

The local server prints its URL. With DATABASE_URL unset, the storefront uses the editable sample catalog and the admin sign-in explains that it is not configured.

Project checks:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

## Configure the database

The site uses a PostgreSQL database (on cPanel: **PostgreSQL Databases**; the server runs PostgreSQL 10, so the schema avoids newer features). Everything else Supabase used to do now runs inside the site: sign-in with scrypt-hashed passwords and optional authenticator codes, sessions in a secure cookie, and photos stored in a folder on the server.

1. Create a database and a database user with a strong password, and give that user **all privileges** on the database. cPanel prefixes both names with the account name, e.g. `siaabmho_shop`.
2. Add the connection to the app's environment variables (cPanel: **Setup Node.js App** → the app → **Environment variables**; locally: `.env.local`):

   ```dotenv
   DATABASE_URL=postgres://DB_USER:DB_PASSWORD@localhost:5432/DB_NAME
   ```

   Characters like `@`, `:` or `/` in the password must be URL-encoded (`@` → `%40`).
3. Restart the app and open `/api/health` once. On first start the site creates its tables (see [`src/lib/db/schema.ts`](./src/lib/db/schema.ts)) and fills the trade-in price list. Later schema changes are added as new entries in [`src/lib/db/migrate.ts`](./src/lib/db/migrate.ts) and apply on the next start.
4. Create the owner. In cPanel **Terminal**:

   ```sh
   source ~/nodevenv/siaabmobile/20/bin/activate && cd ~/siaabmobile
   node set-owner.mjs
   ```

   It asks for the database address (the same `DATABASE_URL`), the owner's email, name and password. Run it again any time to reset the owner's password; add `--remove-two-factor` if the owner lost their authenticator phone.
5. Sign in at `/admin/login`. Sellers are added, reset and removed by the owner in **Settings → Sellers**. There is no public sign-up.

To check that selling works on the server's database, run `node check-database.mjs` in the same Terminal, or run **Actions → Check the live database** on GitHub. It sells, undoes and reserves a throwaway phone inside a transaction that is always cancelled, so nothing is saved.

Photos are saved in `~/siaab-photos` (outside the app folder, so deploys never delete them). Set `PHOTOS_DIR` to use another folder.

With `DATABASE_URL` unset the storefront shows the editable sample catalog and the admin sign-in explains what is missing.

Tests run the real schema in an in-memory PostgreSQL ([PGlite](https://pglite.dev)), including the permission checks: [`src/tests/database.test.ts`](./src/tests/database.test.ts) and [`src/tests/team-api.test.ts`](./src/tests/team-api.test.ts).

## Admin capabilities

- **Overview:** stock warnings, recent customer requests and sales totals.
- **Inventory:** add new variants, individual used units and upcoming models; review/edit specs; adjust prices, stock and visibility; upload/reorder/delete optimized photos; reserve used units for 1–14 days.
- **Sales:** record a transaction atomically with its stock update; eligible staff may undo recent sales, and owners can undo older sales.
- **Leads:** triage trade-in, contact and notify-me requests, save internal notes, and contact customers by phone or WhatsApp.
- **Owner-only settings:** shop details, sold badge period, low-stock threshold, trade-in rules/base values, private used-unit cost/IMEI/notes, audit history and full ZIP export.

Only owners can access settings, audit data, export, or private cost/IMEI fields. Staff and public catalog queries use restricted columns/views. Every signed-in query tells the database who is acting, so its own checks still apply: sellers cannot read or set cost price, IMEI or private notes, and only owners can undo a sale older than 24 hours.

## Specification lookup

The admin suggestion flow uses the bundled review-required library, Wikipedia and pasted text; optional Gemini lookup is last and is only enabled when `GEMINI_API_KEY` is supplied. The flow normalizes, validates, flags implausible values, preserves locked/known fields and requires a human review before storefront publication. Provider output is a suggestion, not a verified specification. Pasting manufacturer information is available when external sources fail.

## Backups

- Owners can download **Export everything** from Admin → Settings. The ZIP contains JSON records, customer requests, audit history, private used-unit data and uploaded photos. Treat it as sensitive personal data; store it encrypted and restrict access. It never contains passwords or authenticator secrets.
- cPanel's **JetBackup** also backs up the database and the `~/siaab-photos` folder. Download and verify a backup at least monthly and before major changes.

## Deploy on cPanel

The site runs as a Node.js app on cPanel and deploys itself from GitHub.

1. cPanel → **Setup Node.js App** → create an app: Node.js 20, Production, application root `siaabmobile`, the site's domain, startup file `server.js`. Add `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL` and (optionally) `GEMINI_API_KEY` as environment variables. Do not press "Run NPM Install"; the upload includes its own trimmed `node_modules`.
2. cPanel → **SSH Access** → Manage SSH Keys: import a deploy key's public half and **Authorize** it.
3. GitHub → repository **Settings → Secrets and variables → Actions**: secrets `SSH_HOST`, `SSH_USER` (the cPanel user) and `SSH_PRIVATE_KEY`; variables `SSH_KNOWN_HOSTS` (from `ssh-keyscan -t ed25519 HOST`) and `SITE_URL`.
4. Every push to `main` runs [`.github/workflows/deploy-cpanel.yml`](./.github/workflows/deploy-cpanel.yml): it builds the site in standalone mode, copies it over SSH as one archive, unpacks it beside the live folder, swaps the folders, restarts the app and checks `/api/health`. Without the SSH secrets the workflow skips quietly. (File-by-file FTP was too slow for the first upload and was cut off by the server.)
5. HTTPS: the host issues a Let's Encrypt certificate automatically; turn on **Force HTTPS Redirect** in cPanel → Domains. Sign-in cookies require HTTPS.
6. Verify `/api/health`, `/admin/login`, the catalog and a customer request.

To upload by hand instead, run `npm run package:cpanel`; it writes `siaabmobile-cpanel.zip` to extract into the app folder.

## Editable sample data and contact details

- Sample catalog: [`src/data/phones.ts`](./src/data/phones.ts)
- Sample upcoming devices: [`src/data/upcoming.ts`](./src/data/upcoming.ts)
- Sample trade-in values: [`src/data/tradeInValues.ts`](./src/data/tradeInValues.ts)
- Sample trade-in logic: [`src/lib/tradeIn.ts`](./src/lib/tradeIn.ts)
- Sample shop details: [`src/data/shop.ts`](./src/data/shop.ts)
- Database design: [`src/lib/db/schema.ts`](./src/lib/db/schema.ts)

All sample prices, stock, warranties, device details, trade-in values, upcoming dates and expected prices are illustrative. Verify them before publication. See [`ASSUMPTIONS.md`](./ASSUMPTIONS.md).

## Stack

- Next.js 15 App Router, React 18, TypeScript and Tailwind CSS.
- PostgreSQL through `pg`; the site's own sign-in (scrypt passwords, authenticator codes, database-backed sessions); photos on the server disk.
- Recharts, Lucide icons, Zod, Vitest and Testing Library.
- cPanel Setup Node.js App, deployed by GitHub Actions over FTPS.

## Adding a phone (admin)

Admin → Inventory → **Add inventory** opens a two-step form.

1. **Phone details:** type, brand, model, colour(s), RAM, storage, price, quantity and photos. For several colours write them with commas (for example `Black, Blue`); each colour gets its own stock line with the same quantity. Customers see the colours but cannot choose one. If the model already exists, the form adds the new colour or storage to it instead of creating a duplicate.
2. **Specifications:** the app looks up the remaining specifications automatically (saved library, Wikipedia, then the optional Google AI source). Review the list, tick **These specifications look right** and the phone is published. Without that tick it is saved as a draft and stays hidden. If nothing is found you can paste specifications copied from any website, or save and customers see "Not specified".

Photos chosen in step 1 are shrunk to WebP (under 200 KB) and uploaded as soon as the phone is saved. The first photo is the main one.

### Free spec lookup for brand-new phones

Wikipedia rarely has articles for phones released in the last year, so for new models the optional Google AI source does most of the work. It uses Google's free Gemini API:

1. Create a free key at Google AI Studio (aistudio.google.com) with the shop's Google account.
2. Add it to the host's environment variables as `GEMINI_API_KEY` (cPanel: Setup Node.js App → the app → **Environment variables**), then redeploy. Never put the key in the repository or in chat.
3. The app picks Google's newest stable Flash model on its own (it starts with `gemini-flash-latest` and, if Google has retired a name, asks which models your key can use). Set `GEMINI_MODEL` only to force a specific model.

Free-tier limits apply; when Google answers "busy", wait a minute or paste the specifications instead. AI-found specifications are suggestions: always check them before ticking the confirmation box.

## Two-factor sign-in (optional)

Admin → Settings → **Two-factor sign-in** → *Turn on two-factor*. Scan the QR code with Google Authenticator, Microsoft Authenticator or Authy and enter the 6-digit code. From then on sign-in asks for a code after the password. The card is in the owner's Settings page, so it protects the owner account; seller accounts keep signing in with a password.

Lost the phone? In cPanel Terminal run `node set-owner.mjs --remove-two-factor` in the app folder (see *Configure the database*); it sets a new password and turns two-factor off.

## Languages

The storefront has an English / አማርኛ switch in the header (remembered in a cookie). Translations live in [`src/i18n/am.ts`](./src/i18n/am.ts): the key is the exact English text and any text without an entry stays in English. Product names, specifications and the admin panel are not translated. Have a native Amharic speaker review the wording before launch. A test fails if new storefront text is added without an Amharic entry.

## Other small settings

- Lines under the price on phone pages: [`src/data/assurances.ts`](./src/data/assurances.ts). Change them to match the shop's real policy.
- Backup reminder: the admin overview and settings show how long ago this browser last downloaded **Export everything**.
- Share button on phone pages uses the phone's share sheet where available, with WhatsApp, Telegram and copy-link as fallbacks.

## Logo, home-screen app and dark theme

- **Logo:** drawn as SVG in [`src/components/BrandMark.tsx`](./src/components/BrandMark.tsx) and [`public/logo.svg`](./public/logo.svg). App icons live in `public/icons/` (192 px, 512 px, a maskable 512 px for Android and a 180 px Apple touch icon).
- **Home-screen name:** [`app/manifest.ts`](./app/manifest.ts) names the installed app "SiaabMobile". A shortcut added before this change keeps its old name; remove it and add it again from Chrome.
- **Dark theme:** the moon/sun button in the header switches themes and the choice is remembered. Without a choice the site follows the phone's own dark-mode setting. Dark colours for each rule are generated at build time by [`postcss-dark-theme.cjs`](./postcss-dark-theme.cjs) from the normal stylesheet; the shared dark colours and a few hand-picked overrides are at the end of `src/index.css`. The admin panel always stays light.
