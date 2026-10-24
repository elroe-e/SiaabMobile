# Assumptions and launch checklist

- The business name, phone/WhatsApp numbers, Telegram handle, Megenagna address, email, opening hours and map destination began as editable sample details. Confirm every contact value and the exact map pin before launch; owner settings can update public store details.
- Prices, availability, stock counts, warranties, phone specifications, used-device condition and trade-in values are sample content. Verify them before publishing or quoting a customer.
- Upcoming device dates, expected-price ranges and specifications are explicitly unconfirmed placeholders. Update them in Admin → Inventory and keep the storefront disclaimer visible.
- ETB is the assumed display currency. The current sample artwork is generated SVG and is not a photograph of a specific item. Upload only appropriately licensed images.
- Trade-in estimates are approximate; the final offer follows in-person inspection. Review all multipliers, issue penalties and base values with the shop owner before accepting requests.
- Customer contact details and request payloads are stored in Supabase only after a successful lead submission. Public forms also prepare a WhatsApp message for the customer to review and send. The database applies a per-contact request limit.
- Supabase is the source of truth when configured and seeded. If it is not configured or cannot be reached, the public page renders editable sample data; the health endpoint reports database unavailability.
- There is no online payment, public account registration or anonymous access to private inventory. Staff accounts are created by the owner from a trusted terminal; the service-role key is never needed by the deployed site.
- Owner exports contain personal data and confidential information, including leads, audit records, used-unit costs and IMEIs. Store exports encrypted, limit access and follow applicable privacy/retention requirements.
- Free hosting/database tiers have quotas, pausing behavior and terms that can change. Review current provider terms, usage and commercial eligibility before launch; free-tier availability is not a guarantee of uninterrupted service.
- The production origin defaults to `https://siaabmobile.com`. Update `NEXT_PUBLIC_SITE_URL`, Supabase Auth's allowed URLs, Netlify environment settings and the GitHub Actions `SITE_URL` variable for the actual domain.
