import { useState } from 'react';

import { BookingImportSheet } from '@/components/booking-import-sheet';
import { ActionButton } from '@/components/form-controls';
import type { Trip } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';

export function BookingImportEntry({ trip, userId, canEdit, onImported }: {
  trip: Trip; userId: string; canEdit: boolean; onImported: (message: string) => void;
}) {
  const { tx } = useI18n();
  const [open, setOpen] = useState(false);
  return <>
    <ActionButton tone="secondary" onPress={() => setOpen(true)}>{canEdit ? tx('导入机票／酒店订单', 'Import flight / hotel bookings') : tx('我的订单原件', 'My booking originals')}</ActionButton>
    {open ? <BookingImportSheet key={`${trip.id}:${userId}`} trip={trip} userId={userId} canEdit={canEdit} onDismiss={() => setOpen(false)} onImported={onImported} /> : null}
  </>;
}
