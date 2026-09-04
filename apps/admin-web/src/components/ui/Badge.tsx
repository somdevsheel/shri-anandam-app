const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-warning bg-warning/10 border-warning/40",
  ACCEPTED: "text-info bg-info/10 border-info/40",
  PREPARING: "text-info bg-info/10 border-info/40",
  READY: "text-success bg-success/10 border-success/40",
  OUT_FOR_DELIVERY: "text-success bg-success/10 border-success/40",
  DELIVERED: "text-text-muted bg-text-muted/10 border-text-muted/40",
  REJECTED: "text-danger bg-danger/10 border-danger/40",
  CANCELLED: "text-danger bg-danger/10 border-danger/40",
  PAID: "text-success bg-success/10 border-success/40",
  FAILED: "text-danger bg-danger/10 border-danger/40",
  REFUNDED: "text-warning bg-warning/10 border-warning/40",
  PARTIALLY_REFUNDED: "text-warning bg-warning/10 border-warning/40",
  ACTIVE: "text-success bg-success/10 border-success/40",
  INACTIVE: "text-text-muted bg-text-muted/10 border-text-muted/40",
};

function humanize(value: string): string {
  return value
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

export function Badge({ status, label }: { status: string; label?: string }) {
  const colorClass = STATUS_COLORS[status] ?? "text-text-muted bg-text-muted/10 border-text-muted/40";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${colorClass}`}>
      {label ?? humanize(status)}
    </span>
  );
}
