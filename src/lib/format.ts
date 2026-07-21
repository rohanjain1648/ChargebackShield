export function formatMoney(amount: number, currency: string = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount ?? 0);
}

export function reasonLabel(reason: string) {
  return (reason ?? "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function timeRemaining(dueIso: string): { label: string; urgency: "low" | "medium" | "high" | "expired" } {
  if (!dueIso) return { label: "—", urgency: "low" };
  const diffMs = new Date(dueIso).getTime() - Date.now();
  if (diffMs <= 0) return { label: "Deadline passed", urgency: "expired" };

  const hours = diffMs / (1000 * 60 * 60);
  const days = Math.floor(hours / 24);
  const remHours = Math.floor(hours % 24);

  const label = days > 0 ? `${days}d ${remHours}h left` : `${remHours}h left`;
  const urgency = hours <= 24 ? "high" : hours <= 72 ? "medium" : "low";
  return { label, urgency };
}

export function statusLabel(status: string) {
  return (status ?? "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
