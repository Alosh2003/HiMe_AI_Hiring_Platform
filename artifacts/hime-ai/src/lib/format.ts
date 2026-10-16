import type { ApplicationStatus } from '@/types';

/**
 * Shared display formatters.
 *
 * The API answers with ISO timestamps and numeric salary bounds while demo
 * mode already carries human strings — these helpers render both honestly
 * ("—" for missing values) instead of leaking raw `2026-10-16T04:36:41.797Z`
 * or `undefined` into the UI.
 */

// Latin digits + Gregorian months in Arabic: "16 أكتوبر 2026".
const AR_DATE = new Intl.DateTimeFormat('ar-u-nu-latn-ca-gregory', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** ISO timestamp -> localized Arabic date; passes human strings through. */
export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value; // already "منذ 3 أيام" etc.
  return AR_DATE.format(parsed);
}

/** ISO timestamp -> "اليوم" / "أمس" / "منذ X يوم" / a full date beyond a month. */
export function formatRelative(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const days = Math.floor((Date.now() - parsed.getTime()) / 86_400_000);
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days < 30) return `منذ ${days} يوم`;
  return AR_DATE.format(parsed);
}

/** salaryMin/salaryMax bounds -> "18,000 – 24,000 ر.س"; undefined when absent. */
export function formatSalary(min?: number | null, max?: number | null): string | undefined {
  if (typeof min !== 'number' && typeof max !== 'number') return undefined;
  const fmt = (n?: number | null) => (typeof n === 'number' ? n.toLocaleString('en-US') : undefined);
  if (min && max) return `${fmt(min)} – ${fmt(max)} ر.س`;
  if (min) return `من ${fmt(min)} ر.س`;
  if (max) return `حتى ${fmt(max)} ر.س`;
  return undefined;
}

/** Shared application-status labels (the tables keep their own color maps). */
export const statusLabels: Record<ApplicationStatus, string> = {
  applied: 'تم التقديم',
  reviewing: 'قيد المراجعة',
  shortlisted: 'القائمة المختصرة',
  interview: 'مقابلة',
  rejected: 'غير مناسب حالياً',
  accepted: 'تم القبول',
};

/** "ليان العتيبي" -> "لع"; falls back to the first letter. */
export function initials(name?: string | null): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  return parts.slice(0, 2).map((part) => part[0]).join('');
}
