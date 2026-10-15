import type { BookingDraft } from '../../../supabase/functions/parse-booking/contract';
import type { ItineraryDestination } from '@/domain/models';

export interface BookingPreview extends BookingDraft {
  destination?: ItineraryDestination;
}
