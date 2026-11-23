# Progress notes

## 2026-11-20 (pushed to main)
- Admin Overview: the four number cards now link to Inventory, Requests and Sales.
- Inventory pencil (Edit) window: model name, colour, RAM, storage, price/stock (used: grade, battery, accessories, warranty) and every specification can be changed after a phone is added, by the owner or a seller. Confirmed specs cannot be un-confirmed. See README "Editing a phone later".
- Add phone: RAM, storage, battery (new optional box in step 1) and colour typed by the shop are never replaced by the Gemini/Wikipedia lookup.
- Sales: Restock button on every Sale history row (database migration 004_restock_from_sale, applies on next start).
- Add phone: brand picker (Apple, Honor, Huawei, OnePlus, OPPO, realme, Samsung, vivo, Xiaomi) with type-ahead; brands typed in other capitals reuse the saved brand.
- Checks run: typecheck, lint, 149 tests, production build. Not yet clicked through in a browser or tried on the live database.

## 2026-11-20 (done, NOT pushed yet): free spec library + step 2 fill-in list
- `npm run specs:library`: scripts/fetch-wiki-phones.mjs downloads Wikipedia phone pages (cache .cache/, gitignored),
  scripts/build-spec-library.ts (bundled with rolldown) writes src/data/spec-library.generated.json (616 phones, 2018+; "X" and "X 5G" kept apart)
  and src/data/spec-models.json. Parser src/lib/specs/wiki-infobox.ts splits series pages per model (tests in wiki-infobox.test.ts).
- database-provider reads curated + generated, matches ignoring spaces/capitals/"5G".
- Add phone: ModelPicker suggestions (brand-picker.tsx, SuggestBox shared with BrandPicker; Tab only picks for brands).
- Step 2: SpecFields boxes replace the read-only list and JSON box; paste fills boxes client-side (parsePastedSpecs).
- Gemini: web search paused 1 hour after a 429 instead of until restart.
- Step 2 edits and pasted values survive Back→Next and Search again.
- Checks run: typecheck, lint, all tests, next build pass. Not clicked through in a browser.
- Missing from Wikipedia (sample): OnePlus 15, Poco F6, vivo X200, Honor Magic V3, realme GT 6 and others.

## 2026-11-21 (done, NOT pushed yet): Simple / Advanced specs
- Admin spec boxes (spec-fields.tsx) have a Simple/Advanced switch; Simple = size, refresh rate, chipset, main camera MP, battery, charging.
- Shop: src/lib/specs/simple-specs.ts decides simple vs advanced; advanced list has plain labels; Advanced button only when advanced specs exist.
- Also: grey example text removed from spec boxes (commit e7d599e); shop switcher highlight fixed (CSS used aria-selected).

## 2026-11-21: delete customer requests
- Owner-only bin button on Customer requests (app/admin/leads/ui.tsx), DELETE in app/api/admin/leads/route.ts, tests in src/tests/leads-delete.test.tsx.

## 2026-11-23: deleting a sold phone hides it
- Migration 005_hidden_stock: hidden_at on variants/used_units; public views skip hidden; restock_from_sale and undo_sale unhide.
- Inventory DELETE hides when sales exist; GET, Overview and sale picker skip hidden; re-adding the same colour/RAM/storage unhides.
- Tests: src/tests/inventory-hide.test.ts (real test database).
