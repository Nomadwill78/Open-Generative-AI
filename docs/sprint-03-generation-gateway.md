# Sprint 3: Isolated mock generation acceptance preview

**Status:** Development preview only, not production. Draft PR #3 remains unmerged. No paid model API calls, live checkout or real image/video artifacts.

## Separate infrastructure

- New Supabase sandbox: `srybidmpvzgddjvcxugz` (`nomad-creative-studio-sprint-3-test`). The customer database `raqcqstsqphemgldkwbv` remains separate.
- Applied sandbox migrations: `nomad_sprint3_isolated_bootstrap`, `nomad_sprint3_mock_gateway`, `nomad_sprint3_sandbox_credit_seed`.
- Supabase Edge Function: `nomad-mock-generation` with `verify_jwt=true` and explicit Supabase Auth user verification.
- GitHub source: `supabase/functions/nomad-mock-generation/index.ts`; no third-party model SDK, media generation or paid supplier endpoint.
- Vercel Preview variables scoped to `nomad/sprint-03-generation-gateway` only: `NOMAD_SUPABASE_URL`, `NOMAD_SUPABASE_PUBLISHABLE_KEY`, `NOMAD_MOCK_DATABASE_REF=srybidmpvzgddjvcxugz`, `NOMAD_MOCK_GENERATION_ENABLED=true`.
- The Vercel Preview has **no service-role key for the sandbox**. It forwards a verified customer access token to the separate Supabase Edge Function.
- Existing protected checkout staging and its database are unchanged. The new preview has `NOMAD_STRIPE_TEST_ENABLED` unset, keeping Stripe Checkout disabled.

## End-to-end architecture

1. The Next.js server verifies a customer session with Supabase Auth. Unverified users cannot generate.
2. Form submission validates request UUID, prompt, allowlisted mock model and optional project ID. No user ID or price is accepted from the browser.
3. The Next.js server sends that customer's access JWT, plus validated request inputs, to `/functions/v1/nomad-mock-generation` at the **sandbox** Supabase origin.
4. The Edge Function validates the token again with Supabase Auth, requires a confirmed customer, and calculates the prompt SHA-256 fingerprint itself.
5. A service-role-only RPC grants a **one-time, fixed 500 synthetic test credit allowance** to the verified sandbox customer. This credit allowance is not a Stripe purchase.
6. The Edge Function recovers stale mock reservations, atomically reserves the hardcoded model price, and runs a deterministic local mock with no external AI API.
7. On success the charge is finalized. On simulated failure the same credits are released. Duplicate requests and settlement retries are idempotent.
8. The customer account can inspect only its own credits and job history through RLS. Results say explicitly that no real image or video was produced.

Mock prices: `mock-image-v1` costs 25 synthetic credits; `mock-video-v1` costs 100 synthetic credits. Neither amount is a real provider quote.

## Safety controls and boundaries

- Strict test project host guard in the Vercel gateway and Supabase Edge Function.
- No Vercel service-role key for sandbox access. Server-to-server operations use Supabase-managed Edge Function credentials.
- Edge function requires valid user JWT and independently checks the confirmed user.
- Public and authenticated roles cannot directly execute payment-grade/privileged accounting RPCs.
- Wallet locking, ownership checks, immutable request fingerprint and unique ledger operation keys.
- Size-bounded prompts and response payloads. Simulated provider failure refunds credits.
- The code refuses generation when `VERCEL_ENV` is not `preview`.
- Requires fresh customer registration for the separate sandbox database; existing staging users are not copied.
- No persistent user data was inserted during SQL testing. Tests used `BEGIN/ROLLBACK` fixtures.

## Validation and rollout

- GitHub CI: dependency install, workspace builds, automated Node tests and Next.js build.
- Supabase SQL: isolated seed, idempotency, concurrent-safe wallet locking, success/failure settlement, stale recovery, ownership and grants.
- Protected Preview: page GET checks via the Vercel connector and logged-in browser walkthrough (when supported).
- **Still required before production:** browser acceptance with a real confirmed test user, concurrency and abuse/rate-limit tests, reconciliation monitoring, accounting audits, review of model supplier costs, and signoff on production billing behavior.

Do not merge to main, enable live payments, add paid AI keys, or deploy to the production site.
