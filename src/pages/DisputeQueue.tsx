import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { CountdownBadge, DisputeStatusBadge } from "@/components/Badges";
import { formatMoney, reasonLabel } from "@/lib/format";

type Dispute = {
  id: string;
  reason: string;
  amount: number;
  currency: string;
  status: string;
  evidence_due_by: string;
  is_simulated: boolean;
};

const REASONS = [
  "product_not_received",
  "product_unacceptable",
  "duplicate",
  "fraudulent",
  "subscription_canceled",
  "credit_not_processed",
  "unrecognized",
  "general",
];

export function DisputeQueue() {
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [reason, setReason] = useState("product_not_received");

  async function load() {
    const rows = await base44.entities.Dispute.list("-created_date");
    setDisputes(rows as unknown as Dispute[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleSimulate() {
    setSimulating(true);
    try {
      await base44.functions.invoke("simulateDispute", { reason });
      await load();
    } finally {
      setSimulating(false);
    }
  }

  const open = disputes.filter((d) => !["won", "lost", "warning_closed"].includes(d.status));
  const closed = disputes.filter((d) => ["won", "lost", "warning_closed"].includes(d.status));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dispute Queue</h1>
          <p>Every incoming chargeback, evidence status, and deadline in one place.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {reasonLabel(r)}
              </option>
            ))}
          </select>
          <button className="btn" onClick={handleSimulate} disabled={simulating}>
            {simulating ? "Simulating…" : "Simulate dispute"}
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Loading…</p>
      ) : disputes.length === 0 ? (
        <div className="card empty-state">
          <p>No disputes yet. Click "Simulate dispute" to see the full pipeline run end to end.</p>
        </div>
      ) : (
        <>
          <DisputeTable title="Open" rows={open} onOpen={(id) => navigate(`/disputes/${id}`)} />
          {closed.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <DisputeTable title="Closed" rows={closed} onOpen={(id) => navigate(`/disputes/${id}`)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DisputeTable({
  title,
  rows,
  onOpen,
}: {
  title: string;
  rows: Dispute[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="card">
      <p className="section-title">{title}</p>
      <table>
        <thead>
          <tr>
            <th>Reason</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Deadline</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr className="row-link" key={d.id} onClick={() => onOpen(d.id)}>
              <td>{reasonLabel(d.reason)}</td>
              <td>{formatMoney(d.amount, d.currency)}</td>
              <td>
                <DisputeStatusBadge status={d.status} />
              </td>
              <td>
                <CountdownBadge dueIso={d.evidence_due_by} />
              </td>
              <td>{d.is_simulated && <span className="badge neutral">SIMULATED</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
