import { format, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';

export function todayKey(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDateKey(dateKey: string): string {
  const d = parseISO(dateKey);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'MMM d');
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d');
}

export function isOverdue(dueDateKey: string | undefined): boolean {
  if (!dueDateKey) return false;
  return dueDateKey < todayKey();
}

export function truncate(text: string, maxLen = 120): string {
  const stripped = text.replace(/[#*_`>\-\[\]]/g, '').trim();
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + '…' : stripped;
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
