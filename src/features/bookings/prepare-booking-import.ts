import type { BookingPreview } from './booking-preview';
import type { Trip } from '@/domain/models';
import type { AppLocale } from '@/features/i18n/i18n-provider';
import { toUserMessage } from '@/lib/user-error';
import { bookingToPlan } from './booking-time';

export function prepareBookingImport(drafts: BookingPreview[], selected: boolean[], trip: Trip, locale: AppLocale) {
  const plans: ReturnType<typeof bookingToPlan>[] = [];
  const issues: Record<number, string> = {};
  drafts.forEach((draft, index) => {
    if (!selected[index]) return;
    try { plans.push(bookingToPlan(draft, trip)); }
    catch (caught) {
      issues[index] = toUserMessage(caught, locale === 'en' ? 'Check this booking against the original.' : '请对照原订单检查这项安排。', locale);
    }
  });
  return { plans, issues };
}
