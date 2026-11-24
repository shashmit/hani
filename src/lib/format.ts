export type Currency = 'USD' | 'EUR' | 'GBP' | 'INR';

export const CURRENCIES: { code: Currency; name: string; locale: string }[] = [
  { code: 'USD', name: 'United States dollar', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', locale: 'de-DE' },
  { code: 'GBP', name: 'British pound', locale: 'en-GB' },
  { code: 'INR', name: 'Indian rupee', locale: 'en-IN' },
];

export function currencyInfo(code: Currency) {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function formatMoney(amount: number, code: Currency) {
  const { locale } = currencyInfo(code);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

export function relativeDay(ts: number, now = Date.now()) {
  const d = new Date(ts);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date(now)) - startOf(d)) / 86_400_000);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Yesterday, ${time}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Section label for grouping by day: "Today", "Yesterday", "Mon, Nov 17" (adds year if not this year). */
export function dayLabel(ts: number, now = Date.now()) {
  const d = new Date(ts);
  const n = new Date(now);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(n) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== n.getFullYear() ? { year: 'numeric' } : {}),
  });
}

export function monthName(ts = Date.now()) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long' });
}

export function isSameMonth(ts: number, now = new Date()) {
  const d = new Date(ts);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// ---- Day keys ("YYYY-MM-DD" in local time), used to plan tasks on days ----

export function dateKey(d: Date = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function keyToDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** "Today", "Tomorrow", "Yesterday" or "Wed, Nov 25". */
export function dayTitle(key: string, today = dateKey()) {
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  return keyToDate(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
