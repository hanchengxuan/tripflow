export interface Allocation {
  participantId: string;
  amountMinor: number;
}

export interface WeightedParticipant {
  participantId: string;
  weight: number;
}

export interface Balance {
  participantId: string;
  netMinor: number;
}

export interface SettlementTransfer {
  fromParticipantId: string;
  toParticipantId: string;
  amountMinor: number;
}

function assertMinorAmount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer in minor units`);
  }
}

function assertUniqueParticipantIds(ids: string[]): void {
  if (ids.some((id) => id.trim().length === 0)) {
    throw new Error('Participant ids must not be empty');
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error('Participant ids must be unique');
  }
}

export function splitEqually(totalMinor: number, participantIds: string[]): Allocation[] {
  assertMinorAmount(totalMinor, 'totalMinor');
  assertUniqueParticipantIds(participantIds);
  if (participantIds.length === 0) {
    throw new Error('At least one participant is required');
  }

  const base = Math.floor(totalMinor / participantIds.length);
  const remainder = totalMinor % participantIds.length;

  return participantIds.map((participantId, index) => ({
    participantId,
    amountMinor: base + (index < remainder ? 1 : 0),
  }));
}

export function splitByWeights(
  totalMinor: number,
  participants: WeightedParticipant[],
): Allocation[] {
  assertMinorAmount(totalMinor, 'totalMinor');
  assertUniqueParticipantIds(participants.map(({ participantId }) => participantId));
  if (participants.length === 0) {
    throw new Error('At least one participant is required');
  }
  if (participants.some(({ weight }) => !Number.isSafeInteger(weight) || weight <= 0)) {
    throw new Error('Weights must be positive safe integers');
  }

  const totalWeight = participants.reduce((sum, { weight }) => sum + BigInt(weight), 0n);
  const total = BigInt(totalMinor);
  const raw = participants.map(({ participantId, weight }, index) => {
    const numerator = total * BigInt(weight);
    return {
      participantId,
      index,
      amountMinor: Number(numerator / totalWeight),
      remainder: numerator % totalWeight,
    };
  });
  let unallocated = totalMinor - raw.reduce((sum, item) => sum + item.amountMinor, 0);

  const remainderOrder = [...raw].sort((left, right) => {
    if (left.remainder === right.remainder) return left.index - right.index;
    return left.remainder > right.remainder ? -1 : 1;
  });
  for (let index = 0; index < unallocated; index += 1) {
    remainderOrder[index].amountMinor += 1;
  }
  unallocated = 0;

  return raw.map(({ participantId, amountMinor }) => ({ participantId, amountMinor }));
}

export function assertAllocationsTotal(
  expectedTotalMinor: number,
  allocations: Allocation[],
  label = 'allocations',
): void {
  assertMinorAmount(expectedTotalMinor, 'expectedTotalMinor');
  assertUniqueParticipantIds(allocations.map(({ participantId }) => participantId));
  allocations.forEach(({ amountMinor }) => assertMinorAmount(amountMinor, `${label} amount`));

  const actual = allocations.reduce((sum, { amountMinor }) => sum + amountMinor, 0);
  if (!Number.isSafeInteger(actual) || actual !== expectedTotalMinor) {
    throw new Error(`${label} must sum to ${expectedTotalMinor}; received ${actual}`);
  }
}

export function minimizeSettlementTransfers(balances: Balance[]): SettlementTransfer[] {
  assertUniqueParticipantIds(balances.map(({ participantId }) => participantId));
  balances.forEach(({ netMinor }) => {
    if (!Number.isSafeInteger(netMinor)) {
      throw new Error('Balances must use safe integer minor units');
    }
  });
  const total = balances.reduce((sum, { netMinor }) => sum + netMinor, 0);
  if (total !== 0) {
    throw new Error(`Balances must sum to zero; received ${total}`);
  }

  const creditors = balances
    .filter(({ netMinor }) => netMinor > 0)
    .map(({ participantId, netMinor }) => ({ participantId, remaining: netMinor }))
    .sort((a, b) => b.remaining - a.remaining || a.participantId.localeCompare(b.participantId));
  const debtors = balances
    .filter(({ netMinor }) => netMinor < 0)
    .map(({ participantId, netMinor }) => ({ participantId, remaining: -netMinor }))
    .sort((a, b) => b.remaining - a.remaining || a.participantId.localeCompare(b.participantId));

  const transfers: SettlementTransfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amountMinor = Math.min(creditor.remaining, debtor.remaining);
    transfers.push({
      fromParticipantId: debtor.participantId,
      toParticipantId: creditor.participantId,
      amountMinor,
    });
    creditor.remaining -= amountMinor;
    debtor.remaining -= amountMinor;
    if (creditor.remaining === 0) creditorIndex += 1;
    if (debtor.remaining === 0) debtorIndex += 1;
  }

  return transfers;
}
