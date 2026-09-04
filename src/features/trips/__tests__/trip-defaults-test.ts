import {
  canChangeBaseCurrency,
  defaultHomeCurrency,
  deviceTimeZone,
  newTripTimeZone,
  tripTimeZone,
} from '@/features/trips/trip-defaults';

const place = (timeZone: string) => ({
  cityName: 'City',
  countryName: 'Country',
  countryCode: 'xx',
  timeZone,
  latitude: 0,
  longitude: 0,
});

describe('tripTimeZone', () => {
  it('takes the zone of the earliest plan that has a destination', () => {
    const items = [
      { startsAt: '2026-03-16T00:00:00Z', destination: place('Asia/Seoul') },
      { startsAt: '2026-03-12T00:00:00Z', destination: place('Asia/Tokyo') },
    ];
    expect(tripTimeZone({ defaultTimeZone: 'Europe/Paris' }, items)).toBe('Asia/Tokyo');
  });

  it('ignores plans that have no destination', () => {
    const items = [
      { startsAt: '2026-03-11T00:00:00Z', destination: undefined },
      { startsAt: '2026-03-12T00:00:00Z', destination: place('Asia/Tokyo') },
    ];
    expect(tripTimeZone({ defaultTimeZone: 'Europe/Paris' }, items)).toBe('Asia/Tokyo');
  });

  it('falls back to the zone stored on the trip when no plan has one', () => {
    expect(tripTimeZone({ defaultTimeZone: 'Europe/Paris' }, [])).toBe('Europe/Paris');
    expect(tripTimeZone({ defaultTimeZone: 'Europe/Paris' }, [{ startsAt: '2026-03-12T00:00:00Z', destination: undefined }]))
      .toBe('Europe/Paris');
  });

  it('falls back to the device when the trip stored nothing usable', () => {
    expect(tripTimeZone({ defaultTimeZone: '   ' }, [])).toBe(deviceTimeZone());
    expect(tripTimeZone(undefined, [])).toBe(deviceTimeZone());
  });

  it('never returns a blank zone', () => {
    expect(deviceTimeZone()).toMatch(/^[A-Za-z]+(\/[A-Za-z_+\-0-9]+)*$/);
  });
});

describe('newTripTimeZone', () => {
  it('takes the destination chosen in the form', () => {
    expect(newTripTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo');
  });

  it('falls back to the device when the form named no destination', () => {
    expect(newTripTimeZone()).toBe(deviceTimeZone());
    expect(newTripTimeZone('  ')).toBe(deviceTimeZone());
  });
});

describe('defaultHomeCurrency', () => {
  it('reuses the most recent trip rather than a hardcoded city', () => {
    expect(defaultHomeCurrency([{ homeCurrency: 'JPY' }, { homeCurrency: 'HKD' }])).toBe('JPY');
  });

  it('normalises a stored currency', () => {
    expect(defaultHomeCurrency([{ homeCurrency: ' cny ' }])).toBe('CNY');
  });

  it('skips blank values instead of returning them', () => {
    expect(defaultHomeCurrency([{ homeCurrency: '  ' }, { homeCurrency: 'EUR' }])).toBe('EUR');
  });

  it('falls back to an explicit currency for a first trip', () => {
    expect(defaultHomeCurrency([])).toBe('USD');
    expect(defaultHomeCurrency([], 'CNY')).toBe('CNY');
  });
});

describe('canChangeBaseCurrency', () => {
  it('allows a change while the ledger is empty', () => {
    expect(canChangeBaseCurrency(0)).toBe(true);
  });

  it('refuses once any expense is denominated against it', () => {
    // update_trip_details recomputes no stored base_amount_minor, so a change
    // here would leave recorded money converted at the wrong base.
    expect(canChangeBaseCurrency(1)).toBe(false);
    expect(canChangeBaseCurrency(12)).toBe(false);
  });
});
