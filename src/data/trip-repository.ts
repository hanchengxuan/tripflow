import type { Expense, ItineraryItem, Profile, Settlement, Trip, TripMember } from '@/domain/models';
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
    .select('id,display_name,avatar_path')
    .in('id', userIds);
  if (profileError) throw profileError;
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return memberships.map((membership) => {
    const profile = profileById.get(membership.user_id);
    const avatarPath = profile?.avatar_path ?? undefined;
    return {
      tripId: membership.trip_id,
      userId: membership.user_id,
      role: membership.role,
      displayName: profile?.display_name ?? '旅行者',
      avatarPath,
      avatarUrl: avatarPath
        ? client.storage.from('avatars').getPublicUrl(avatarPath).data.publicUrl
        : undefined,
    };
  });
}

export async function listLedgerMembers(tripId: string): Promise<TripMember[]> {
  const client = getSupabaseClient();
  const current = await listTripMembers(tripId);
  const { data, error } = await client
    .from('trip_member_archives')
    .select('trip_id,user_id,display_name,avatar_path,removed_at')
    .eq('trip_id', tripId);
  if (error) throw error;
  const currentIds = new Set(current.map(({ userId }) => userId));
  return [
    ...current,
    ...data.filter(({ user_id }) => !currentIds.has(user_id)).map((member) => ({
      tripId: member.trip_id,
      userId: member.user_id,
      displayName: member.display_name,
      avatarPath: member.avatar_path ?? undefined,
      avatarUrl: member.avatar_path
        ? client.storage.from('avatars').getPublicUrl(member.avatar_path).data.publicUrl
        : undefined,
      role: 'viewer' as const,
      archived: true,
    })),
  ];
}

export async function updateTrip(input: {
  tripId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  homeCurrency: string;
  defaultTimeZone: string;
}): Promise<Trip> {
  const { data, error } = await getSupabaseClient().rpc('update_trip_details', {
    requested_trip_id: input.tripId,
    trip_name: input.name,
    trip_starts_on: input.startsOn,
    trip_ends_on: input.endsOn,
    trip_home_currency: input.homeCurrency,
    trip_default_time_zone: input.defaultTimeZone,
  });
  if (error) throw error;
  return mapTrip(data);
}

export async function updateTripMember(input: {
  tripId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
}) {
  const { error } = await getSupabaseClient().rpc('manage_trip_member', {
    requested_trip_id: input.tripId,
    target_user_id: input.userId,
    requested_role: input.role,
    remove_member: false,
  });
  if (error) throw error;
}

