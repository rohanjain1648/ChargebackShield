// Receives Stripe webhook events directly (Stripe posts here over plain HTTPS —
// there is no authenticated Base44 user on this request, so all data access
// goes through `asServiceRole`). Configure this function's deployed URL as a
// webhook endpoint in the Stripe Dashboard, subscribed to at least:
//   charge.dispute.created, charge.dispute.updated, charge.dispute.closed
//
// Secrets required (set via `base44 secrets set`):
//   STRIPE_WEBHOOK_SECRET  - the endpoint's signing secret (whsec_...)
//   MERCHANT_OWNER_EMAIL   - the merchant account's Base44 login email (see
//                            _shared/dispute.ts for why v1 is single-tenant)

import Stripe from "npm:stripe@^17";
import { createClientFromRequest } from "npm:@base44/sdk";
import { processNewDispute, logActivity, MERCHANT_OWNER_EMAIL } from "../_shared/dispute.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-06-20" });
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature") ?? "";
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return Response.json({ error: `Invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  try {
    switch (event.type) {
      case "charge.dispute.created": {
        const d = event.data.object as Stripe.Dispute;
        await processNewDispute(svc, MERCHANT_OWNER_EMAIL, {
          stripe_dispute_id: d.id,
          stripe_charge_id: typeof d.charge === "string" ? d.charge : d.charge.id,
          reason: d.reason,
          amount: d.amount / 100,
          currency: d.currency,
          evidence_due_by: new Date((d.evidence_details?.due_by ?? 0) * 1000).toISOString(),
          stripe_created_at: new Date(d.created * 1000).toISOString(),
          network_reason_code: d.network_reason_code ?? "",
          is_refundable: d.is_charge_refundable,
        });
        break;
      }

      case "charge.dispute.closed": {
        const d = event.data.object as Stripe.Dispute;
        const disputes = await svc.entities.Dispute.filter({ stripe_dispute_id: d.id });
        const dispute = disputes?.[0];
        if (dispute) {
          const outcome = d.status === "won" ? "won" : d.status === "lost" ? "lost" : "pending";
          await svc.entities.Dispute.update(dispute.id, { status: d.status, outcome });
          await logActivity(
            svc,
            MERCHANT_OWNER_EMAIL,
            dispute.merchant_id,
            dispute.id,
            "outcome_recorded",
            `Dispute ${d.id} closed with outcome: ${outcome}.`,
          );
        }
        break;
      }

      default:
        // Ignore other event types we don't act on yet.
        break;
    }
  } catch (err) {
    console.error("stripeWebhook processing error", err);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }

  return Response.json({ received: true });
});
