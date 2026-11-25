# Nomad Creative Studio: foundation audit

Status: preliminary static review; no production release authorized.

## Verified
- Root MIT license: preserve copyright and permission notices; audit submodule and asset licenses separately.
- Next.js 15, React 19, Electron 33, Node 22 Docker base.
- Three Git submodules: Vibe-Workflow, Open-Poe-AI and Open-AI-Design-Agent. Build shared packages before Next.js.
- Middleware rewrites most /api/v1 paths to MuAPI. Existing CSP allows unsafe-inline and unsafe-eval. Do not treat middleware as an authorization or billing boundary.
- Root route redirects to /studio; metadata is branded without altering the existing studio workflow.

## Build verification (not yet executed)
Use an isolated environment with Node 22 and no paid provider credentials. Initialize recursive submodules, inspect lifecycle scripts and lockfiles, then run npm ci, npm run build:packages, npm test, npm run build. Record exact versions, advisories and any failures. Audit submodule dependencies as well. Verify Docker runtime resolves workspace packages and test all API routes without real generation.

## Public launch gates
1. Inventory every provider request, upload, callback, agent and desktop path; establish server-side authentication and tenant authorization before enabling shared credentials.
2. Use server-only provider secrets; add rate limits, atomic credit reservation and settlement, idempotency, timeout and reconciliation. Default to deny paid generation unless authorized and funded.
3. Validate provider resale and commercial rights, content moderation, consent for likeness/voice, storage privacy, retention and abuse reporting.
4. Add signed and idempotent Stripe webhook handling, tested in test mode only; do not grant credits based on client redirects.
5. Validate security headers, production build, dependency advisories, tests and rollback. Do not publicly deploy until gates pass.

No provider purchases, deployments, secrets or payment changes are part of this sprint.
