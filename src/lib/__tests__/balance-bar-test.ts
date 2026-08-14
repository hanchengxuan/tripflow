import { balanceBarWidths } from '@/lib/balance-bar';

describe('balanceBarWidths', () => {
  it('fills neither half when nothing is outstanding', () => {
    expect(balanceBarWidths(0, 0)).toEqual({ outPercent: 0, inPercent: 0 });
  });

  it('fills the owing half completely when only money is owed out', () => {
    expect(balanceBarWidths(41250, 0)).toEqual({ outPercent: 50, inPercent: 0 });
  });

  it('fills the receiving half completely when only money is owed in', () => {
    expect(balanceBarWidths(0, 26800)).toEqual({ outPercent: 0, inPercent: 50 });
  });

  it('scales the smaller side against the larger one', () => {
    // owed out is twice what is owed in, so its half is twice as long
    expect(balanceBarWidths(1000, 500)).toEqual({ outPercent: 50, inPercent: 25 });
  });

  it('draws equal halves when both directions match', () => {
    expect(balanceBarWidths(700, 700)).toEqual({ outPercent: 50, inPercent: 50 });
  });

  it('never lets a side exceed half the track', () => {
    const { outPercent, inPercent } = balanceBarWidths(9_999_999, 1);
    expect(outPercent).toBe(50);
    expect(inPercent).toBeLessThanOrEqual(50);
  });

  it('treats a negative balance as nothing outstanding rather than inverting the bar', () => {
    expect(balanceBarWidths(-500, 1000)).toEqual({ outPercent: 0, inPercent: 50 });
  });
});
