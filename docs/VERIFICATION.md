# Verification

Checked on 14 October 2026.

## Build and domain checks

- Clean dependency installation with npm ci.
- Production TypeScript/Vite build passes.
- 22 domain tests pass: qualified status, eligibility thresholds, immutable and audited mutations, duplicate batch/payment guards, stale payout eligibility, verification and resolution validation, stockpoint/staff assignments, KPI filtering and bucket totals, serialized inventory, and fixture reference integrity.
- No backend SDK, API requests, provider credentials, persistent storage, or environment-variable gates in application code.

## Browser checks

- Dashboard period/location filters update the computed metrics and chart.
- A pending member can be verified; pending count decreases and an audit record appears.
- Eligible balances create a payout batch. Marking it paid updates the ledger and summary. CSV download succeeds and contains masked sample accounts.
- Exception resolution requires an explanation and updates queue counts and audit history.
- Stockpoint reactivation requires a note and updates its status.
- Commission mode selection saves locally and updates the rate preview.
- Mobile menu opens, confines keyboard focus, and closes after navigation.
- Desktop and narrow mobile layouts inspected. The dashboard and order pages fit at 320px without page overflow; settings fits at 390px. Visible text checked at a minimum of 10px. Wide tables deliberately scroll within their panels.

All financial, identity-review, and access-management actions are simulated. No production data or cloud services were used. The app is prepared for Vercel deployment; it has not been published.
