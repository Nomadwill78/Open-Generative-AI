# Stripe test-mode setup

The checkout path is disabled unless NOMAD_STRIPE_TEST_ENABLED=true and all required configuration is present. Never use a live Stripe key. Managed AI generation remains disabled in the commerce prototype.

## Preview-only configuration

Configure on the dedicated Vercel project, not in Git or chat:
- NOMAD_SUPABASE_URL: dedicated project HTTPS origin (already configured).
- NOMAD_SUPABASE_PUBLISHABLE_KEY: existing publishable key.
- NOMAD_SUPABASE_SERVICE_ROLE_KEY: dedicated project server-only secret; do not expose to clients.
- NOMAD_STRIPE_TEST_KEY: restricted test API key permitting Checkout Session creation and retrieval (or test secret key for isolated testing).
- NOMAD_STRIPE_WEBHOOK_SECRET: signing secret of the exact test event destination.
- NOMAD_CHECKOUT_ORIGIN: exact protected staging HTTPS origin, with no trailing slash.
- NOMAD_STRIPE_TEST_ENABLED: leave unset until the configuration and test access path are verified.

The handler is POST /api/nomad/stripe/webhook and expects snapshot events checkout.session.completed and checkout.session.async_payment_succeeded. Stripe's hosted Checkout is used with server-generated inline prices in USD. The success URL never grants credits.

The existing staging site is protected by Vercel Authentication, so direct Stripe delivery may be blocked before reaching this route. Do not disable site protection. For initial testing, use a local development instance with Stripe CLI forwarding to localhost, or design an isolated public webhook ingress which retains signature verification and has no customer-facing routes. Confirm the exact destination before creating a Stripe test webhook. Never embed a Vercel bypass token in a public URL or source code.

## Verification before enabling

1. Verify latest GitHub Actions run and deploy reviewed commit to staging only.
2. Verify account registration/login with a controlled test email and separate test users; test RLS.
3. Execute test Checkout with Stripe's documented test card; confirm a paid test session and one ledger credit entry.
4. Re-deliver the same signed event and a second event for the same session; confirm no double credit.
5. Reject tampering, stale signature, invalid prices, wrong currency, unpaid sessions, and all live sessions.
6. Confirm no service key or Stripe key reaches client bundles/logs. Test checkout gating with missing or live credentials.

The signature verifier uses Node crypto with raw bytes, HMAC SHA256, constant-time comparison and five-minute tolerance to avoid changing the dependency lockfile. Before production, replace with the official Stripe SDK and pin its version and lockfile; validate API-version compatibility, refund/dispute handling, operational rate limits, tax, and credit accounting concurrency. Test balances must never be usable against paid provider credentials. No production billing is authorized.
