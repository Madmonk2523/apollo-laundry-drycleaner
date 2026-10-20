# Apollo Laundry Drycleaner

Premium blue-and-white responsive website, animated interactive homepage, multi-step **pickup** and **delivery** request forms, accessible navigation and Vercel email endpoint.

## Deploy

Import this repository into Vercel, set framework preset to Other, use the repository root, no build command. Every subsequent push to main redeploys the site.

## Enable email forms

Provide these environment variables in Vercel Project Settings:

- `RESEND_API_KEY`: API key from Resend
- `APOLLO_REQUEST_EMAIL`: owner's inbox for new requests
- `APOLLO_FROM_EMAIL`: sender address from verified domain, e.g. `Apollo Laundry <requests@yourdomain.com>`
- `APOLLO_SEND_CUSTOMER_CONFIRMATION`: optional `true`

Redeploy and test both pickup/delivery forms. Forms do not confirm bookings; they only submit requests. Until email is configured, the endpoint returns 503 and the UI shows that requests aren't active.

Before public launch, confirm business address, service area, phone, pricing, and hours with the owner. No secret keys should ever be committed to this repository.
