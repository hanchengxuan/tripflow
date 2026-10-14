import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { createTripOpener } from './trip-opener';

export function useTripOpener() {
  const [openingTripId, setOpeningTripId] = useState<string>();
  const [opener] = useState(() => createTripOpener(setOpeningTripId));
  useFocusEffect(useCallback(() => opener.focus(), [opener]));
  return { openingTripId, open: opener.open, cancel: opener.cancel };
}
