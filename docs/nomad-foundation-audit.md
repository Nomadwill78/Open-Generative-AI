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

## Follow-up static review
- `components/StandaloneShell.js` stores `muapi_key` in localStorage and a JavaScript-accessible cookie with a one-year max-age. The shared studio client passes the key via `x-api-key`; desktop and SSR may call the provider directly. Do not inject a company-owned key into this client or cookie. Preserve the existing private BYOK workflow until a separate authenticated server-side gateway is implemented.
- The web header and studio title now use Nomad branding; full palette, locale and desktop branding remain incomplete.
- `.github/workflows/nomad-validation.yml` defines a manual Node 22 recursive-submodule build/test workflow without provider secrets. It has not run. GitHub workflow_dispatch requires the workflow to exist on the default branch, so this new feature-branch workflow cannot be dispatched yet. Validate in an isolated runner or review and approve an appropriate CI workflow on the default branch first. Build and dependencies remain unverified.
