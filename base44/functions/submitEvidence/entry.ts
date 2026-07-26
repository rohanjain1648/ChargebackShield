// The human review gate: the merchant clicks "Approve & Submit" in the
// dispute workbench, which calls this function to (a) record approval and
// (b) push the evidence to Stripe. Nothing reaches Stripe without this
// explicit, per-dispute action — see design doc for why full autopilot was
// rejected.
//
// Frontend call:
//   await base44.functions.invoke('submitEvidence', { dispute_id })
//
// Secret required: STRIPE_SECRET_KEY

import Stripe from "npm:stripe@^17";
import { createClientFromRequest } from "npm:@base44/sdk";
import { logActivity } from "../../shared/dispute.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-06-20" });

Deno.serve(async (req) => {
  const { dispute_id } = await req.json();
  if (!dispute_id) return Response.json({ error: "dispute_id is required" }, { status: 400 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  const disputes = await base44.entities.Dispute.filter({ id: dispute_id });
  const dispute = disputes?.[0];
  if (!dispute) return Response.json({ error: "Dispute not found" }, { status: 404 });

  const packets = await base44.entities.EvidencePacket.filter({ dispute_id });
  const packet = packets?.[0];
  if (!packet || !packet.ai_draft_text) {
    return Response.json({ error: "No drafted evidence to submit yet" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await base44.entities.EvidencePacket.update(packet.id, {
    status: "approved",
    approved_by: user.email,
    approved_at: now,
  });
  await logActivity(base44, user.email, dispute.merchant_id, dispute.id, "evidence_approved", `Evidence approved by ${user.email}.`);

  try {
    const fields = packet.assembled_fields ?? {};
    if (dispute.is_simulated) {
      // Simulated disputes have no real Stripe dispute object to update —
      // skip the live API call so the demo pipeline still completes end to end.
    } else {
      await stripe.disputes.update(dispute.stripe_dispute_id, {
        evidence: {
          product_description: fields.product_description || undefined,
          shipping_carrier: fields.shipping_carrier || undefined,
          shipping_tracking_number: fields.shipping_tracking_number || undefined,
          shipping_date: fields.shipping_date || undefined,
          refund_policy_disclosure: fields.refund_policy || undefined,
          uncategorized_text: packet.ai_draft_text,
        },
        submit: true,
      });
    }

    await base44.entities.EvidencePacket.update(packet.id, {
      status: "submitted",
      submitted_at: new Date().toISOString(),
      stripe_submission_status: "submitted",
    });
    await base44.entities.Dispute.update(dispute.id, { status: "under_review" });
    await logActivity(base44, user.email, dispute.merchant_id, dispute.id, "evidence_submitted", "Evidence submitted to Stripe.");

    return Response.json({ status: "submitted" });
  } catch (err) {
    const message = (err as Error).message;
    await base44.entities.EvidencePacket.update(packet.id, {
      status: "submit_failed",
      stripe_submission_status: message,
    });
    await logActivity(
      base44,
      user.email,
      dispute.merchant_id,
      dispute.id,
      "evidence_submitted",
      `Stripe submission failed: ${message}`,
    );
    return Response.json({ error: message }, { status: 502 });
  }
});
