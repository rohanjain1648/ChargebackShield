// Pre-dispute prevention: scores an order for chargeback risk so a merchant
// can act (require signature on delivery, hold a shipment, contact the
// customer) before a dispute ever happens. Call this right after creating an
// Order — e.g. from your storefront's order-creation flow.
//
// Frontend/integration call:
//   await base44.functions.invoke('scoreRisk', { order_id })

import { createClientFromRequest } from "npm:@base44/sdk";
import { logActivity } from "../_shared/dispute.ts";

const HIGH_VALUE_THRESHOLD = 200;
const VELOCITY_WINDOW_HOURS = 24;
const VELOCITY_ORDER_COUNT = 3;

Deno.serve(async (req) => {
  const { order_id } = await req.json();
  if (!order_id) return Response.json({ error: "order_id is required" }, { status: 400 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  const orders = await base44.entities.Order.filter({ id: order_id });
  const order = orders?.[0];
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const customers = order.customer_id ? await base44.entities.Customer.filter({ id: order.customer_id }) : [];
  const customer = customers?.[0] ?? null;

  const signals: Array<{ signal_type: string; score: number; details: string }> = [];

  if (customer && customer.total_orders > 0 && customer.total_disputes > 0) {
    const disputeRate = customer.total_disputes / customer.total_orders;
    if (disputeRate > 0.2) {
      signals.push({
        signal_type: "repeat_disputer",
        score: Math.min(100, Math.round(disputeRate * 100 + 20)),
        details: `Customer has disputed ${customer.total_disputes} of ${customer.total_orders} past orders (${Math.round(disputeRate * 100)}%).`,
      });
    }
  }

  if (order.amount > HIGH_VALUE_THRESHOLD && !order.delivery_proof_url && order.delivery_status !== "delivered") {
    signals.push({
      signal_type: "no_delivery_confirmation",
      score: Math.min(100, Math.round(40 + order.amount / 20)),
      details: `High-value order ($${order.amount}) has no delivery confirmation on file yet.`,
    });
  }

  if (customer) {
    const recentOrders = await base44.entities.Order.filter({ customer_id: customer.id });
    const windowStart = Date.now() - VELOCITY_WINDOW_HOURS * 60 * 60 * 1000;
    const recentCount = (recentOrders ?? []).filter(
      (o: any) => new Date(o.order_date).getTime() >= windowStart,
    ).length;
    if (recentCount >= VELOCITY_ORDER_COUNT) {
      signals.push({
        signal_type: "velocity_spike",
        score: Math.min(100, 30 + recentCount * 10),
        details: `${recentCount} orders from this customer in the last ${VELOCITY_WINDOW_HOURS}h.`,
      });
    }
  }

  for (const signal of signals) {
    await base44.entities.RiskSignal.create({
      merchant_id: order.merchant_id,
      order_id: order.id,
      customer_id: order.customer_id ?? "",
      ...signal,
    });
  }

  const topScore = signals.reduce((max, s) => Math.max(max, s.score), 0);

  if (customer) {
    const newFlag = topScore >= 70 ? "high" : topScore >= 40 ? "medium" : "low";
    if (newFlag !== customer.risk_flag) {
      await base44.entities.Customer.update(customer.id, { risk_flag: newFlag });
    }
  }

  if (signals.length > 0) {
    await logActivity(
      base44,
      user.email,
      order.merchant_id,
      undefined,
      "risk_flagged",
      `Order ${order.id} flagged: ${signals.map((s) => s.signal_type).join(", ")} (top score ${topScore}).`,
    );

    const merchants = await base44.entities.Merchant.filter({ id: order.merchant_id });
    const merchant = merchants?.[0];
    if (merchant && topScore >= (merchant.risk_alert_threshold ?? 60)) {
      await base44.integrations.Core.SendEmail({
        to: merchant.notification_email,
        subject: `High chargeback risk on a new order ($${order.amount})`,
        body: signals.map((s) => `${s.signal_type}: ${s.details}`).join("\n\n"),
        from_name: "ChargebackShield",
      });
    }
  }

  return Response.json({ signals, top_score: topScore });
});
