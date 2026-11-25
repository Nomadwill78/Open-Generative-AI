# Stripe test-mode configuration and automatic fulfillment

Nomad Creative Studio accepts sandbox purchases only on the protected commerce staging branch. Live Stripe credentials and live event payloads are rejected. Managed AI generation against paid providers remains disabled.

## Staging environment

The protected Vercel project has these variables in **Preview**, scoped to `nomad/sprint-02-commerce`:
- `NOMAD_SUPABASE_URL` and `NOMAD_SUPABASE_PUBLISHABLE_KEY`: customer auth and RLS-scoped access.
- `NOMAD_SUPABASE_SERVICE_ROLE_KEY`: **server-only** privileged database access.
- `NOMAD_STRIPE_TEST_KEY`: test-mode API key for hosted Checkout.
- `NOMAD_CHECKOUT_ORIGIN`: the HTTPS staging URL.
- `NOMAD_STRIPE_TEST_ENABLED=true`: explicitly enable test checkout.
- `NOMAD_STRIPE_WEBHOOK_SECRET`: *legacy protected Vercel route only*. The active external webhook has its **own** signing secret, encrypted in Supabase Vault. These secrets are not interchangeable.

All secret values stay out of Git and browser bundles. The current Vercel API webhook route remains protected; it is not an active Stripe event destination.

## Isolated webhook receiver

- Public URL: `https://raqcqstsqphemgldkwbv.supabase.co/functions/v1/nomad-stripe-test-webhook`
- Source: `supabase/functions/nomad-stripe-test-webhook/index.ts`
- Deploy as a Supabase Edge Function with `verify_jwt=false`. This exception applies **only** to this Stripe-signed endpoint; the receiver verifies signatures before any financial changes.
- Active Stripe test-mode endpoint: `we_1Ufo0TRXQi1nfg3KSBgh6x58` with events `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
- Previous protected Vercel test-mode webhook `we_1Ufn8yRXQi1nfg3Ka5mm5HVC` is disabled.
- Signing secret is kept under Vault name `nomad_creative_test_stripe_webhook`, never in repository source or Edge Function code.
- The Edge Function forwards the **unmodified signed raw event** and `Stripe-Signature` to a `service_role`-only RPC `public.nomad_accept_signed_test_webhook` using its automatically-provided server credential.
- The RPC delegates to a restricted `nomad_private` definer for five-minute HMAC SHA-256 verification via `pgcrypto` and the encrypted Vault secret. It rejects live events and invalid checkout amounts or customer bindings, acknowledges unrelated products without crediting, and calls `nomad_fulfill_test_purchase` for atomic, idempotent wallet fulfillment.
- The customer-owned `/account` payment reconciliation form remains as a recovery path and shares the same purchase idempotency key.

## Validation

Passed database tests:
- Signed paid test session creates exactly one wallet purchase and ledger delta.
- Duplicate/replayed delivery does not credit twice.
- Forged signature is rejected.
- Signed Checkout events for other Stripe products do not mutate Nomad credits.
- Only the database service role can invoke the public RPC wrapper.
- Test fixtures were rolled back. The existing customer balance remained unchanged.

**Pending:** verify that Stripe actually reaches the new Supabase Edge Function and that a fresh paid Stripe sandbox Checkout session gets credited **without manually verifying on the account page**. Until an actual Stripe-to-Edge delivery is observed, do not claim full end-to-end automatic fulfillment.

Before any public production launch, review price and margin assumptions, taxes, refunds/disputes, retry monitoring, credential rotation, supplier spending limits, and production-only authentication and webhook configuration. No live payment processing is authorized.
