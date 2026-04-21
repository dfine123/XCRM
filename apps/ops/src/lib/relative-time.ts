/**
 * Server-side relative-time formatter. Intentionally coarse — good enough
 * for "last synced 3m ago" style badges without shipping Intl.RelativeTimeFormat
 * state or a hydration boundary.
 */
export function relativeTime(date: Date | null | undefined, now: Date = new Date()): string {
  if (!date) return 'never';
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'just now';

  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(mo / 12);
  return `${yr}y ago`;
}
