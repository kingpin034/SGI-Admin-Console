# Sampoerna Gold · Admin Console

A separate, desktop-first administrative frontend by Newtn Technology. It adapts to tablet and mobile screens and uses the same red, gold, black, and white visual style as the Referral and Stockpoint apps. The minimum text size is 10px.

## Run

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4178/ in a browser. Do not open index.html directly.

```sh
npm test
npm run build
npm run preview
```

## Pages and interactions

- **Ringkasan:** computed GMV, active resellers, GMV per reseller, 90-day retention, buyback ratio, penetration, location/period filters, and operational priorities.
- **Anggota & mitra:** search, tier/verification filters, pagination, member details, synthetic KYC review, and status changes with an audit note.
- **Transaksi:** searchable orders, payment/status/location filters, serialized gold details, and the commission ledger for each order.
- **Komisi & payout:** accrued balances, gram equivalents below Rp300,000, historical commission ledger, eligible batch creation, masked demo CSV export, and simulated payout. Eligibility is rechecked before marking a batch paid.
- **Stockpoint:** location status, stock by weight and serial, pickup orders, reconciliation timestamps, and pause/reactivate with a reason.
- **Kendala operasional:** filter findings, assign JV Ops or SGI Finance, review, and resolve with a required explanation.
- **Riwayat audit:** append-only activity history within the demo session, filters, details, and CSV export.
- **Pengaturan:** single/multi-level policy preview, commission rate reference, staff roles, assignments, and simulated access status. The current admin account is protected from being disabled.

## Frontend-only behavior

There is no backend, database, Supabase, API integration, environment-variable setup, or real authentication. State lives in browser memory and resets on reload or through the demo reset action. The three SGI apps have separate sample datasets and do not synchronize.

Names, account numbers, documents, and transactions are synthetic. Staff role changes simulate administration; they do not enforce real access control. Payout actions do not transfer money. CSV files contain masked sample accounts and are not bank instruction files.

The default policy is single level (own purchases + downline 1). Historical demo entries may include older three-level commission entries. Switching policy changes the saved demo setting and rate preview; it does not recalculate existing commission entries. This Admin Console does not create new sales. Balances under the payout threshold remain accrued and display their gram equivalent at the sample buyback price.

## Metrics

The definitions dialog in Ringkasan explains each metric. GMV includes ready/done orders, excluding pending/cancelled. Active resellers must be active, verified, qualified, and have paid orders in the selected period. Retention uses a fixed 90-day window and an established-member cohort. Buyback ratio compares currency values. Penetration compares period-active resellers to the selected locations' member targets. All values are computed from the same demo dataset.

## Deploy

See [Vercel setup](docs/DEPLOYMENT.md). This folder is an independent Vercel project with static SPA route handling. No secrets or provider accounts are needed. Deployment has been prepared, not published.

## Stack and palette

React, TypeScript, Vite, Lucide icons, and Vitest. Primary red `#B72731`, secondary gold `#C3A753`, black `#1C1C1C`, white `#FFFFFF`. Fonts: DM Sans and Manrope, with local system fallbacks.
