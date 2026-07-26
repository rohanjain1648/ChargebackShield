// (Re)generates the AI strategy summary + evidence statement for a dispute's
// evidence packet. Called automatically by the ingest pipeline, and exposed
// here so the merchant can hit "Regenerate draft" after editing evidence.
//
// Frontend call:
//   await base44.functions.invoke('draftRebuttal', { dispute_id })

import { createClientFromRequest } from "npm:@base44/sdk";
import { draftRebuttal, findEvidencePacket } from "../../shared/dispute.ts";

Deno.serve(async (req) => {
  const { dispute_id } = await req.json();
  if (!dispute_id) return Response.json({ error: "dispute_id is required" }, { status: 400 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  const disputes = await base44.entities.Dispute.filter({ id: dispute_id });
  const dispute = disputes?.[0];
  if (!dispute) return Response.json({ error: "Dispute not found" }, { status: 404 });

  const packet = await findEvidencePacket(base44, dispute_id);
  if (!packet) return Response.json({ error: "No evidence packet yet — run buildEvidence first" }, { status: 400 });

  const updated = await draftRebuttal(base44, user.email, dispute, packet);
  return Response.json({ packet: updated });
});
