// Runs the deadline clock: sweeps open disputes and sends escalating email
// reminders as the Stripe evidence deadline approaches. Missing this deadline
// is an automatic, unappealable loss, so this is the single highest-value
// automation in the app.
//
// Wire this up in the Base44 dashboard (Automations) as a scheduled trigger
// pointed at this function — e.g. every hour. No request body is required;
// it has no authenticated caller (scheduled triggers run with no user
// context), so it uses asServiceRole + MERCHANT_OWNER_EMAIL like the Stripe
// webhook — see shared/dispute.ts for why v1 is single-tenant.

import { createClientFromRequest } from "npm:@base44/sdk";
import { logActivity, MERCHANT_OWNER_EMAIL } from "../../shared/dispute.ts";

// Hours-remaining thresholds that each trigger exactly one reminder email,
// most urgent first. reminders_sent_count tracks how many of these have fired.
const REMINDER_THRESHOLDS_HOURS = [72, 24, 4];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;

  const openDisputes = await svc.entities.Dispute.filter({ status: "needs_response" });
  const drafted = await svc.entities.Dispute.filter({ status: "evidence_drafted" });
  const disputes = [...(openDisputes ?? []), ...(drafted ?? [])];

  const now = Date.now();
  let remindersSent = 0;

  for (const dispute of disputes) {
    const dueAt = new Date(dispute.evidence_due_by).getTime();
    const hoursRemaining = (dueAt - now) / (1000 * 60 * 60);
    if (hoursRemaining <= 0) continue;

    const sentCount = dispute.reminders_sent_count ?? 0;
    const nextThresholdIndex = sentCount;
    const nextThreshold = REMINDER_THRESHOLDS_HOURS[nextThresholdIndex];
    if (nextThreshold === undefined || hoursRemaining > nextThreshold) continue;

    const merchants = await svc.entities.Merchant.filter({ id: dispute.merchant_id });
    const merchant = merchants?.[0];

    if (merchant?.notification_email) {
      await svc.integrations.Core.SendEmail({
        to: merchant.notification_email,
        subject: `Action needed: dispute evidence due in ~${Math.round(hoursRemaining)}h`,
        body:
          `Dispute ${dispute.stripe_dispute_id} (${dispute.reason}, ${dispute.amount} ${dispute.currency}) ` +
          `has its Stripe evidence deadline in about ${Math.round(hoursRemaining)} hours.\n\n` +
          `${dispute.status === "evidence_drafted" ? "A draft is ready for your review — open the dashboard to approve and submit." : "No evidence has been assembled yet — open the dashboard to check on it."}`,
        from_name: "ChargebackShield",
      });
    }

    await svc.entities.Dispute.update(dispute.id, {
      last_reminder_sent_at: new Date().toISOString(),
      reminders_sent_count: sentCount + 1,
    });

    await logActivity(
      svc,
      MERCHANT_OWNER_EMAIL,
      dispute.merchant_id,
      dispute.id,
      "reminder_sent",
      `Deadline reminder sent (~${Math.round(hoursRemaining)}h remaining).`,
    );

    remindersSent += 1;
  }

  return Response.json({ checked: disputes.length, reminders_sent: remindersSent, owner: MERCHANT_OWNER_EMAIL });
});
