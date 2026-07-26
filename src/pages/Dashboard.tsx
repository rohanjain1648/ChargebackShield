import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { formatMoney, reasonLabel } from "@/lib/format";
import { RiskBadge } from "@/components/Badges";
import { motion } from "framer-motion";

export function Dashboard() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [d, s] = await Promise.all([
        base44.entities.Dispute.list("-created_date"),
        base44.entities.RiskSignal.list("-created_date"),
      ]);
      setDisputes(d);
      setSignals(s.filter((x: any) => !x.acknowledged).slice(0, 8));
      setLoading(false);
    })();
  }, []);

  if (loading) return <p style={{ color: "var(--text-dim)" }}>Loading…</p>;

  const won = disputes.filter((d) => d.outcome === "won");
  const lost = disputes.filter((d) => d.outcome === "lost");
  const pending = disputes.filter((d) => d.outcome === "pending");
  const decided = won.length + lost.length;
  const winRate = decided > 0 ? Math.round((won.length / decided) * 100) : 0;
  const recovered = won.reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const atRisk = pending.reduce((sum, d) => sum + (d.amount ?? 0), 0);

  const byReason: Record<string, { count: number; won: number; lost: number }> = {};
  for (const d of disputes) {
    byReason[d.reason] ??= { count: 0, won: 0, lost: 0 };
    byReason[d.reason].count += 1;
    if (d.outcome === "won") byReason[d.reason].won += 1;
    if (d.outcome === "lost") byReason[d.reason].lost += 1;
  }
  const maxCount = Math.max(1, ...Object.values(byReason).map((r) => r.count));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <motion.div variants={itemVariants} className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Win rate, recovered revenue, and pre-dispute risk signals.</p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid stats">
        <StatCard label="Win rate" value={decided > 0 ? `${winRate}%` : "—"} />
        <StatCard label="Recovered" value={formatMoney(recovered)} />
        <StatCard label="At risk (pending)" value={formatMoney(atRisk)} />
        <StatCard label="Total disputes" value={String(disputes.length)} />
      </motion.div>

      <motion.div variants={itemVariants} className="two-col">
        <div className="card">
          <p className="section-title">Disputes by reason code</p>
          {Object.entries(byReason).length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>No disputes yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.entries(byReason).map(([reason, stat]) => (
                <div key={reason}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{reasonLabel(reason)}</span>
                    <span style={{ color: "var(--text-dim)" }}>
                      {stat.count} · {stat.won}W / {stat.lost}L
                    </span>
                  </div>
                  <div style={{ background: "var(--bg-elevated)", borderRadius: 6, height: 8, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${(stat.count / maxCount) * 100}%`,
                        background: "var(--accent)",
                        height: "100%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <p className="section-title">Open risk signals</p>
          {signals.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>No active risk signals — nothing looks likely to dispute right now.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {signals.map((s) => (
                <div key={s.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <strong style={{ fontSize: 13 }}>{s.signal_type.replaceAll("_", " ")}</strong>
                    <RiskBadge level={s.score >= 70 ? "high" : s.score >= 40 ? "medium" : "low"} />
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: 0 }}>{s.details}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
