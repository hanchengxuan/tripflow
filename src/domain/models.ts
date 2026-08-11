export type UserId = string;
export type TripId = string;
export type SegmentId = string;
export type ExpenseId = string;

export type TripRole = 'owner' | 'editor' | 'viewer';
export type SegmentVisibility = 'members_only' | 'trip_read_only';
export type ItineraryKind = 'transport' | 'lodging' | 'food' | 'activity' | 'note' | 'task';
export type ParticipantStatus = 'going' | 'arrived' | 'delayed' | 'not_participating';

export interface Profile {
  id: UserId;
  displayName: string;
  avatarPath?: string;
  avatarUrl?: string;
}

export interface Trip {
  id: TripId;
  name: string;
  startsOn: string;
  endsOn: string;
  homeCurrency: string;
  defaultTimeZone: string;
}

export interface TripMember {
  tripId: TripId;
  userId: UserId;
  displayName: string;
  role: TripRole;
}

export interface Segment {
  id: SegmentId;
  tripId: TripId;
  name: string;
  startsAt: string;
  endsAt: string;
  locationLabel: string;
  visibility: SegmentVisibility;
  parentSegmentId?: SegmentId;
}

export interface SegmentMember {
  segmentId: SegmentId;
  userId: UserId;
}

export interface ItineraryItem {
  id: string;
  tripId: TripId;
  segmentId?: SegmentId;
  kind: ItineraryKind;
  title: string;
  startsAt: string;
  endsAt?: string;
  locationLabel?: string;
  localScriptAddress?: string;
  responsibleUserId?: UserId;
}

export interface ExpensePayer {
  userId: UserId;
  amountMinor: number;
}

export interface ExpenseShare {
  userId: UserId;
  amountMinor: number;
}

export interface Expense {
  id: ExpenseId;
  tripId: TripId;
  segmentId?: SegmentId;
  title: string;
  currency: string;
  totalMinor: number;
  payers: ExpensePayer[];
  shares: ExpenseShare[];
  occurredAt: string;
  source: 'manual' | 'text' | 'voice' | 'receipt';
}
