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

## Backlog (P1/P2)
- P1: Multi-user activity log (audit trail)
- P1: SMS invoice send (Twilio)
- P2: Weekly/monthly PDF reports
- P2: Barcode-based snack add
- P2: Charts on dashboard for revenue trends
