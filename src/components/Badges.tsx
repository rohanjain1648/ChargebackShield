import { statusLabel, timeRemaining } from "@/lib/format";

export function CountdownBadge({ dueIso }: { dueIso: string }) {
  const { label, urgency } = timeRemaining(dueIso);
  return <span className={`badge ${urgency}`}>{label}</span>;
}

const STATUS_TONE: Record<string, string> = {
  needs_response: "high",
  evidence_drafted: "medium",
  under_review: "neutral",
  won: "good",
  lost: "bad",
  warning_closed: "neutral",
};

export function DisputeStatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_TONE[status] ?? "neutral"}`}>{statusLabel(status)}</span>;
}

export function RiskBadge({ level }: { level: "low" | "medium" | "high" }) {
  return <span className={`badge ${level}`}>{level.toUpperCase()} RISK</span>;
}
