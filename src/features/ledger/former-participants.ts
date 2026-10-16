/**
 * People who appear in a trip's ledger but are neither current members nor
 * archived ones. Members removed before departures were archived, and people
 * who deleted their account, still pay or share in old expenses.
 */
export function unknownLedgerParticipants(
  knownUserIds: Iterable<string>,
  expenses: { payerIds: string[]; shareIds: string[] }[],
  settlements: { fromUserId: string; toUserId: string }[],
) {
  const known = new Set(knownUserIds);
  const seen = new Set<string>();
  for (const { payerIds, shareIds } of expenses) for (const id of [...payerIds, ...shareIds]) seen.add(id);
  for (const { fromUserId, toUserId } of settlements) seen.add(fromUserId).add(toUserId);
  return [...seen].filter((id) => !known.has(id));
}
