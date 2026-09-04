export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function getElapsedMinutes(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

/** "3m", "42m", "1h 05m" — how long an order has been sitting, the number that matters most on a kitchen queue. */
export function formatElapsed(iso: string): string {
  const minutes = getElapsedMinutes(iso);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export function formatElapsedFromMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}
