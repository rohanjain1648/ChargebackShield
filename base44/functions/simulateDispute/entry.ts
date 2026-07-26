// Demo/test generator: fires a realistic dispute through the exact same
// ingest -> assemble -> draft pipeline the real Stripe webhook uses, without
// needing a live Stripe dispute. This exists so a live demo never depends on
// a real chargeback arriving on stage — click "Simulate dispute" and watch
// the whole pipeline run in front of the audience.
//
// If no order_id is given, it fabricates a demo Customer + Order first so the
// app is fully demoable from an empty database.
//
// Frontend call:
//   await base44.functions.invoke('simulateDispute', { reason: 'product_not_received' })

import { createClientFromRequest } from "npm:@base44/sdk";
import { processNewDispute, REASON_STRATEGIES } from "../../shared/dispute.ts";

const REASONS = Object.keys(REASON_STRATEGIES);
const DEMO_PRODUCTS = [
  "Wireless noise-cancelling headphones",
  "Stainless steel french press",
  "Organic cotton bath towel set",
  "Bluetooth mechanical keyboard",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  const merchants = await base44.entities.Merchant.filter({ created_by: user.email });
  let merchant = merchants?.[0];
  if (!merchant) {
    merchant = await base44.entities.Merchant.create({
      business_name: "Demo Store",
      notification_email: user.email,
    });
  }

  let order_id = body.order_id;
  let stripe_charge_id = body.stripe_charge_id;

  if (!order_id) {
    const customer = await base44.entities.Customer.create({
      merchant_id: merchant.id,
      name: "Jordan Rivera",
      email: "jordan.rivera@example.com",
      total_orders: 1,
      total_disputes: 0,
    });

    stripe_charge_id = `ch_sim_${crypto.randomUUID().slice(0, 12)}`;
    const order = await base44.entities.Order.create({
      merchant_id: merchant.id,
      customer_id: customer.id,
      stripe_payment_intent_id: `pi_sim_${crypto.randomUUID().slice(0, 12)}`,
      stripe_charge_id,
      amount: Math.round((Math.random() * 180 + 20) * 100) / 100,
      currency: "usd",
      product_description: randomFrom(DEMO_PRODUCTS),
      order_date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      shipping_name: "Jordan Rivera",
      shipping_address: "482 Maple Ave, Austin, TX 78701",
      shipping_carrier: "UPS",
      tracking_number: `1Z${Math.floor(Math.random() * 1e11)}`,
      delivery_status: "delivered",
      refund_policy_text: "Returns accepted within 30 days of delivery with original receipt.",
      customer_communication_log: [
        {
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          channel: "email",
          summary: "Customer asked about order status; confirmed delivered per tracking.",
        },
      ],
    });
    order_id = order.id;
  }

  const orders = await base44.entities.Order.filter({ id: order_id });
  const order = orders[0];

  const reason = body.reason && REASONS.includes(body.reason) ? body.reason : randomFrom(REASONS);
  const dueInHours = body.due_in_hours ?? 168; // Stripe's typical ~7-day window, adjustable for demo pacing

  const dispute = await processNewDispute(base44, user.email, {
    stripe_dispute_id: `dp_sim_${crypto.randomUUID().slice(0, 12)}`,
    stripe_charge_id: order.stripe_charge_id,
    reason,
    amount: order.amount,
    currency: order.currency,
    evidence_due_by: new Date(Date.now() + dueInHours * 60 * 60 * 1000).toISOString(),
    stripe_created_at: new Date().toISOString(),
    network_reason_code: "",
    is_refundable: true,
    is_simulated: true,
  });

  return Response.json({ dispute });
});
