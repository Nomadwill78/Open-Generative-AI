# Nomad Creative Studio: $12 Total Supplier Pilot, Provider Credential Setup

**Budget ceiling approved November 26, 2026: $12.00 USD TOTAL across all suppliers.**
**NO authorization to incur charges or enable real AI generation has been issued.**
**Scope:** isolated Supabase development project `srybidmpvzgddjvcxugz` only. Draft PR #4 remains unmerged. Existing customer database `raqcqstsqphemgldkwbv` must not be used for pilot tests.

## Budget record and prerequisites

- The rate card from November 25, 2026 remains business-approved for future pilot development, **not** for live billing.
- Read-only policy: `SUPPLIER_PILOT_TOTAL_BUDGET_CENTS=1200`, `SUPPLIER_SPENDING_AUTHORIZED=false`, `REAL_PROVIDER_USAGE_ENABLED=false` in `lib/generation/provider-credit-proposals.mjs`.
- Database-only budget record: `nomad_ops.supplier_pilot_budget` has total cash ceiling $12, cash outlay $0, unpaid liabilities $0, supplier spending disabled, generation disabled; anonymous and authenticated Data API roles have no access.
- This record is **NOT yet a fully integrated hard spending gate on future provider calls**. Before any paid generation is authorized, implement atomic supplier-USD reservations and settle against vendor receipts, including deposits, prepaid-balance usage, additional fees, retries and failed jobs. Fail closed if the total could exceed $12.
- Do not automate wallet reload or buy provider credits until owner explicitly approves the initial purchase(s).
- **Recommended possible future split if provider minimums permit:** $5.00 Google Gemini paid prepay + $7.00 fal prepaid. This is an allocation suggestion, not a purchase authorization. If the provider presents a larger minimum, stop instead of proceeding.
- Runway Dev API initial payment minimum $10 means Google $5 + Runway $10 cannot both be funded under this $12 ceiling. Defer Runway Dev until a separately approved budget or different allocation.
- The user's connected Runway ChatGPT workspace is **not** an API project credential and its app credits do not automatically fund Runway developer API usage.

## Credentials: create without purchasing

### Google Gemini image API

1. Go to https://aistudio.google.com/api-keys and sign in with a Google account authorized to own the Nomad test project.
2. Create a new project/key named for **Nomad Creative Studio Development** (or use a dedicated Google Cloud project).
3. Record the private key in a password manager. **Do not paste it into ChatGPT, a GitHub file, issue/PR, public Vercel environment variable or screenshot.**
4. If later explicitly approved to fund: use the provider's Billing flow. Google's published default minimum prepay is $5, but the actual account may show a larger minimum. Stop if the amount exceeds the remaining $12 budget. Disable automatic reload and review quotas and billing.
5. Store the credential in isolated Supabase Edge Function secrets under `GEMINI_API_KEY`.

Official: https://aistudio.google.com/docs/get-started ; https://ai.google.dev/gemini-api/docs/billing

### fal Model API for video

1. Go to https://fal.ai/dashboard/keys and sign in or create an account.
2. Create a new **API** key scoped to a dedicated development account/team, preferably named `nomad-creative-studio-dev`.
3. Store the key in a password manager without sharing in chat or GitHub.
4. fal states a minimum **$1** initial prepaid top-up. A suggested future allocation is $7 *only after explicit purchase approval*. Check spending controls and automatic top-ups; aim for prepaid lock when balance is exhausted.
5. Store the credential in isolated Supabase Edge Function secrets under `FAL_KEY`.

Official: https://fal.ai/learn/tools/how-to-generate-ai-videos-with-an-api ; https://fal.ai/docs/documentation/model-apis/pricing

### Runway Dev API (deferred)

1. Go to https://dev.runwayml.com / https://dev.runway.com/settings/api-keys.
2. Create a dedicated development API project and API key.
3. Save the key once in a password manager. The developer credentials are distinct from the Runway app and connected ChatGPT workspace.
4. Runway Dev requires **at least $10 initial API credit purchase** before using the API. **Do not buy** under the proposed Google+fal $12 pilot allocation.
5. If Runway is later approved and funded, store it only on the isolated Supabase Edge Functions secret manager as `RUNWAYML_API_SECRET`.

Official: https://docs.dev.runwayml.com/guides/setup/

## Where to put the credentials

Use the isolated project's Supabase dashboard (https://supabase.com/dashboard/project/srybidmpvzgddjvcxugz), then **Edge Functions > Secrets**. As project Owner/Admin, add:

| Secret name | Where it comes from |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio keys |
| `FAL_KEY` | fal dashboard keys |
| `RUNWAYML_API_SECRET` | Runway Dev key, only if separately approved later |

Only provision keys for providers you are preparing to evaluate. They must never be in `NEXT_PUBLIC_*` variables, any client-side bundle, GitHub actions logs, website forms or ChatGPT messages.

**Current Edge Function remains a mock-only implementation.** Merely adding a secret does not authorize it to contact vendors, and the application still requires separate approved code, strong supplier-budget ledger enforcement, a vendor-cost preflight and an explicit paid-test authorization.

## Verification after credentials are stored

1. Confirm key names exist **without retrieving or printing secret values**.
2. Create a no-spend key-configuration check in a separate sandbox endpoint, returning only booleans and model availability where free.
3. Recheck exact model IDs and charges before authorizing any paid request.
4. Implement fail-closed USD commitments, provider callback verification, idempotency, retries/refunds and abuse monitoring.
5. Obtain explicit owner approval of vendor/top-up amounts and the small fixed test matrix before initiating billable activity.

Reference price card: `docs/sprint-04-provider-credit-rate-card.md`.
