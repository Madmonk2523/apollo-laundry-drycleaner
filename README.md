# Apollo Laundry Drycleaner

Responsive, accessible blue-and-white website for everyday laundry, dry cleaning, pickup requests and delivery requests. The original design includes an animated washing machine, rotating service headline and moving ticker, with reduced-motion support.

## What visitors can do

- Submit a pickup request for everyday laundry, dry cleaning, or both. Optional estimate of the amount of laundry.
- Request delivery of an existing Apollo order, with an optional order reference.
- Choose an address, preferred date (within 180 days), and broad time window.
- Specify email or phone-call follow-up, add special instructions, and review all details before submitting.
- Receive a reference number only **after** the website email successfully reaches the email provider. A request is not a confirmed appointment.

On narrow screens, persistent request actions are shown at the bottom of the page and hidden while the form is open. The modal traps keyboard focus and respects reduced-motion preferences.

## Deployment

Source repository: `Madmonk2523/apollo-laundry-drycleaner`. Vercel deploys automatically from `main` to the `apollo-laundry-drycleaner` project. No build command is required; `index.html` is at the root and the serverless handler is `api/request.js`.

## Activate delivery of request emails

Create a free Resend account and verify a sender domain. In Vercel's **Settings → Environment Variables**, add these as production secrets:

- `RESEND_API_KEY`: API key for Resend.
- `APOLLO_REQUEST_EMAIL`: real business inbox for incoming requests.
- `APOLLO_FROM_EMAIL`: Resend-verified sender, e.g. `Apollo Laundry <requests@yourdomain.com>`.
- `APOLLO_SEND_CUSTOMER_CONFIRMATION`: optional `true` to email an acknowledgment (not a booking confirmation) to the customer.

Redeploy after adding secrets, then send a **test pickup** and a **test delivery** request and confirm both arrive with the correct preferred contact method, date, address, and notes. Until the required secrets are present, submissions return HTTP 503 with an honest error instead of showing a fake success. Do not paste credentials into GitHub or client-side source.

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

The tests cover valid pickup and delivery requests, validation, date limits, escaped customer content, bot honeypot, missing email configuration, and email-transport behavior. Browser interaction and mobile layout were also tested manually with Playwright (external test harness).

## Verified content

The supplied Google listing was verified on November 10, 2026. The page includes its address, phone, hours, local pickup service, five complete attributed five-star reviews in a manual carousel (no numerical rating). Google photographs remain linked at their source because the available images are customer-contributed and reuse permission has not been established. See CONTENT-SOURCES.md.

## Copy and motion

The customer-facing service name remains **Everyday laundry**. A static headline and service strip replace the rotating copy and illustrations; they do not require JavaScript to read. Existing request forms, validation and reduced-motion handling remain.

## Copy cleanup

Keep interface wording concise. Decorative scheduling labels and estimated form completion times were removed; required booking disclosures and pickup/delivery distinctions remain.
