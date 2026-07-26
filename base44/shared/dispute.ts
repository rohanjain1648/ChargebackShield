// Shared helpers imported by every ChargebackShield backend function.
//
// Architecture note (v1 scope): this app is single-merchant-per-deployment —
// each merchant runs their own Base44 app/Stripe account. That keeps RLS simple
// (every record's `created_by` is the one owner email). Multi-tenant (many
// merchants in one app) is a natural v2: resolve the owning merchant from the
// Stripe account/webhook endpoint that fired instead of a single env var.
//
// Every helper below takes an explicit `ownerEmail` rather than reading a
// fixed constant, because it's called from two different contexts that must
// NOT share one hardcoded value:
//   - service-role callers with no authenticated user (stripeWebhook,
//     deadlineSweep) pass MERCHANT_OWNER_EMAIL from the environment.
//   - authenticated-merchant callers (buildEvidence, draftRebuttal,
//     simulateDispute, scoreRisk) pass the calling user's own email, so
//     records stay visible to whoever is actually using the app.

export const MERCHANT_OWNER_EMAIL = Deno.env.get("MERCHANT_OWNER_EMAIL") ?? "";

// Per-reason-code strategy: which Stripe evidence fields matter most and the
// argument that tends to win that reason code. Source: Stripe's own dispute
// evidence guidance per reason type.
export const REASON_STRATEGIES: Record<
  string,
  { requiredEvidence: string[]; strategyHint: string }
> = {
  product_not_received: {
    requiredEvidence: ["shipping_documentation", "shipping_tracking_number", "shipping_date"],
    strategyHint:
      "Prove the product was shipped and delivered to the cardholder's address using carrier tracking. " +
      "If delivered, emphasize delivery confirmation. If in transit, cite the carrier's delivery estimate " +
      "and the merchant's stated shipping policy the customer agreed to.",
  },
  product_unacceptable: {
    requiredEvidence: ["product_description", "refund_policy", "customer_communication"],
    strategyHint:
      "Show the product matched its description at time of sale and that the merchant's refund/return " +
      "policy was available and not invoked by the customer within its window. Reference any support " +
      "conversation where the customer's complaint was addressed.",
  },
  duplicate: {
    requiredEvidence: ["receipt", "customer_communication"],
    strategyHint:
      "Demonstrate the two charges correspond to two distinct orders (different items, dates, or " +
      "shipping addresses), or that only one charge was ever captured.",
  },
  fraudulent: {
    requiredEvidence: ["customer_communication", "shipping_documentation"],
    strategyHint:
      "Show a legitimate, authorized purchase pattern: matching billing/shipping details, prior order " +
      "history from the same customer, and delivery to a consistent address. Avoid speculation about " +
      "the cardholder's intent; stick to verifiable transaction facts.",
  },
  subscription_canceled: {
    requiredEvidence: ["customer_communication", "refund_policy"],
    strategyHint:
      "Show the subscription terms and cancellation policy the customer accepted, and that no " +
      "cancellation request was received before the billing date in question.",
  },
  credit_not_processed: {
    requiredEvidence: ["refund_policy", "customer_communication"],
    strategyHint:
      "Show either that a refund was already issued (with date/amount) or that no refund was owed under " +
      "the stated policy.",
  },
  unrecognized: {
    requiredEvidence: ["customer_communication", "receipt"],
    strategyHint:
      "Help the cardholder recognize the charge: statement descriptor, order date, itemized receipt, and " +
      "shipping details tied to their account.",
  },
  incorrect_account_details: {
    requiredEvidence: ["receipt"],
    strategyHint: "Confirm the account/payment details used matched what the customer provided at checkout.",
  },
  insufficient_funds: {
    requiredEvidence: ["receipt"],
    strategyHint: "Confirm the charge amount matches the agreed order total with no unauthorized modification.",
  },
  bank_cannot_process: {
    requiredEvidence: ["receipt"],
    strategyHint: "Confirm the payment method and amount were valid and processed under normal terms.",
  },
  debit_not_authorized: {
    requiredEvidence: ["customer_communication", "receipt"],
    strategyHint: "Show clear customer authorization for the charge (order confirmation, accepted terms).",
  },
  general: {
    requiredEvidence: ["receipt", "customer_communication"],
    strategyHint: "Provide a complete, factual account of the transaction: what was sold, to whom, and when.",
  },
  customer_initiated: {
    requiredEvidence: ["customer_communication", "refund_policy"],
    strategyHint: "Show the customer's own communication and the policy terms that applied to the request.",
  },
};

