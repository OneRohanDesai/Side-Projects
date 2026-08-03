export function formatWait(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  if (minutes <= 0) return "Now";
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `~${h}h ${m}m` : `~${h}h`;
}

export function formatTime(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return formatTime(d);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function partyLabel(n: number): string {
  return n === 1 ? "1 person" : `${n} people`;
}

export function statusLabel(status: string): string {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "called":
      return "Called";
    case "served":
      return "Served";
    case "no_show":
      return "No-show";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}
