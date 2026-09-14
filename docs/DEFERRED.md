# Deferred items

Things intentionally not built yet, so they don't get lost. Revisit each when its trigger condition is met.

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
