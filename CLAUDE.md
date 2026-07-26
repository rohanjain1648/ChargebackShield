# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ChargebackShield: an automated Stripe dispute-defense system built on Base44's backend. A Stripe
webhook ingests a chargeback the moment it's created, a function assembles the evidence Stripe wants
from the merchant's own order data, the built-in LLM drafts the rebuttal, and a scheduled automation
escalates by email as the deadline approaches — with one required human gate (Approve & Submit)
before anything reaches Stripe. Full narrative, demo script, and pipeline deep-dive are in `README.md`
— read it before making non-trivial changes, it's authoritative.

## Commands

Frontend (Vite/React), run from repo root:
```
npm run dev       # dev server
npm run build     # tsc -b && vite build
npm run preview   # preview production build
```
There is no test suite and no lint script configured.

Backend (Base44 functions/entities) — deployed via the `base44` CLI, not npm:
```
base44 login
base44 link                    # sets base44/.app.jsonc appId
base44 entities push           # push base44/entities/*.json schemas
base44 functions deploy        # deploy base44/functions/*/entry.ts
base44 secrets set KEY value   # STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, MERCHANT_OWNER_EMAIL
```
Backend functions run on Deno (`Deno.serve`, `npm:` specifier imports), not Node — don't add a
Node-style `package.json`/build step for `base44/`. There's no local emulator in this repo; functions
are edited here and deployed via the CLI above.

## Architecture

```
Stripe dispute created ──▶ stripeWebhook (verifies signature)
                                │
                                ▼
                         processNewDispute (shared/dispute.ts)
                                │
                    ┌───────────┼────────────┐
                    ▼           ▼            ▼
              Dispute row  buildEvidencePacket  merchant notified
                             (assemble Order/Customer
                              data, flag gaps)
                                │
                                ▼
                           draftRebuttal
                        (LLM: strategy + evidence
                         statement + confidence)
                                │
                                ▼
                    merchant reviews in the dispute
                    workbench → Approve & Submit
                                │
                                ▼
                          submitEvidence
                     (pushes evidence to Stripe API)

deadlineSweep (scheduled, hourly) ──▶ escalating email reminders as evidence_due_by approaches
scoreRisk (per order) ──▶ pre-dispute risk signals (repeat disputer, no delivery proof, velocity)
simulateDispute ──▶ runs the full pipeline above with a synthetic dispute, for demos/testing
```

**`base44/shared/dispute.ts`** is the core of the app — `REASON_STRATEGIES` (per-Stripe-
reason-code evidence requirements + argument strategy), `buildEvidencePacket`, `draftRebuttal`, and
`processNewDispute` (the ingest→assemble→draft orchestrator) all live here and are imported by
multiple `entry.ts` functions. Changes to dispute logic almost always belong in this file, not in the
individual function entry points.

**Why a review gate instead of full autopilot:** submitting evidence to Stripe is a one-shot,
irreversible action per dispute, so `submitEvidence` is the one place a human must act explicitly.
Everything before it (ingest, assemble, draft) and after it (deadline tracking) is fully automatic.
Don't add a path that calls Stripe's evidence-submit API without going through this function.

**Why single-tenant in v1:** each Base44 app/deployment serves one merchant with one Stripe account.
Every record's `created_by` is that one owner's email, which keeps RLS simple. Service-role callers
that have no authenticated user (`stripeWebhook`, `deadlineSweep`) resolve the owner from the
`MERCHANT_OWNER_EMAIL` secret; authenticated-caller functions (`buildEvidence`, `draftRebuttal`,
`simulateDispute`, `scoreRisk`, `submitEvidence`) use the calling user's own email instead. Never
hardcode one or the other — follow whichever pattern the existing function already uses. Multi-tenant
(v2) would resolve the owning merchant from the Stripe Connect account on the incoming event instead.

### Entities (`base44/entities/*.json`)

7 entity schemas: `Merchant`, `Customer`, `Order`, `Dispute`, `EvidencePacket`, `RiskSignal`,
`ActivityEvent`. All enforce the same RLS shape:
```json
"rls": {
  "create": true,
  "read": { "created_by": "{{user.email}}" },
  "update": { "created_by": "{{user.email}}" },
  "delete": { "created_by": "{{user.email}}" }
}
```
Background writes (webhook, scheduled sweep) go through `asServiceRole` to bypass RLS, explicitly
setting `created_by` to `MERCHANT_OWNER_EMAIL` so records still attribute to the right owner.

### Functions (`base44/functions/*/entry.ts`)

| Function | Trigger | Auth context |
|---|---|---|
| `stripeWebhook` | Stripe webhook (`charge.dispute.created`/`closed`) | none — `asServiceRole` + `MERCHANT_OWNER_EMAIL` |
| `buildEvidence` | called manually / by pipeline | authenticated user |
| `draftRebuttal` | called manually / by pipeline | authenticated user |
| `submitEvidence` | frontend "Approve & Submit" | authenticated user |
| `scoreRisk` | call after order creation | authenticated user |
| `deadlineSweep` | scheduled automation (hourly, configured in Base44 dashboard, not a file here) | none — `asServiceRole` + `MERCHANT_OWNER_EMAIL` |
| `simulateDispute` | frontend "Simulate dispute" button | authenticated user — runs the real pipeline with synthetic data |

### Frontend (`src/`)

Vite + React + TypeScript + `react-router-dom`, using `@base44/sdk`'s `createClient` (`src/api/base44Client.ts`)
configured from `VITE_BASE44_APP_ID` (`.env.local`). Path alias `@/*` → `src/*`. Pages: `DisputeQueue`,
`DisputeDetail` (the workbench — evidence review/edit/approve), `Dashboard` (win rate, $ recovered,
reason-code breakdown, risk signals), `Settings` (merchant profile).

## Known gaps (see README for full detail)

- Scheduled automations (`deadlineSweep`) are wired up by hand in the Base44 dashboard UI, not as a
  file in this repo.
- `asServiceRole` writes with an explicit `created_by` are used but not confirmed against a worked
  Base44 doc example — if an account rejects this, the documented fallback is a dashboard permission
  rule scoped to the single owner instead (see `README.md` "Known gaps").
