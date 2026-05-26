export function presenceLabel(isOnline: boolean, lastSeenAt: string | null | undefined, isIdle?: boolean): string {
  if (isOnline) return isIdle ? "Idle" : "Active now";
  if (!lastSeenAt) return "Offline";

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const secs = Math.floor(diffMs / 1_000);
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (secs < 5) return "Active just now";
  if (secs < 60) return `Active ${secs}s ago`;
  if (mins < 60) return `Active ${mins}m ago`;
  if (hours < 24) return `Active ${hours}h ago`;
  if (days === 1) return "Active yesterday";
  return "Offline";
}

export function presenceColor(isOnline: boolean, lastSeenAt: string | null | undefined, isIdle?: boolean): string {
  if (isOnline) return isIdle ? "bg-yellow-400" : "bg-emerald-500";
  if (!lastSeenAt) return "bg-zinc-600";
  const mins = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 60_000);
  if (mins < 5) return "bg-yellow-400";   // recently active
  if (mins < 30) return "bg-yellow-600";  // away
  return "bg-zinc-600";                   // offline
}