export function strategyFor(reason: string) {
  return REASON_STRATEGIES[reason] ?? REASON_STRATEGIES.general;
}

export async function logActivity(
  svc: any,
  ownerEmail: string,
  merchant_id: string,
  dispute_id: string | undefined,
  event_type: string,
  message: string,
  metadata: Record<string, unknown> = {},
) {
  await svc.entities.ActivityEvent.create({
    merchant_id,
    dispute_id,
    event_type,
    message,
    metadata,
    created_by: ownerEmail,
  });
}

/**
 * Assembles a Stripe-ready evidence packet from linked Order/Customer data and
 * flags gaps the strategy needs but no data exists for. Creates the
 * EvidencePacket if one doesn't exist yet, otherwise recomputes it in place
 * (safe to call again after a merchant uploads a missing delivery proof, etc).
 */
export async function buildEvidencePacket(
  svc: any,
  ownerEmail: string,
  dispute: any,
  order: any | null,
  customer: any | null,
) {
  const strategy = strategyFor(dispute.reason);

  const assembled_fields: Record<string, string> = {};
  if (order) {
    assembled_fields.product_description = order.product_description ?? "";
    assembled_fields.shipping_carrier = order.shipping_carrier ?? "";
    assembled_fields.shipping_tracking_number = order.tracking_number ?? "";
    assembled_fields.shipping_date = order.order_date ?? "";
    assembled_fields.shipping_documentation = order.delivery_proof_url ?? "";
    assembled_fields.refund_policy = order.refund_policy_text ?? "";
    assembled_fields.receipt = `Order ${order.id}: ${order.product_description ?? "item"} — ${order.amount} ${order.currency}, placed ${order.order_date}`;
    const log = (order.customer_communication_log ?? [])
      .map((entry: any) => `[${entry.date}] (${entry.channel}) ${entry.summary}`)
      .join("\n");
    assembled_fields.customer_communication = log;
  }

  const missing_fields = strategy.requiredEvidence.filter((field) => !assembled_fields[field]?.trim());

  let packet = await findEvidencePacket(svc, dispute.id);
  const payload = {
    merchant_id: dispute.merchant_id,
    dispute_id: dispute.id,
    assembled_fields,
    missing_fields,
    status: "assembling",
    created_by: ownerEmail,
  };

  if (packet) {
    packet = await svc.entities.EvidencePacket.update(packet.id, payload);
  } else {
    packet = await svc.entities.EvidencePacket.create(payload);
  }

  await logActivity(
    svc,
    ownerEmail,
    dispute.merchant_id,
    dispute.id,
    "evidence_assembled",
    missing_fields.length > 0
      ? `Evidence assembled with ${missing_fields.length} gap(s): ${missing_fields.join(", ")}`
      : "Evidence assembled — no gaps detected.",
  );

  return packet;
}

export async function findEvidencePacket(svc: any, dispute_id: string) {
  const results = await svc.entities.EvidencePacket.filter({ dispute_id });
  return results?.[0] ?? null;
}

/**
 * Calls the built-in LLM to pick a rebuttal strategy and draft the evidence
 * statement Stripe submits to the card network, using the reason-code
 * strategy hint plus whatever evidence was assembled.
 */
