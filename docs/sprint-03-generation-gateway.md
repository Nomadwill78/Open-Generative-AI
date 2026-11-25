# Sprint 3: Isolated mock generation gateway

**Status:** Development branch only. Do not merge or deploy to any existing staging or production app without review. Do not enable paid model credentials.

## Components
- `lib/generation/mock-contract.mjs`: strict request validation, UUID idempotency keys, SHA-256 request fingerprints and immutable mock catalog.
- `lib/generation/mock-provider.mjs`: deterministic, **zero-network** local mock. It outputs simulated metadata, **not a real image or video**.
- `lib/generation/gateway-server.mjs`: authentication-context server gateway and allowlisted privileged Supabase RPC calls.
- `app/mock-studio`: authenticated, explicitly flagged lab and recent job history.
- `db/generation/sprint-03-mock-gateway.sql`: new columns on existing job records and server-only RPCs to reserve, settle and recover stale mock requests.
- `tests/nomadGenerationGateway.test.mjs`: model allowlist, request binding, no-paid-provider guarantee and isolated mock RPC accounting.

## Synthetic prices (NOT real supplier prices)
- `mock-image-v1`: 25 **test credits**.
- `mock-video-v1`: 100 **test credits**.

The client never supplies cost. Both server contract and SQL enforce the model allowlist; the database calculates charge amounts itself.

## Atomic accounting and idempotency
1. Verify the authenticated customer on the server. Never trust user IDs or prices from a form.
2. Recover that customer's mock-only reservations older than five minutes.
3. Atomically lock the wallet, check the request UUID and immutable request fingerprint, validate optional project ownership, create the job and deduct credits through the existing ledger function.
4. Run the deterministic local provider. It does not call an AI API.
5. On success, mark the job succeeded and retain the reserved charge. On failure, add an equal release credit through the ledger and mark failed. Final states are immutable and settlement retries do not duplicate charges/refunds.
6. If the process terminates before settlement, a future mock request can release old reservations. Real-provider job states cannot use this mock-only recovery path.

Current supported job statuses are `reserved`, `succeeded` and `failed`. No asynchronous paid provider workflow, object storage or finished user-media asset has been added. Prompts are hashed for request matching rather than persisted in job records.

## Feature gate
The lab requires `NOMAD_MOCK_GENERATION_ENABLED=true` on an **isolated development preview**, `NOMAD_STRIPE_TEST_ENABLED=true`, and server-side Supabase settings. It forcibly rejects `VERCEL_ENV=production`. It remains disabled in all existing environments unless configured separately. Never set it on a production branch.

## Verification
- Normal CI: `npm ci && npm run build:packages && npm test && npm run build`.
- Supabase transaction-only test: executed the SQL migration and fixtures inside `BEGIN; ...; ROLLBACK;`, proving reservation, duplicate suppression, settlement, failure release, insufficient balance, cross-user project rejection, invalid output rejection and stale reservation recovery.
- Important: the SQL migration has **not** been applied to the persistent Supabase database. Production/customer balances and the existing staging site were not modified. A controlled isolated dev database is recommended before app-level browser testing.

## Future release blockers
- Separate test database/preview and migration version management.
- Login, browser integration and parallel concurrency tests.
- Rate limits, abuse prevention, and monitoring on gateway actions.
- Credit accounting for canceled and timed-out real jobs.
- Model cost/retail pricing and loss-limit approvals before external-provider integration.
- Signed job receipts, durable output storage, actual provider credentials and refund/dispute policies.

**No paid AI provider is contacted. No production deployment is authorized.**
