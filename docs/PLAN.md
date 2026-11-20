# Progress notes

## 2026-11-20 (pushed to main)
- Admin Overview: the four number cards now link to Inventory, Requests and Sales.
- Inventory pencil (Edit) window: model name, colour, RAM, storage, price/stock (used: grade, battery, accessories, warranty) and every specification can be changed after a phone is added, by the owner or a seller. Confirmed specs cannot be un-confirmed. See README "Editing a phone later".
- Add phone: RAM, storage, battery (new optional box in step 1) and colour typed by the shop are never replaced by the Gemini/Wikipedia lookup.
- Sales: Restock button on every Sale history row (database migration 004_restock_from_sale, applies on next start).
- Add phone: brand picker (Apple, Honor, Huawei, OnePlus, OPPO, realme, Samsung, vivo, Xiaomi) with type-ahead; brands typed in other capitals reuse the saved brand.
- Checks run: typecheck, lint, 149 tests, production build. Not yet clicked through in a browser or tried on the live database.
