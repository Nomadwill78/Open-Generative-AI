# Sprint 4: Real provider evaluation and cost controls

**Research date:** November 25, 2026. **Status:** Research only. No paid model calls, new supplier accounts, API keys, prepayments, or production deployment are authorized. All rates below are quoted USD API list prices at the links shown, not signed vendor quotes. Vendor prices, plans, model availability, output terms, and commercial-use policies may change.

## Image provider shortlist

| Candidate | API pricing observed | Example output | Operating fit |
|---|---|---|---|
| Google Gemini 3.1 Flash Lite Image (Nano Banana 2 Lite) | $0.0336 per 1K output image; $0.25 per 1M input text/image/video tokens | 100 1K outputs = **$3.36** before input/output extras | Low-cost default option for basic content |
| Google Gemini 3.1 Flash Image (Nano Banana 2) | $0.067 per 1K output image; $0.50 per 1M input text/image tokens | 100 1K outputs = **$6.70** before input extras | More capable interactive editing/branding tests |
| fal Nano Banana 2 | $0.08 per image (listed model API pricing) | 100 outputs = **$8.00** | Provider aggregator and alternative to direct Gemini; convenience adds cost |
| OpenAI GPT-Image-2.6 Sunburst / Flare | Image input $4 per 1M tokens, image output $15 per 1M tokens; text input $2.50 per 1M tokens | **Variable** per output token count, quality and prompt; do not assume a fixed cost per image | Premium candidate for detailed creative editing; must measure actual tokens before setting a retail price |

Sources:
- Google direct API: https://ai.google.dev/gemini-api/docs/pricing/
- fal model pricing: https://fal.ai/pricing
- OpenAI API multimodal pricing: https://developers.openai.com/api/docs/pricing
- OpenAI image generation guide and calculator: https://developers.openai.com/api/docs/guides/image-generation

Google prices above are **output-equivalent** 1K image rates. Prompt tokens, any reference images, search grounding, tax, retries, storage, and bandwidth can add costs. Provider reliability, visual quality, logos/text accuracy and image-editing consistency have not been benchmarked with paid requests.

## Video provider shortlist

| Candidate | Quoted API price | Five-second clip | Ten-second clip | Fit |
|---|---:|---:|---:|---|
| fal MiniMax H3 Max Turbo (text/image to video) | $0.015 per output second | **$0.075** | **$0.15** | Lowest-cost preview candidate, output quality needs benchmarking |
| fal MiniMax H3 Max | $0.03 per output second | **$0.15** | **$0.30** | Mid-tier backup for video generation |
| Runway Dev Gen-4 Turbo | $0.05 per output second | **$0.25** | **$0.50** | Established creative-video workflow candidate |
| Runway Dev Gen-4.5 | $0.12 per output second | **$0.60** | **$1.20** | Premium model, needs distinct retail price |
| Runway Dev Kling 3.0 Pro with audio | $0.17 per output second | **$0.85** | **$1.70** | Native-audio premium route; price depends on settings |

Sources:
- fal API pricing: https://fal.ai/pricing
- Runway Dev API pricing: https://dev.runwayml.com/pricing
- Runway model pricing mechanics, rounding and promotions: https://docs.dev.runwayml.com/guides/pricing/

Runway developer credits are $0.01 per *supplier* credit; they are **not** Nomad Creative Studio customer credits. Runway and fal price changes and minimum durations can shift actual cost. Duration, aspect ratio, resolution, input clips, audio, multiple outputs, retries, tax, output storage and delivery fees matter. Do not extrapolate a published 5-second rate to unsupported durations without confirming model capabilities.

## Illustrative supplier budget, before overhead

| Workload | Google 3.1 Flash Lite Image | fal H3 Max Turbo video | Runway Gen-4 Turbo video | Runway Gen-4.5 video |
|---|---:|---:|---:|---:|
| 100 outputs (1K images or 5-second clips) | $3.36 | $7.50 | $25.00 | $60.00 |
| 1,000 outputs (1K images or 5-second clips) | $33.60 | $75.00 | $250.00 | $600.00 |

These are arithmetic illustrations, **not** quotes, account limits or forecasts. No provider requests were made.

## Retail credit-policy warning

The Sprint 3 `mock-image-v1 = 25 credits` and `mock-video-v1 = 100 credits` costs are **synthetic test charges only**. They MUST NOT be copied blindly into real generation. The currently proposed packs imply $0.01 of nominal retail revenue per customer credit (e.g. 2,900 credits for $29) before fees. Under that purely illustrative valuation, 100 customer credits is $1 retail. A ten-second Runway Gen-4.5 request costs $1.20 in supplier fees alone and would lose money before overhead.

Before a paid pilot:
1. Separate product display credits from supplier API credits.
2. Publish **per-model / quality / resolution / duration** pricing rules. Never let the browser choose supplier costs.
3. Maintain a **USD expense reservation** at the high end of each supplier's cost envelope; settle from supplier metered usage, refund only unspent customer credits.
4. Enforce owner-approved supplier spending caps at the request, daily and calendar-month levels, independent of customer prepaid balance and per-user rate limits. Persist authorizations and metered supplier receipts.
5. Require reliable provider status callbacks, verified invoices, timeout handling, idempotency of external job submission, media retention/expiry and an ops kill switch.
6. Budget separately for taxes, retries, object storage, bandwidth, card processing, refunds and content safety review.
7. Validate commercial usage, training/data-retention policies, image/video rights, moderation and any content restrictions for each model before allowing customers to publish results.

## Preliminary architecture decision

**Do not integrate a paid provider yet.** After explicit dollar-budget authorization:
- **Standard image** candidate: Google Gemini 3.1 Flash Lite Image direct API; compare its quality with Gemini 3.1 Flash Image and OpenAI GPT-Image-2.6 on a fixed evaluation set.
- **Cost-sensitive video** candidate: fal MiniMax H3 Max Turbo; compare acceptable 5-second motion and text alignment against Runway Gen-4 Turbo.
- **Premium video** candidate: Runway Gen-4.5 (separate price tier). Validate quality against Gen-4 Turbo before the additional cost is justified.
- Use a **small fixed test matrix** of prompts, styles, aspect ratios, image-to-video samples and output durations. Gather objectively rated prompt adherence, stability, editability, output artifacts, queue/latency, provider failure-rate and actual billed USD per accepted output.
- Do not create API keys, place deposits, attach billing methods, activate usage or make test requests without a separate written approval.

## Release blockers

No production paid generation until:
- Mock rate limiting, global and per-user concurrency and alerting are reviewed;
- Real-money usage limits and billing audit reports are added;
- Alert delivery is confirmed to an authorized operator, not merely stored in the database;
- Transaction recovery covers provider timeouts and callback duplication;
- Credit bundles and gross margins are approved;
- Provider policy and credential security checks pass;
- The user separately approves a capped paid pilot.
