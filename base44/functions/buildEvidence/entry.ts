// Recomputes the evidence packet for an existing dispute. Callable from the
// dispute workbench after the merchant edits an Order (e.g. adds a delivery
// proof URL or fills in a missing tracking number) so gaps update live.
//
// Frontend call:
//   await base44.functions.invoke('buildEvidence', { dispute_id })

import { createClientFromRequest } from "npm:@base44/sdk";
import { buildEvidencePacket } from "../../shared/dispute.ts";

Deno.serve(async (req) => {
  const { dispute_id } = await req.json();
  if (!dispute_id) return Response.json({ error: "dispute_id is required" }, { status: 400 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  const disputes = await base44.entities.Dispute.filter({ id: dispute_id });
  const dispute = disputes?.[0];
  if (!dispute) return Response.json({ error: "Dispute not found" }, { status: 404 });

  const orders = dispute.order_id ? await base44.entities.Order.filter({ id: dispute.order_id }) : [];
  const order = orders?.[0] ?? null;

  const customers = dispute.customer_id ? await base44.entities.Customer.filter({ id: dispute.customer_id }) : [];
  const customer = customers?.[0] ?? null;

  const packet = await buildEvidencePacket(base44, user.email, dispute, order, customer);
  return Response.json({ packet });
});
