import { createCustomExpense } from '@/data/trip-repository';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}));

describe('createCustomExpense', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the expense result when the optional plan link fails', async () => {
    const linkError = new Error('The selected plan is stale');
    mockRpc
      .mockResolvedValueOnce({ data: 'expense-1', error: null })
      .mockResolvedValueOnce({ data: null, error: linkError });

    const result = await createCustomExpense({
      userId: 'user-1',
      tripId: 'trip-1',
      title: 'Dinner',
      currency: 'AUD',
      totalMinor: 44900,
      baseCurrency: 'AUD',
      baseAmountMinor: 44900,
      exchangeRate: 1,
      exchangeRateSource: 'manual',
      payerAllocations: [{ userId: 'user-1', amountMinor: 44900 }],
      shareAllocations: [
        { userId: 'user-1', amountMinor: 22450 },
        { userId: 'user-2', amountMinor: 22450 },
      ],
      itineraryItemId: 'plan-1',
    });

    expect(result).toMatchObject({ expenseId: 'expense-1', receiptUploaded: false, itineraryLinkError: linkError });
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});