export async function draftRebuttal(svc: any, ownerEmail: string, dispute: any, packet: any) {
  const strategy = strategyFor(dispute.reason);

  const prompt = `You are drafting a Stripe dispute evidence statement for a merchant fighting a chargeback.

Dispute reason code: ${dispute.reason}
Amount: ${dispute.amount} ${dispute.currency}
Strategic guidance for this reason code: ${strategy.strategyHint}

Evidence available:
${Object.entries(packet.assembled_fields ?? {})
  .filter(([, v]) => String(v ?? "").trim().length > 0)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n") || "(none)"}

Evidence gaps (requested but not found): ${packet.missing_fields?.join(", ") || "none"}

Write:
1. A one-paragraph internal strategy summary for the merchant explaining the angle you're taking and why, including how any evidence gaps affect the odds.
2. The actual evidence statement text to submit to Stripe (factual, concise, no speculation, written in the merchant's voice, referencing only the evidence provided above).
3. A confidence score from 0 to 1 for winning this dispute given the evidence on hand.`;

  const response = await svc.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        strategy_summary: { type: "string" },
        evidence_statement: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["strategy_summary", "evidence_statement", "confidence"],
    },
  });

  const updated = await svc.entities.EvidencePacket.update(packet.id, {
    ai_strategy_summary: response.strategy_summary,
    ai_draft_text: response.evidence_statement,
    ai_confidence: Math.max(0, Math.min(1, response.confidence)),
    status: "drafted",
  });

  await logActivity(
    svc,
    ownerEmail,
    dispute.merchant_id,
    dispute.id,
    "draft_generated",
    `AI draft ready (confidence ${(response.confidence * 100).toFixed(0)}%).`,
  );

  await svc.entities.Dispute.update(dispute.id, { status: "evidence_drafted" });

  return updated;
}

/** Runs the full ingest -> assemble -> draft pipeline for one incoming dispute. */
export async function processNewDispute(
  svc: any,
  ownerEmail: string,
  params: {
    stripe_dispute_id: string;
    stripe_charge_id: string;
    reason: string;
    amount: number;
    currency: string;
    evidence_due_by: string;
    stripe_created_at: string;
    network_reason_code?: string;
    is_refundable?: boolean;
    is_simulated?: boolean;
  },
) {
  const orders = await svc.entities.Order.filter({ stripe_charge_id: params.stripe_charge_id });
  const order = orders?.[0] ?? null;
  const merchant_id = order?.merchant_id ?? "unknown";
  const customer_id = order?.customer_id ?? "";

  const dispute = await svc.entities.Dispute.create({
    merchant_id,
    order_id: order?.id ?? "",
    customer_id,
    stripe_dispute_id: params.stripe_dispute_id,
    reason: params.reason,
    amount: params.amount,
    currency: params.currency,
    status: "needs_response",
    evidence_due_by: params.evidence_due_by,
    stripe_created_at: params.stripe_created_at,
    network_reason_code: params.network_reason_code ?? "",
    is_refundable: params.is_refundable ?? false,
    outcome: "pending",
    is_simulated: params.is_simulated ?? false,
    created_by: ownerEmail,
  });

  await logActivity(
    svc,
    ownerEmail,
    merchant_id,
    dispute.id,
    "dispute_ingested",
    `New dispute ${dispute.stripe_dispute_id} (${params.reason}) for ${params.amount} ${params.currency}. ` +
      `Evidence due ${params.evidence_due_by}.`,
  );

  let customer = null;
  if (customer_id) {
    const customers = await svc.entities.Customer.filter({ id: customer_id });
    customer = customers?.[0] ?? null;
    if (customer) {
      await svc.entities.Customer.update(customer.id, {
        total_disputes: (customer.total_disputes ?? 0) + 1,
      });
    }
  }

  const packet = await buildEvidencePacket(svc, ownerEmail, dispute, order, customer);
  await draftRebuttal(svc, ownerEmail, dispute, packet);

  const merchants = await svc.entities.Merchant.filter({ id: merchant_id });
  const merchant = merchants?.[0];
  if (merchant?.notification_email) {
    await svc.integrations.Core.SendEmail({
      to: merchant.notification_email,
      subject: `New dispute: ${params.amount} ${params.currency} (${params.reason})`,
      body:
        `A new dispute just came in and ChargebackShield has already assembled evidence and drafted a ` +
        `rebuttal for your review.\n\nReason: ${params.reason}\nAmount: ${params.amount} ${params.currency}\n` +
        `Evidence due by: ${params.evidence_due_by}\n\nOpen the dispute in your dashboard to review and approve.`,
      from_name: "ChargebackShield",
    });
  }

  return dispute;
}
