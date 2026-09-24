# South Point Snooker Academy - Billing & Management System

## Overview
Full-stack snooker parlour POS/billing system for South Point Snooker Academy. Built with React + FastAPI + MongoDB. Responsive for laptop, tablet, and mobile browser (cashier workflow).

## Original Problem Statement
Complete billing/management website for a snooker parlour with: dashboard/live tables, open/close table billing, snacks/inventory, players, memberships, credit history, switch table, pause/resume, split payment, admin & reports, role-based login.

## User Choices
- Tech Stack: React + FastAPI + MongoDB
- Default credentials: admin/admin123, cashier/cashier123
- Business name: South Point Snooker Academy
- Currency: ₹
- Table 1 rate: ₹220/hr, Tables 2–4 rate: ₹320/hr
- Sample snacks: Tea ₹15, Coffee ₹15, Chips ₹20, Juice ₹25
- Memberships: Regular (10%), Premium (20%)
- Theme: Dark/Green snooker felt
- No external integrations (in-browser print for invoices)

## Personas
- **Admin**: Full access. Manages users, tables, rates, inventory, memberships, settings, reports.
- **Cashier**: Opens/closes tables, adds snacks, generates bills, receives credit payments. Cannot edit rates, prices, or admin settings.

## Modules Implemented (Phase 1)
- [x] JWT auth with role-based access (admin, cashier)
- [x] Table CRUD & live dashboard with per-minute running billing
- [x] Open table (player details, membership auto-detect)
- [x] Pause/Resume with paused-duration tracking
- [x] Switch table (preserves prior entries + snacks)
- [x] Snacks add/remove with live stock deduction and low-stock warnings
- [x] Close table with manual discount, membership discount, split payment
- [x] Invoice generation with print view (browser print)
- [x] Player CRUD, history, credit balance
- [x] Membership plans CRUD
- [x] Inventory CRUD with low-stock section
- [x] Credit history with add-credit-payment flow
- [x] Reports (date range, filters, totals, CSV export)
- [x] Admin settings (business info, currency, invoice footer, tax)
- [x] Data backup/restore/clear
- [x] Responsive mobile-first layout

## Phase 2 (Feb 2026)
- [x] Multi-player sessions with per-player ratios
- [x] Per-snack assignment to a player or Shared (auto-prorated by ratio)
- [x] Per-player bill breakdown in Close modal and Invoice (share%, table share, snacks share, subtotal)
- [x] Audit log (login, session open/pause/resume/switch/close, credit payment) with admin-only viewer under Admin > Audit Log

## Phase 3 (Jun 2026)
- [x] Walk-in snacks (no table), mid-session prorated joining, single-payer table override (`table_payer_id`)
- [x] Close & New Frame with `pay_full` auto top-up
- [x] Reports export: CSV, Excel (.xlsx, 6 sheets), Print (print CSS) — verified iteration_7
- [x] Data Backup/Restore admin-gated, lossless round-trip — verified iteration_7
- [x] Add Player modal (running frame): "New Player" tab creates a brand-new player (name/mobile, optional save to players list) and joins them mid-session (Jun 2026, self-tested)
- [x] Rounding-drift fix: unlinked sessions absorb ≤₹1 drift into first payment instead of 400 — verified iteration_7

## Phase 4 (Jun 2026) — Multi-club + Payments
- [x] Multi-tenant: `/register` creates an isolated club (owner admin + seeded tables/memberships/inventory/settings); every collection scoped by `club_id` via `_ScopedCollection` + ContextVar; legacy data migrated to club `default`; header shows club name
- [x] Payments page (/payments): unpaid bills, player-wise totals (incl. unlinked/walk-in), all closed bills, invoice details, collect payment (partial/full) that also clears linked player's credit
- [x] Unpaid bills allowed for unlinked sessions & walk-in sales (no more 400)
- [x] Billing: per-player table split = ratio of TOTAL table bill (join time ignored); "Split Equal" removed; minute-wise billing (completed minutes)
- [x] Due reminders: amber pulsing badge on Payments nav with unpaid-bill count (auto-refreshes every 30s / on navigation), tooltip shows total due
- [x] Reverted to seconds-wise table billing (user request); Close & Bill modal simplified: single-column summary, auto-filled payment, "Add another method", collapsible "Who pays what" for multi-player (Jun 2026, self-tested)
- [x] Forgot password: (a) email reset link via Emergent-managed email (1-hour single-use token, `/reset-password?token=`), (b) username + club's registered mobile → set new password directly; 5-attempt/15-min throttle; optional Email field on Register & Admin > Users; default admin email = sree200348@gmail.com, default club mobile 9000000001
- [x] Close & Bill: "Pay now / Credit" toggle (full bill on credit); unlinked sessions get a "Save <name> to Players" checkbox so credit lands on a player account. Open Table: per-player "Save to Players tab" checkbox (default on) creates player records for walk-in names (Jun 2026, self-tested)
- [x] Membership discount is per player: only a member's own share (table + optionally snacks) is discounted; if a non-member pays the whole table, no discount (Jun 2026, tested via backend/tests/test_membership_per_player.py)
- [x] Close & Bill discount field: % / ₹ toggle (default %), converted to amount client-side; shows computed ₹ off (Jun 2026, self-tested)
- Verified: iteration_8 (16/16 backend, frontend 100%)

## Backlog (P1/P2)
- P2: Invoice save-as-PDF option
- P2: Low-stock alerts/badge on dashboard
- Tech debt: move JWT to httpOnly cookie; whitelist collections + validate payload in /api/data/restore
- P1: SMS invoice send (Twilio) with per-player split forwarding
- P1: Happy Hour auto-rules (time-based table rate discounts)
- P2: Weekly/monthly PDF reports
- P2: Charts on dashboard for revenue trends
- P2: Barcode-based snack add
