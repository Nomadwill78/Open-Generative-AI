# Commerce implementation gates

This branch is a prototype. No live checkout, shared provider key, or hosted database is provisioned.

## Pricing
The catalog proposes one-time prepaid packs, not subscriptions. One credit is one US cent of retail value. The 60% default contribution margin is a hypothesis; validate provider quotes, payment fees, retries, storage, labor and taxes before activating sales. No model is enabled without a trusted server-side price.

## Required next implementation
- Create a dedicated Supabase project only after checking plan costs; never reuse unrelated databases. Apply bootstrap.sql in a disposable test database first. Generate a formal migration with the CLI after verification.
- Implement Supabase authentication with verified server-side identity; use publishable keys for browser access, no service credentials in client code. Reject anonymous accounts for checkout.
- Build a server-only checkout route using an approved catalog, authenticated user ID, Stripe test keys, and server-created checkout metadata. Verify webhook signatures on raw bodies using the Stripe SDK. Validate paid session amount, currency, pack, ownership and environment; atomically record payment and credit once per session. Never grant credits from a success URL.
- Implement transactional reservation and job creation, idempotent provider submission, completion/release and ambiguous-result reconciliation. The low-level ledger primitive alone is not sufficient. Handle disputes/refunds and account closure with a defined debt and retention policy.
- Separate managed generation from the inherited BYOK proxy. Deny all paid generation until the gateway, moderation, consent, provider terms, RLS and rate limits have passed tests.
- Validate two-user isolation, concurrent debits, idempotency collisions, duplicate checkout events, insufficient balance, failed/ambiguous provider requests and rollback. Use no live credentials.
