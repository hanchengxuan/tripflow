import {
  assertAllocationsTotal,
  minimizeSettlementTransfers,
  splitByWeights,
  splitEqually,
} from '@/domain/money';

describe('splitEqually', () => {
  it('distributes remainder deterministically in participant order', () => {
    expect(splitEqually(86000, ['owner', 'a', 'b'])).toEqual([
      { participantId: 'owner', amountMinor: 28667 },
      { participantId: 'a', amountMinor: 28667 },
      { participantId: 'b', amountMinor: 28666 },
    ]);
  });

  it('rejects duplicate participants', () => {
    expect(() => splitEqually(100, ['a', 'a'])).toThrow('unique');
  });
});

describe('splitByWeights', () => {
  it('uses largest remainders without losing minor units', () => {
    const allocations = splitByWeights(100, [
      { participantId: 'a', weight: 1 },
      { participantId: 'b', weight: 2 },
      { participantId: 'c', weight: 3 },
    ]);

    expect(allocations).toEqual([
      { participantId: 'a', amountMinor: 17 },
      { participantId: 'b', amountMinor: 33 },
      { participantId: 'c', amountMinor: 50 },
    ]);
    expect(() => assertAllocationsTotal(100, allocations)).not.toThrow();
  });
});

describe('assertAllocationsTotal', () => {
  it('rejects payer or share totals that do not match the expense', () => {
    expect(() =>
      assertAllocationsTotal(500, [
        { participantId: 'a', amountMinor: 200 },
        { participantId: 'b', amountMinor: 200 },
      ]),
    ).toThrow('received 400');
  });
});

describe('minimizeSettlementTransfers', () => {
  it('settles a balanced group with deterministic transfers', () => {
    expect(
      minimizeSettlementTransfers([
        { participantId: 'owner', netMinor: 600 },
        { participantId: 'a', netMinor: 200 },
        { participantId: 'b', netMinor: -300 },
        { participantId: 'c', netMinor: -500 },
      ]),
    ).toEqual([
      { fromParticipantId: 'c', toParticipantId: 'owner', amountMinor: 500 },
      { fromParticipantId: 'b', toParticipantId: 'owner', amountMinor: 100 },
      { fromParticipantId: 'b', toParticipantId: 'a', amountMinor: 200 },
    ]);
  });

  it('rejects unbalanced input', () => {
    expect(() =>
      minimizeSettlementTransfers([
        { participantId: 'a', netMinor: 100 },
        { participantId: 'b', netMinor: -99 },
      ]),
    ).toThrow('sum to zero');
  });
});
