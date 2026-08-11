import type { Expense, ItineraryItem, Profile, Trip, TripMember } from '@/domain/models';
import { getSupabaseClient } from '@/lib/supabase';
import type { Database, Tables } from '@/types/database';

type TripRow = Tables<'trips'>;
type ItineraryRow = Tables<'itinerary_items'>;

function mapTrip(row: TripRow): Trip {
  return {
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    homeCurrency: row.home_currency,
    defaultTimeZone: row.default_time_zone,
  };
}

function mapItineraryItem(row: ItineraryRow): ItineraryItem {
  return {
    id: row.id,
    tripId: row.trip_id,
    segmentId: row.segment_id ?? undefined,
    kind: row.kind,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? undefined,
    locationLabel: row.location_label ?? undefined,
    localScriptAddress: row.local_script_address ?? undefined,
    responsibleUserId: row.responsible_user_id ?? undefined,
  };
}

export async function listTrips(): Promise<Trip[]> {
  const { data, error } = await getSupabaseClient().from('trips').select('*').order('starts_on');
  if (error) throw error;
  return data.map(mapTrip);
}

export async function getProfile(userId: string): Promise<Profile> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('profiles')
    .select('id,display_name,avatar_path')
    .eq('id', userId)
    .single();
  if (error) throw error;
  const avatarUrl = data.avatar_path
    ? client.storage.from('avatars').getPublicUrl(data.avatar_path).data.publicUrl
    : undefined;
  return {
    id: data.id,
    displayName: data.display_name,
    avatarPath: data.avatar_path ?? undefined,
    avatarUrl,
  };
}

export async function createTrip(input: {
  name: string;
  startsOn: string;
  endsOn: string;
  homeCurrency: string;
  defaultTimeZone: string;
}): Promise<Trip> {
  const { data, error } = await getSupabaseClient().rpc('create_trip', {
    trip_name: input.name,
    trip_starts_on: input.startsOn,
    trip_ends_on: input.endsOn,
    trip_home_currency: input.homeCurrency,
    trip_default_time_zone: input.defaultTimeZone,
  });
  if (error) throw error;
  return mapTrip(data);
}

export async function listTripMembers(tripId: string): Promise<TripMember[]> {
  const client = getSupabaseClient();
  const { data: memberships, error: membershipError } = await client
    .from('trip_members')
    .select('trip_id,user_id,role')
    .eq('trip_id', tripId)
    .order('joined_at');
  if (membershipError) throw membershipError;

  const userIds = memberships.map(({ user_id }) => user_id);
  if (userIds.length === 0) return [];
  const { data: profiles, error: profileError } = await client
    .from('profiles')
    .select('id,display_name')
    .in('id', userIds);
  if (profileError) throw profileError;
  const names = new Map(profiles.map((profile) => [profile.id, profile.display_name]));

  return memberships.map((membership) => ({
    tripId: membership.trip_id,
    userId: membership.user_id,
    role: membership.role,
    displayName: names.get(membership.user_id) ?? '旅行者',
  }));
}

export async function updateProfile(
  userId: string,
  input: {
    displayName: string;
    currentAvatarPath?: string;
    avatar?: { uri: string; mimeType?: string | null };
  },
) {
  const client = getSupabaseClient();
  let avatarPath = input.currentAvatarPath;

  if (input.avatar) {
    const mimeType = input.avatar.mimeType === 'image/png' || input.avatar.mimeType === 'image/webp'
      ? input.avatar.mimeType
      : 'image/jpeg';
    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const nextPath = `${userId}/avatar-${Date.now()}.${extension}`;
    const file = await fetch(input.avatar.uri);
    const body = await file.arrayBuffer();
    const { error: uploadError } = await client.storage.from('avatars').upload(nextPath, body, {
      contentType: mimeType,
      upsert: false,
    });
    if (uploadError) throw uploadError;
    avatarPath = nextPath;
  }

  const { error } = await client
    .from('profiles')
    .update({
      display_name: input.displayName.trim(),
      avatar_path: avatarPath ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) {
    if (avatarPath && avatarPath !== input.currentAvatarPath) {
      await client.storage.from('avatars').remove([avatarPath]);
    }
    throw error;
  }

  if (input.currentAvatarPath && avatarPath !== input.currentAvatarPath) {
    await client.storage.from('avatars').remove([input.currentAvatarPath]);
  }
}

export async function createTripInvite(tripId: string, role: 'editor' | 'viewer') {
  const { data, error } = await getSupabaseClient().rpc('create_trip_invite', {
    requested_trip_id: tripId,
    invited_role: role,
    valid_for_hours: 168,
    allowed_uses: 8,
  });
  if (error) throw error;
  const invite = data[0];
  if (!invite) throw new Error('无法生成邀请码，请稍后重试。');
  return { token: invite.invite_token, expiresAt: invite.invite_expires_at };
}

export async function acceptTripInvite(token: string): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('accept_trip_invite', {
    invite_token: token.trim(),
  });
  if (error) throw error;
  return data;
}

export async function listItineraryItems(tripId: string): Promise<ItineraryItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('itinerary_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('starts_at');
  if (error) throw error;
  return data.map(mapItineraryItem);
}

export async function createItineraryItem(
  userId: string,
  input: {
    tripId: string;
    title: string;
    kind: Database['public']['Enums']['itinerary_kind'];
    startsAt: string;
    endsAt?: string;
    locationLabel?: string;
  },
) {
  const { error } = await getSupabaseClient().from('itinerary_items').insert({
    trip_id: input.tripId,
    created_by: userId,
    title: input.title.trim(),
    kind: input.kind,
    starts_at: input.startsAt,
    ends_at: input.endsAt ?? null,
    location_label: input.locationLabel?.trim() || null,
  });
  if (error) throw error;
}

export async function listExpenses(tripId: string): Promise<Expense[]> {
  const { data, error } = await getSupabaseClient()
    .from('expenses')
    .select('*,expense_payers(*),expense_allocation_groups(*,expense_shares(*))')
    .eq('trip_id', tripId)
    .order('occurred_at', { ascending: false });
  if (error) throw error;

  return data.map((expense) => ({
    id: expense.id,
    tripId: expense.trip_id,
    segmentId: expense.segment_id ?? undefined,
    title: expense.title,
    currency: expense.currency,
    totalMinor: expense.total_minor,
    occurredAt: expense.occurred_at,
    source: expense.source,
    payers: expense.expense_payers.map((payer) => ({
      userId: payer.user_id,
      amountMinor: payer.amount_minor,
    })),
    shares: expense.expense_allocation_groups.flatMap((group) =>
      group.expense_shares.map((share) => ({
        userId: share.user_id,
        amountMinor: share.amount_minor,
      })),
    ),
  }));
}

export async function createEqualExpense(input: {
  tripId: string;
  title: string;
  currency: string;
  totalMinor: number;
  payerUserId: string;
  participantUserIds: string[];
}) {
  const { error } = await getSupabaseClient().rpc('create_equal_expense', {
    requested_trip_id: input.tripId,
    expense_title: input.title,
    expense_currency: input.currency,
    expense_total_minor: input.totalMinor,
    payer_user_id: input.payerUserId,
    participant_user_ids: input.participantUserIds,
    expense_occurred_at: new Date().toISOString(),
  });
  if (error) throw error;
}
