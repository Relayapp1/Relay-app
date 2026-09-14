# Deferred items

Things intentionally not built yet, so they don't get lost. Revisit each when its trigger condition is met.

## Migrate backend off Base44 to Supabase + Vercel

**Status:** not started. This is the confirmed end-goal architecture — Relay is currently built entirely on Base44 (hosted Postgres-backed entities via `base44/entities/*.jsonc`, Deno serverless functions in `base44/functions/*`, Base44's own auth/file-storage/email, and the `@base44/sdk` client in `src/api/base44Client.js`). All of that is intended to be replaced with a self-hosted stack: Supabase (Postgres, auth, storage, row-level security) for the backend and Vercel for hosting/deploying the frontend (and likely Vercel serverless/edge functions or Supabase Edge Functions in place of `base44/functions/*`).

**Why this matters for how we build in the meantime:** we are NOT pre-abstracting the codebase against this migration right now — no adapter layers, no swappable-backend interfaces. That would be premature and would slow down feature work for a migration that hasn't started. Base44's own conventions (entities, `base44/functions`, RLS-style permission blocks in the `.jsonc` files, `base44.entities.X`/`base44.functions.invoke` calls throughout `src/`) stay the normal way we build until this migration is actually underway.

**What the eventual migration will need to touch:**
- Every `base44.entities.*` call across `src/` (search is straightforward — they're not hidden behind an abstraction) → Supabase client queries, with the entity JSON schemas becoming real Postgres tables + RLS policies.
- Every `base44/functions/*/entry.ts` (currently Deno, using `base44.asServiceRole` for privileged writes) → Vercel serverless/edge functions or Supabase Edge Functions, using a service-role Supabase key for the same privileged-write pattern.
- Auth: Base44's built-in email/password + Google OAuth + the owner-only admin check (`src/lib/ownerAccess.js`) → Supabase Auth.
- File uploads (`base44.integrations.Core.UploadPrivateFile` / `CreateFileSignedUrl`, used for driver licenses, W-9s, government IDs, vehicle-condition photos, receipts) → Supabase Storage with signed URLs.
- Deployment/hosting (currently Base44's own `base44 dev`/`base44 dashboard open` publish flow) → Vercel's standard git-based deploy.
- Local dev workflow (`base44 dev`, `base44 dev --remote`, `base44 login`/`link`) → whatever Supabase's local dev CLI + Vercel's local dev setup look like instead.

**Revisit when:** the user is ready to schedule this migration as its own dedicated project phase — it's a full backend swap, not an incremental feature, and deserves its own planning pass rather than being folded into ongoing feature work.

## Platform fee

**Status:** not built. Relay currently takes $0 — brokers pay drivers wallet-to-wallet with no cut to the platform.

**User's current idea (not finalized):** $25 flat fee per job booked, or a $99/month subscription for frequent posters that drops the per-job fee to $5–7.

**Revisit when:** ready to decide on final pricing/economics. Blocks: the "volume-based fee tiers" loyalty feature (Phase 3 of the roadmap) and any per-job fee UI in the wallet/checkout flow.

## Real masked phone calling

**Status:** not built. Post-assignment contact is in-app chat only (`src/pages/TripCenter.jsx`), which the user confirmed is sufficient for now.

**What it would need:** a telephony provider (e.g. Twilio) issuing per-trip proxy numbers, plus a recurring cost.

**Revisit when:** users are asking for real phone contact and the recurring cost is worth it.

## Real 1099-NEC generation

**Status:** not built. Driver payment history is a downloadable earnings summary (CSV) only — no tax form generation.

**What it would need:** collecting SSN/EIN (W-9 equivalent for drivers, not just brokers), and following IRS e-filing rules — real legal/compliance responsibility.

**Revisit when:** driver payout volume makes this a real tax-reporting obligation, or a driver/accountant asks for it directly.

## Real background-check / MVR / ID-verification vendor

**Status:** not built. Driver vetting is self-attested consent (`driving_history_consent`) plus an uploaded report/license photos, reviewed manually by an admin (`src/pages/AdminDashboard.jsx` Approvals tab). No live API call to a background-check service.

**What it would need:** an account with a vendor like Checkr (background/MVR checks) or Persona/Stripe Identity (ID verification), and wiring their API into the driver/broker/individual approval flow in place of manual review.

**Revisit when:** ready to pay for and integrate a real vendor — the manual-review flow is built so this can slot in without changing the surrounding UI much.
