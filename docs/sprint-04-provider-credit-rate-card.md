# Sprint 4: Approved customer credit rate card for future pilot development

**Rate card dated November 25, 2026. Approved by the business owner on November 26, 2026 for future pilot development only. Not approved for live customer billing or supplier spending.**

These are **owner-approved proposed retail charges for future pilot development**. They are not active or available for live billing. The app's `REAL_PROVIDER_USAGE_ENABLED=false` and every catalog entry has `approvedForBilling=false`. Publishing this file does **not** create an API account, add funds, expose a paid-generation option, sell new packs, or authorize any supplier spend.

## Pricing basis

The existing draft customer credit packs represent `$0.01 per purchased credit`, before processing fees. These quotes assume exactly one specified output and no charge for promotional sandbox welcome credits. Every tier is set at **at least six times the quoted baseline supplier price**. This yields baseline supplier spend at most 16.7% of the listed retail equivalent, *before* prompt input, data transfer, payment fees, retries, storage, refunds, taxes, moderation, support and failures. It is **not** a guaranteed gross margin.

| Tier | Vendor / model | Output | Supplier baseline | Proposed customer credits | Retail equivalent |
|---|---|---|---:|---:|---:|
| Standard image | Google Gemini 3.1 Flash Lite Image | 1K image | $0.0336 | **25** | $0.25 |
| Enhanced image | Google Gemini 3.1 Flash Image | 1K image | $0.067 | **45** | $0.45 |
| Enhanced image | Google Gemini 3.1 Flash Image | 2K image | $0.101 | **65** | $0.65 |
| Enhanced image | Google Gemini 3.1 Flash Image | 4K image | $0.151 | **100** | $1.00 |
| Budget video | fal MiniMax H3 Max Turbo text-to-video | 5 seconds at listed tier | $0.075 | **50** | $0.50 |
| Budget video | fal MiniMax H3 Max Turbo text-to-video | 10 seconds at listed tier | $0.15 | **100** | $1.00 |
| Studio video | Runway Gen-4 Turbo | 5 seconds | $0.25 | **150** | $1.50 |
| Studio video | Runway Gen-4 Turbo | 10 seconds | $0.50 | **300** | $3.00 |
| Premium video | Runway Gen-4.5 | 5 seconds | $0.60 | **400** | $4.00 |
| Premium video | Runway Gen-4.5 | 10 seconds | $1.20 | **800** | $8.00 |
| Premium audio video | Runway Kling 3.0 Pro with audio | 5 seconds | $0.85 | **550** | $5.50 |

**Supplier sources verified on November 25, 2026**:
- Google official Gemini API image model prices and per-resolution equivalents: https://ai.google.dev/gemini-api/docs/pricing
- fal official price list, MiniMax H3 Max Turbo at $0.015 per output second for the listed tier: https://fal.ai/pricing
- Runway official developer API prices and one supplier credit = $0.01: https://dev.runwayml.com/pricing
- Runway API setup and minimum initial payment ($10): https://docs.dev.runwayml.com/guides/setup/

## Release gate and guardrails

1. **Owner pricing approval received November 26, 2026**, for this exact table and future pilot development only. Do not treat the pricing approval as authorization to bill customers, purchase AI credits, or activate suppliers. Keep the catalog blocked for live billing until separate explicit go-live authorization.
2. **No paid generation.** Reject all unknown model/quality/duration combinations. The current actual mock prices of 25/100 synthetic credits remain unchanged.
3. Preflight a provider's current pricing and output parameters before every paid job. If the actual worst-case supplier quote (including inputs, output, retry buffers, tax where applicable, storage and delivery) exceeds **25% of retail-equivalent revenue**, block the job pending a new quote and owner review.
4. Set a separate **hard USD supplier spend cap**, both total and daily, before enabling any provider. A credit balance is not proof that the business has cash available to pay the supplier.
5. Reserve the customer's full amount atomically with a USD supplier authorization, settle against actual provider receipts and refund according to documented failure policy.
6. Require a distinct user-visible disclosure of media quality, duration, expected price, refund behavior and acceptance of the final quoted credits.
7. Prevent use of *promotional sandbox credits* to purchase real supplier requests.
8. Recheck current supplier prices and commercial licensing, model availability, output retention, privacy and moderation before the actual pilot. Some listed models have output-specific settings and promotional rates.
9. Do not enable retries automatically until costs and idempotent billing have been measured.

## Approval record

- Business approval: **APPROVED November 26, 2026 for future pilot development only**, exactly as listed in the November 25, 2026 rate card.
- Source file: `lib/generation/provider-credit-proposals.mjs`.
- Review page: `/provider-pricing` on the protected development preview.
- Real provider usage: **disabled**, no provider credentials or prepaid balance.
- Production checkout or deployment: **not authorized**.
- Supplier purchases, new API keys, prepaid balances, or paid generation: **not authorized**.
- Separate release gates: USD spending budget; live-provider contract, credential, usage and margin review; final user approval for billing and production deployment.
