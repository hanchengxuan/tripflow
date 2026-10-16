import { unknownLedgerParticipants } from '@/features/ledger/former-participants';

it('finds payers, sharers and settlement parties who are no longer listed as members', () => {
  expect(unknownLedgerParticipants(
    ['me', 'archived'],
    [{ payerIds: ['left-early'], shareIds: ['me', 'left-early'] }, { payerIds: ['me'], shareIds: ['archived'] }],
    [{ fromUserId: 'me', toUserId: 'deleted-account' }],
  )).toEqual(['left-early', 'deleted-account']);
});

it('finds no one when every participant is known', () => {
  expect(unknownLedgerParticipants(['me', 'sam'], [{ payerIds: ['sam'], shareIds: ['me', 'sam'] }], [])).toEqual([]);
});
