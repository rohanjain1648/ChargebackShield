import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { CountdownBadge, DisputeStatusBadge } from "@/components/Badges";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { formatMoney, reasonLabel } from "@/lib/format";

const FIELD_LABELS: Record<string, string> = {
  product_description: "Product description",
  shipping_carrier: "Shipping carrier",
  shipping_tracking_number: "Tracking number",
  shipping_date: "Ship date",
  shipping_documentation: "Delivery proof",
  refund_policy: "Refund policy",
  receipt: "Receipt",
  customer_communication: "Customer communication",
};

export function DisputeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dispute, setDispute] = useState<any>(null);
  const [packet, setPacket] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const disputes = await base44.entities.Dispute.filter({ id });
    const d = disputes?.[0];
    setDispute(d ?? null);
    if (d) {
      const packets = await base44.entities.EvidencePacket.filter({ dispute_id: d.id });
      setPacket(packets?.[0] ?? null);
      const ev = await base44.entities.ActivityEvent.filter({ dispute_id: d.id });
      setEvents((ev ?? []).sort((a: any, b: any) => (a.created_date < b.created_date ? 1 : -1)));
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function withBusy(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  if (!dispute) return <p style={{ color: "var(--text-dim)" }}>Loading…</p>;

  const missing = new Set(packet?.missing_fields ?? []);
  const canSubmit = packet?.status === "drafted" && dispute.status !== "under_review";

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn secondary" onClick={() => navigate("/")} style={{ marginBottom: 10 }}>
            ← Back to queue
          </button>
          <h1>
            {reasonLabel(dispute.reason)} · {formatMoney(dispute.amount, dispute.currency)}
          </h1>
          <p>Stripe dispute {dispute.stripe_dispute_id}</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <DisputeStatusBadge status={dispute.status} />
          <CountdownBadge dueIso={dispute.evidence_due_by} />
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--bad)", marginBottom: 16 }}>
          <strong style={{ color: "var(--bad)" }}>Error:</strong> {error}
        </div>
      )}

      <div className="two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <p className="section-title">Assembled evidence</p>
            {Object.entries(FIELD_LABELS).map(([key, label]) => (
              <div className={`evidence-field ${missing.has(key) ? "missing" : ""}`} key={key}>
                <div className="key">{label}</div>
                <div className="value">{packet?.assembled_fields?.[key] || (missing.has(key) ? "Missing" : "—")}</div>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <button
                className="btn secondary"
                disabled={busy !== null}
                onClick={() => withBusy("build", () => base44.functions.invoke("buildEvidence", { dispute_id: dispute.id }))}
              >
                {busy === "build" ? "Rebuilding…" : "Recompute evidence"}
              </button>
            </div>
          </div>

          <div className="card">
            <p className="section-title">AI strategy & draft</p>
            {packet?.ai_strategy_summary ? (
              <>
                <p style={{ fontSize: 13.5, color: "var(--text-dim)", marginBottom: 12 }}>{packet.ai_strategy_summary}</p>
                <p className="draft-text">{packet.ai_draft_text}</p>
                <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
                  Confidence: {Math.round((packet.ai_confidence ?? 0) * 100)}%
                </p>
              </>
            ) : (
              <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>No draft yet.</p>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                className="btn secondary"
                disabled={busy !== null}
                onClick={() => withBusy("draft", () => base44.functions.invoke("draftRebuttal", { dispute_id: dispute.id }))}
              >
                {busy === "draft" ? "Drafting…" : "Regenerate draft"}
              </button>
              <button
                className="btn"
                disabled={!canSubmit || busy !== null}
                onClick={() => withBusy("submit", () => base44.functions.invoke("submitEvidence", { dispute_id: dispute.id }))}
              >
                {busy === "submit" ? "Submitting…" : "Approve & Submit"}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="section-title">Activity</p>
          <ActivityTimeline events={events} />
        </div>
      </div>
    </div>
  );
}
