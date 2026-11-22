# Apollo Laundry Drycleaner

Responsive black, white, and stainless-steel website for everyday laundry, dry cleaning, pickup requests and delivery requests. The original design includes an animated washing machine, rotating service headline and moving ticker, with reduced-motion support.

## What visitors can do

- Submit a pickup request for Laundry, Dry cleaning, or both.
- Request delivery of an existing Apollo order, with an optional order reference.
- Check a street address first. For a verified address in range, enter a preferred date (within 180 days), broad time window and contact details.
- Provide an email address and phone number, add special instructions, and review the request. Apollo follows up by email.
- Receive a reference number only **after** the website email successfully reaches the email provider. A request is not a confirmed appointment.

On narrow screens, persistent request actions are shown at the bottom of the page and hidden while the form is open. The modal traps keyboard focus and respects reduced-motion preferences.

## Deployment

Source repository: `Madmonk2523/apollo-laundry-drycleaner`. Vercel deploys automatically from `main` to the `apollo-laundry-drycleaner` project. `vercel.json` sends only public assets to `dist` and includes the compressed city directory in both Node functions. Source stays at the root. No new keys, service subscriptions or paid geocoding are needed.

## Activate delivery of request emails

Create a free Resend account and verify a sender domain. In Vercel's **Settings → Environment Variables**, add these as production secrets:

- `RESEND_API_KEY`: API key for Resend.
- `APOLLO_REQUEST_EMAIL`: real business inbox for incoming requests.
- `APOLLO_FROM_EMAIL`: Resend-verified sender, e.g. `Apollo Laundry <requests@yourdomain.com>`.
- `APOLLO_SEND_CUSTOMER_CONFIRMATION`: optional `true` to email an acknowledgment (not a booking confirmation) to the customer.

Redeploy after adding secrets, then, with the owner’s approval, send a **test pickup** and **test delivery** request and confirm both arrive with the correct customer email (also used as Reply-To), phone, date, address, and notes. Until the required secrets are present, submissions return HTTP 503 with an honest error instead of showing a fake success. Do not paste credentials into GitHub or client-side source. The form includes a tap-to-call fallback before collecting personal details and if online delivery is unavailable.

## Before advertising the site

- Business address, phone, hours and Greenpoint pickup coverage were verified against the supplied Google listing. Confirm any changes and current garment pricing with the business.
- If the business needs same-day cutoff rules or ZIP-only serviceability, obtain the exact rules and enforce them server-side.
- Determine whether deliveries can be requested for customers without an existing order (currently, delivery means an already cleaned order).
- Test email deliverability, including replies and customer acknowledgment when enabled.
- Confirm the owner can manage consent and customer details securely.

## Tests

```bash
node --test tests/*.test.js
```

The tests exercise exact radius boundaries, ambiguous and unknown addresses, stale or manipulated submission data, pickup/delivery, validation, and mocked transport. See [QA](qa/README.md) for local review and checks.

## Verified content

The supplied Google listing was verified on November 10, 2026. The page includes its address, phone, hours, local pickup service, five complete attributed five-star reviews in a manual carousel (no numerical rating). Google photographs remain linked at their source because the available images are customer-contributed and reuse permission has not been established. See CONTENT-SOURCES.md.

## Address coverage

The 3-mile radius is **straight-line**, inclusive, from the NYC OTI point for 137 Franklin St, Brooklyn, NY 11222 (latitude 40.730974293023, longitude -73.957917984047, AddressPoint object ID 1232477). Both actions check the same radius. Before accepting a request, the server looks up the selected public building ID again, confirms the address still matches, and computes distance from the bundled coordinates. It ignores client-supplied eligibility or coordinates. Apartment/suite is separate and does not affect distance.

The server searches a vetted snapshot of [NYC Open Data AddressPoint](https://data.cityofnewyork.us/City-Government/AddressPoint/uf93-f8nk), approximately 221,000 public address points within a rectangle that extends beyond the 3-mile circle. Addresses are looked up on Apollo's site using its own copy of the data; no separate map or geocoding provider receives visitor queries. Unit, name, and contact details are not used for the lookup. The existing configured email transport is used only for final requests.

A verified address beyond the circle displays the requested outside-area message. A missing/new/ambiguous address, an address beyond the indexed NYC region, or a temporary lookup failure is **not** classified as outside. Visitors can call Apollo at (929) 264-6070 for help. The city snapshot is not a unit registry or a nationwide geocoder.

To refresh the public directory, run `python3 scripts/refresh-addresses.py`. Review any city schema/storefront coordinate changes, then rerun the automated checks. Only this refresh command queries NYC Open Data; deployed runtime does not. Pricing and garment/add-on policy are unchanged.

## Copy cleanup

Keep interface wording concise. Decorative scheduling labels and estimated form completion times were removed; required booking disclosures and pickup/delivery distinctions remain.
