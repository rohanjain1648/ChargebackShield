# ChargebackShield

An automated Stripe dispute-defense system built entirely on Base44's backend: a webhook ingests
a chargeback the moment it's created, a function assembles the evidence Stripe wants from your own
order data, the built-in LLM drafts the rebuttal, and a scheduled automation escalates by email as
the deadline approaches — with one required human gate (Approve & Submit) before anything reaches
Stripe.

## The problem

When a customer disputes a card charge, Stripe starts a countdown — the merchant has a fixed window
(often 7–21 days) to submit evidence or automatically lose the dispute. Small merchants lose here for
avoidable reasons: they don't notice the dispute in time, don't know what evidence each reason code
needs, write a weak rebuttal, or simply miss the deadline. Non-response is an automatic loss.
ChargebackShield closes that gap with backend automation, not a better inbox.

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

**Why a review gate instead of full autopilot:** submitting evidence is a one-shot, irreversible
action per dispute. Auto-submitting AI-drafted text with no human check is also a much weaker demo —
a live audience can't see the automation work if it all happens invisibly. The gate is the one place
a human is required; everything before it (ingest, assemble, draft) and after it (deadline tracking)
is fully automatic.

**Why single-tenant in v1:** this app is designed for one merchant per Base44 deployment/Stripe
account. That keeps row-level security simple (every record's `created_by` is the one owner) and
lets the Stripe webhook — which arrives with no authenticated Base44 user — resolve "whose data is
this" from a `MERCHANT_OWNER_EMAIL` secret instead of a multi-tenant lookup. See the comment block at
the top of `base44/shared/dispute.ts`. Multi-tenant is a natural v2: resolve the owning
merchant from the Stripe Connect account on the incoming event instead.

## What's in this repo

| Path | What it is |
|---|---|
| `base44/entities/` | 7 entity schemas: Merchant, Customer, Order, Dispute, EvidencePacket, RiskSignal, ActivityEvent |
| `base44/functions/stripeWebhook/` | Ingests `charge.dispute.created` / `charge.dispute.closed` from Stripe |
| `base44/functions/buildEvidence/` | Assembles/recomputes an evidence packet for a dispute |
| `base44/functions/draftRebuttal/` | Calls the built-in LLM to draft the strategy + evidence statement |
| `base44/functions/submitEvidence/` | The approval gate; pushes evidence to Stripe's API |
| `base44/functions/scoreRisk/` | Pre-dispute risk scoring for a given order |
| `base44/functions/deadlineSweep/` | Scheduled job: escalating deadline reminder emails |
| `base44/functions/simulateDispute/` | Fires a synthetic dispute through the real pipeline, for demos |
| `base44/shared/dispute.ts` | Shared pipeline logic + per-reason-code evidence strategy |
| `src/` | React (Vite) frontend: dispute queue, dispute workbench, dashboard, settings |

## Setup

1. **Install the CLI and log in**
   ```
   npm install -g base44@latest
   base44 login
   ```
2. **Link this repo to a Base44 app** (creates `base44/.app.jsonc`'s `appId`)
   ```
   base44 link
   ```
3. **Push entities and deploy functions**
   ```
   ch
   ```
4. **Set secrets** (Dashboard → your app → Secrets, or via CLI)
   ```
   base44 secrets set STRIPE_SECRET_KEY sk_test_...
   base44 secrets set STRIPE_WEBHOOK_SECRET whsec_...
   base44 secrets set MERCHANT_OWNER_EMAIL you@yourstore.com
   ```
   `MERCHANT_OWNER_EMAIL` must match the email of the Base44 user account you'll log in with —
   it's how the webhook and the scheduled sweep (which have no logged-in user) attribute records to
   the right owner.
5. **Wire the Stripe webhook.** In the Stripe Dashboard → Developers → Webhooks, add an endpoint
   pointed at your deployed `stripeWebhook` function URL (`base44 functions list` shows it), subscribed
   to `charge.dispute.created` and `charge.dispute.closed`.
6. **Wire the scheduled deadline sweep.** In the Base44 dashboard, open Automations and create a
   scheduled automation (e.g. hourly) that invokes the `deadlineSweep` function. This is configured in
   the dashboard rather than as a file in this repo — see "Known gaps" below.
7. **Frontend:**
   ```
   npm install
   cp .env.local.example .env.local   # fill in VITE_BASE44_APP_ID
   npm run dev
   ```
8. Log in as `MERCHANT_OWNER_EMAIL`, open **Settings** once to create your Merchant profile, then
   go to the dispute queue.

## Technical Stack & Architecture

ChargebackShield is a modern, decoupled web application composed of a powerful backend pipeline and a high-end interactive frontend.

### Frontend (Vite + React + Framer Motion)
- **Framework:** Built with React and bundled via Vite for rapid development and HMR.
- **Routing:** Client-side routing managed by `react-router-dom`, featuring nested layouts for the dashboard application.
- **UI/UX & Aesthetics:** The user interface leans heavily into modern design paradigms. It features a custom glassmorphism design system, leveraging `backdrop-filter` for translucent layers.
- **Animations:** Page transitions, staggered list reveals, and hover micro-animations are entirely powered by `framer-motion`, creating a fluid, tactile experience.
- **Icons:** Consistent, premium iconography provided by `lucide-react`.

### Backend (Base44)
- **Serverless Functions:** Orchestrates the core pipeline (ingest, assembly, LLM drafting, submission) via isolated, deployable Base44 functions.
- **Database:** Fully managed Entity schemas (`Merchant`, `Dispute`, `Order`, `EvidencePacket`) backed by Base44's data layer.
- **Security:** Strict Row-Level Security (RLS) ensures that all data is bound to the authenticated merchant.
- **Integrations:** Direct API touchpoints with Stripe for webhooks and evidence submission, and native LLM integration (`InvokeLLM`) for automated defense generation.

## Extending beyond v1

- **Multi-tenant:** swap the `MERCHANT_OWNER_EMAIL` lookups for a merchant resolved from the Stripe
  Connect account on the incoming webhook event.
- **File evidence:** `submitEvidence` currently sends text-based Stripe evidence fields
  (`uncategorized_text`, `shipping_tracking_number`, etc.). Delivery proof PDFs/screenshots can be
  uploaded via the `UploadFile` integration and attached as Stripe evidence file IDs.
- **Storefront integration:** call `scoreRisk` automatically right after order creation (from your
  storefront's checkout webhook) instead of manually, so every order gets scored before it can dispute.

## Deep Dive: How the Pipeline Works

ChargebackShield is composed of several orchestrated Base44 functions and automated processes. Here is a closer look at each phase of the pipeline.

### 1. Webhook Ingestion (`stripeWebhook`)
When a dispute is opened or updated in Stripe, the webhook triggers this function. It verifies the Stripe signature to ensure authenticity. The function then parses the `charge.dispute.created` event, creates or updates a `Dispute` record in the database, and kicks off the evidence assembly process. Records are attributed using `MERCHANT_OWNER_EMAIL`.

### 2. Evidence Assembly (`buildEvidence`)
Different dispute reason codes require different types of evidence (e.g., "Product Not Received" requires tracking and delivery proof; "Fraudulent" requires AVS matches and customer history). This function:
- Resolves the related `Order` and `Customer` from the database using the Stripe charge ID.
- Determines the necessary evidence fields based on the dispute's `network_reason_code`.
- Maps order data (like `shipping_carrier`, `tracking_number`, `refund_policy_text`) to the required Stripe fields.
- Creates an `EvidencePacket` record and flags any `missing_fields` that the merchant might need to provide manually.

### 3. LLM Rebuttal Drafting (`draftRebuttal`)
Once evidence is assembled, Base44's built-in `InvokeLLM` is called to craft a persuasive rebuttal statement.
- **Input:** Dispute reason, mapped evidence, missing evidence gaps, and customer communication logs.
- **Output:** An `ai_strategy_summary` outlining the defense plan, and the `ai_draft_text` containing the professional, structured evidence statement formatted for Stripe's human reviewers.
- **Confidence:** An `ai_confidence` score helps merchants prioritize manual review for edge cases versus auto-approving highly confident defenses.

### 4. Merchant Approval & Submission (`submitEvidence`)
The only human-in-the-loop requirement. The merchant views the generated `EvidencePacket` via the React frontend. They can edit the AI's draft or provide missing fields. Upon clicking **Approve & Submit**, this function pushes the final evidence directly to the Stripe API and updates the dispute status.

### 5. Automated Deadline Management (`deadlineSweep`)
A scheduled Base44 automation that polls for open disputes nearing their `evidence_due_by` date. It uses the `SendEmail` integration to trigger escalating reminders to the merchant, ensuring no dispute is lost by default.

### 6. Pre-dispute Risk Scoring (`scoreRisk`)
Proactive defense. This function evaluates new orders for risk signals—like velocity, past disputes, or lack of delivery proof—generating `RiskSignal` records. This allows merchants to catch high-risk transactions before they turn into chargebacks.

## Entity Models & Data Structure

The application's state is modeled across 7 core entities governed by Row-Level Security (RLS) to ensure data isolation.

*   **Merchant:** The tenant configuration, linked to `MERCHANT_OWNER_EMAIL`.
*   **Customer:** End-buyer profiles containing history and communication logs.
*   **Order:** The transactional context linking Stripe charges to shipping and product data.
*   **Dispute:** Tracks the lifecycle of the chargeback, status, deadlines, and eventual outcome.
*   **EvidencePacket:** The core payload holding assembled evidence fields, missing field flags, AI strategy summaries, and the drafted rebuttal text.
*   **RiskSignal:** Pre-emptive flags generated by the `scoreRisk` function for specific orders.
*   **ActivityEvent:** An audit log of all automated and manual actions taken on a dispute.

## Security & Row-Level Security (RLS)

All database entities enforce strict Row-Level Security:
```json
"rls": {
  "create": true,
  "read": { "created_by": "{{user.email}}" },
  "update": { "created_by": "{{user.email}}" },
  "delete": { "created_by": "{{user.email}}" }
}
```
This guarantees that even in a multi-tenant v2 architecture, merchants only ever have access to their own data, customers, and disputes. Background processes like the webhook and scheduled sweeps use `asServiceRole` to bypass RLS for systemic writes, explicitly setting the `created_by` field to attribute records correctly.

## Frontend Walkthrough (`src/`)

The Vite/React frontend provides the dashboard and operational workbench:
- **Dispute Queue:** A kanban or list view of all active disputes, prioritized by deadline. Includes real-time status badges (e.g., `needs_response`, `evidence_drafted`).
- **Dispute Workbench:** The detailed view for a single dispute. It displays the AI-assembled evidence alongside missing field warnings. The main panel allows the merchant to review the `ai_draft_text`, edit it, and finally submit it.
- **Dashboard:** High-level analytics showing win rates, recovered revenue, and a breakdown of dispute reason codes.
- **Settings:** Configuration for the merchant profile and integration health checks.