export async function removeTripMember(tripId: string, userId: string) {
  const { error } = await getSupabaseClient().rpc('manage_trip_member', {
    requested_trip_id: tripId,
    target_user_id: userId,
    requested_role: 'viewer',
    remove_member: true,
  });
  if (error) throw error;
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
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('expenses')
    .select('*,expense_payers(*),expense_allocation_groups(*,expense_shares(*)),expense_receipts(*)')
    .eq('trip_id', tripId)
    .order('occurred_at', { ascending: false });
  if (error) throw error;

  const receiptPaths = data.flatMap((expense) => expense.expense_receipts.map((receipt) => receipt.storage_path));
  const signedUrls = new Map<string, string>();
  await Promise.all(receiptPaths.map(async (path) => {
    const { data: signed } = await client.storage.from('expense-receipts').createSignedUrl(path, 60 * 60);
    if (signed?.signedUrl) signedUrls.set(path, signed.signedUrl);
  }));

  return data.map((expense) => ({
    id: expense.id,
    tripId: expense.trip_id,
    segmentId: expense.segment_id ?? undefined,
    title: expense.title,
    currency: expense.currency,
    totalMinor: expense.total_minor,
    occurredAt: expense.occurred_at,
    source: expense.source,
    receipts: expense.expense_receipts.map((receipt) => ({
      id: receipt.id,
      expenseId: receipt.expense_id,
      storagePath: receipt.storage_path,
      mimeType: receipt.mime_type as 'image/jpeg' | 'image/png' | 'image/webp',
      sizeBytes: receipt.size_bytes,
      createdAt: receipt.created_at,
      signedUrl: signedUrls.get(receipt.storage_path),
    })),
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
  userId: string;
  tripId: string;
  title: string;
  currency: string;
  totalMinor: number;
  payerUserId: string;
  participantUserIds: string[];
  receipt?: { uri: string; base64?: string | null; mimeType?: string | null; fileSize?: number };
}) {
  const client = getSupabaseClient();
  const { data: expenseId, error } = await client.rpc('create_equal_expense', {
    requested_trip_id: input.tripId,
    expense_title: input.title,
    expense_currency: input.currency,
    expense_total_minor: input.totalMinor,
    payer_user_id: input.payerUserId,
    participant_user_ids: input.participantUserIds,
    expense_occurred_at: new Date().toISOString(),
  });
  if (error) throw error;

  if (!input.receipt) return { expenseId, receiptUploaded: false };

  try {
    await addExpenseReceipt(input.userId, expenseId, input.receipt);
    return { expenseId, receiptUploaded: true };
  } catch (receiptError) {
    return { expenseId, receiptUploaded: false, receiptError };
  }
}

export async function addExpenseReceipt(
  userId: string,
  expenseId: string,
  receipt: { uri: string; base64?: string | null; mimeType?: string | null; fileSize?: number },
) {
  const client = getSupabaseClient();
  const mimeType = receipt.mimeType === 'image/png' || receipt.mimeType === 'image/webp'
    ? receipt.mimeType
    : 'image/jpeg';
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `${userId}/${expenseId}/receipt-${Date.now()}.${extension}`;
  const body = receipt.base64
    ? Uint8Array.from(atob(receipt.base64), (character) => character.charCodeAt(0)).buffer
    : await (await fetch(receipt.uri)).arrayBuffer();
  if (body.byteLength > 10 * 1024 * 1024) throw new Error('Receipt image must be 10 MB or smaller');

  const { error: uploadError } = await client.storage.from('expense-receipts').upload(storagePath, body, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { error: receiptError } = await client.from('expense_receipts').insert({
    expense_id: expenseId,
    uploaded_by: userId,
    storage_path: storagePath,
    mime_type: mimeType,
    size_bytes: body.byteLength,
  });
  if (receiptError) {
    await client.storage.from('expense-receipts').remove([storagePath]);
    throw receiptError;
  }
}

export async function listSettlements(tripId: string): Promise<Settlement[]> {
  const { data, error } = await getSupabaseClient()
    .from('settlements')
    .select('*')
    .eq('trip_id', tripId)
    .order('settled_at', { ascending: false });
  if (error) throw error;
  return data.map((settlement) => ({
    id: settlement.id,
    tripId: settlement.trip_id,
    segmentId: settlement.segment_id ?? undefined,
    fromUserId: settlement.from_user_id,
    toUserId: settlement.to_user_id,
    currency: settlement.currency,
    amountMinor: settlement.amount_minor,
    settledAt: settlement.settled_at,
    recordedBy: settlement.recorded_by,
  }));
}

export async function recordSettlement(input: {
  tripId: string;
  toUserId: string;
  currency: string;
  amountMinor: number;
}) {
  const { error } = await getSupabaseClient().rpc('record_settlement', {
    requested_trip_id: input.tripId,
    recipient_user_id: input.toUserId,
    settlement_currency: input.currency,
    settlement_amount_minor: input.amountMinor,
  });
  if (error) throw error;
}

export async function unrecordSettlement(settlementId: string) {
  const { error } = await getSupabaseClient().rpc('unrecord_settlement', {
    requested_settlement_id: settlementId,
  });
  if (error) throw error;
}
