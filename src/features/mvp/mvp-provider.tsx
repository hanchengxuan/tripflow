import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  addExpenseReceipt,
  acceptTripInvite,
  createEqualExpense,
  createItineraryItem,
  createStayTransfer,
  createTrip,
  createTripInvite,
  getProfile,
  listExpenses,
  listItineraryItems,
  listLedgerMembers,
  listSettlements,
  listTripMembers,
  listTrips,
  recordSettlement,
  removeTripMember,
  unrecordSettlement,
  updateProfile,
  updateTrip,
  updateTripMember,
} from '@/data/trip-repository';
import type { Expense, ItineraryItem, Profile, Settlement, Trip, TripMember } from '@/domain/models';
import { useAuth } from '@/features/auth/auth-provider';
import { toUserMessage } from '@/lib/user-error';
import type { Database } from '@/types/database';

interface MvpContextValue {
  loading: boolean;
  error?: string;
  trips: Trip[];
  activeTrip?: Trip;
  members: TripMember[];
  ledgerMembers: TripMember[];
  itineraryItems: ItineraryItem[];
  expenses: Expense[];
  settlements: Settlement[];
  profile?: Profile;
  currentUserId: string;
  selectTrip: (tripId: string) => Promise<void>;
  refresh: () => Promise<void>;
  createTrip: (input: { name: string; startsOn: string; endsOn: string; homeCurrency: string; defaultTimeZone: string }) => Promise<void>;
  joinTrip: (token: string) => Promise<void>;
  createInvite: (role: 'editor' | 'viewer') => Promise<{ token: string; expiresAt: string }>;
  saveTrip: (input: { name: string; startsOn: string; endsOn: string; homeCurrency: string; defaultTimeZone: string }) => Promise<void>;
  setMemberRole: (userId: string, role: 'owner' | 'editor' | 'viewer') => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  saveProfile: (input: { displayName: string; avatar?: { uri: string; mimeType?: string | null } }) => Promise<void>;
  addItineraryItem: (input: { title: string; kind: Database['public']['Enums']['itinerary_kind']; startsAt: string; endsAt?: string; locationLabel?: string }) => Promise<void>;
  addStayTransfer: (input: { stayId: string; sourceItemId: string; title: string }) => Promise<void>;
  addEqualExpense: (input: { title: string; currency: string; totalMinor: number; payerUserId: string; participantUserIds: string[]; receipt?: { uri: string; base64?: string | null; mimeType?: string | null; fileSize?: number } }) => Promise<{ receiptUploaded: boolean; receiptError?: unknown }>;
  attachExpenseReceipt: (expenseId: string, receipt: { uri: string; base64?: string | null; mimeType?: string | null; fileSize?: number }) => Promise<void>;
  markSettlement: (input: { toUserId: string; currency: string; amountMinor: number }) => Promise<void>;
  unmarkSettlement: (settlementId: string) => Promise<void>;
}

const MvpContext = createContext<MvpContextValue | null>(null);

export function MvpProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const currentUserId = session?.user.id ?? '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip>();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [ledgerMembers, setLedgerMembers] = useState<TripMember[]>([]);
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [profile, setProfile] = useState<Profile>();

  const loadTripDetails = useCallback(async (trip?: Trip) => {
    setActiveTrip(trip);
    if (!trip) {
      setMembers([]);
      setLedgerMembers([]);
      setItineraryItems([]);
      setExpenses([]);
      setSettlements([]);
      return;
    }
    const [nextMembers, nextLedgerMembers, nextItems, nextExpenses, nextSettlements] = await Promise.all([
      listTripMembers(trip.id),
      listLedgerMembers(trip.id),
      listItineraryItems(trip.id),
      listExpenses(trip.id),
      listSettlements(trip.id),
    ]);
    setMembers(nextMembers);
    setLedgerMembers(nextLedgerMembers);
    setItineraryItems(nextItems);
    setExpenses(nextExpenses);
    setSettlements(nextSettlements);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextTrips, nextProfile] = await Promise.all([listTrips(), getProfile(currentUserId)]);
      setTrips(nextTrips);
      setProfile(nextProfile);
      const nextActive = nextTrips.find(({ id }) => id === activeTrip?.id) ?? nextTrips[0];
      await loadTripDetails(nextActive);
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [activeTrip?.id, currentUserId, loadTripDetails]);

  useEffect(() => {
    if (!currentUserId) return;
    const timeout = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timeout);
  }, [currentUserId, refresh]);

  const selectTrip = useCallback(async (tripId: string) => {
    const trip = trips.find(({ id }) => id === tripId);
    if (!trip) return;
    setLoading(true);
    setError(undefined);
    try {
      await loadTripDetails(trip);
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [loadTripDetails, trips]);

  const createTripAction = useCallback(async (input: { name: string; startsOn: string; endsOn: string; homeCurrency: string; defaultTimeZone: string }) => {
    const trip = await createTrip(input);
    const nextTrips = await listTrips();
    setTrips(nextTrips);
    await loadTripDetails(trip);
  }, [loadTripDetails]);

  const joinTrip = useCallback(async (token: string) => {
    const tripId = await acceptTripInvite(token);
    const nextTrips = await listTrips();
    setTrips(nextTrips);
    await loadTripDetails(nextTrips.find(({ id }) => id === tripId));
  }, [loadTripDetails]);

  const createInvite = useCallback(async (role: 'editor' | 'viewer') => {
    if (!activeTrip) throw new Error('请先选择一个行程。');
    return createTripInvite(activeTrip.id, role);
  }, [activeTrip]);

  const saveTrip = useCallback(async (input: { name: string; startsOn: string; endsOn: string; homeCurrency: string; defaultTimeZone: string }) => {
    if (!activeTrip) throw new Error('请先选择一个行程。');
    const updated = await updateTrip({ ...input, tripId: activeTrip.id });
    const nextTrips = await listTrips();
    setTrips(nextTrips);
    await loadTripDetails(nextTrips.find(({ id }) => id === updated.id) ?? updated);
  }, [activeTrip, loadTripDetails]);

  const setMemberRole = useCallback(async (userId: string, role: 'owner' | 'editor' | 'viewer') => {
    if (!activeTrip) throw new Error('请先选择一个行程。');
    await updateTripMember({ tripId: activeTrip.id, userId, role });
    const [nextMembers, nextLedgerMembers] = await Promise.all([listTripMembers(activeTrip.id), listLedgerMembers(activeTrip.id)]);
    setMembers(nextMembers);
    setLedgerMembers(nextLedgerMembers);
  }, [activeTrip]);

  const removeMember = useCallback(async (userId: string) => {
    if (!activeTrip) throw new Error('请先选择一个行程。');
    await removeTripMember(activeTrip.id, userId);
    const [nextMembers, nextLedgerMembers] = await Promise.all([listTripMembers(activeTrip.id), listLedgerMembers(activeTrip.id)]);
    setMembers(nextMembers);
    setLedgerMembers(nextLedgerMembers);
  }, [activeTrip]);

  const saveProfile = useCallback(async (input: { displayName: string; avatar?: { uri: string; mimeType?: string | null } }) => {
    await updateProfile(currentUserId, {
      ...input,
      currentAvatarPath: profile?.avatarPath,
    });
    setProfile(await getProfile(currentUserId));
    if (activeTrip) {
      const [nextMembers, nextLedgerMembers] = await Promise.all([listTripMembers(activeTrip.id), listLedgerMembers(activeTrip.id)]);
      setMembers(nextMembers);
      setLedgerMembers(nextLedgerMembers);
    }
  }, [activeTrip, currentUserId, profile?.avatarPath]);

  const addItineraryItem = useCallback(async (input: { title: string; kind: Database['public']['Enums']['itinerary_kind']; startsAt: string; endsAt?: string; locationLabel?: string }) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    await createItineraryItem(currentUserId, { ...input, tripId: activeTrip.id });
    setItineraryItems(await listItineraryItems(activeTrip.id));
  }, [activeTrip, currentUserId]);

  const addStayTransfer = useCallback(async (input: { stayId: string; sourceItemId: string; title: string }) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    await createStayTransfer(input);
    setItineraryItems(await listItineraryItems(activeTrip.id));
  }, [activeTrip]);

  const addEqualExpense = useCallback(async (input: { title: string; currency: string; totalMinor: number; payerUserId: string; participantUserIds: string[]; receipt?: { uri: string; base64?: string | null; mimeType?: string | null; fileSize?: number } }) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    const result = await createEqualExpense({ ...input, tripId: activeTrip.id, userId: currentUserId });
    setExpenses(await listExpenses(activeTrip.id));
    return result;
  }, [activeTrip, currentUserId]);

  const markSettlement = useCallback(async (input: { toUserId: string; currency: string; amountMinor: number }) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    await recordSettlement({ ...input, tripId: activeTrip.id });
    setSettlements(await listSettlements(activeTrip.id));
  }, [activeTrip]);

  const attachExpenseReceipt = useCallback(async (
    expenseId: string,
    receipt: { uri: string; base64?: string | null; mimeType?: string | null; fileSize?: number },
  ) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    await addExpenseReceipt(currentUserId, expenseId, receipt);
    setExpenses(await listExpenses(activeTrip.id));
  }, [activeTrip, currentUserId]);

  const unmarkSettlement = useCallback(async (settlementId: string) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    await unrecordSettlement(settlementId);
    setSettlements(await listSettlements(activeTrip.id));
  }, [activeTrip]);

  const value = useMemo<MvpContextValue>(() => ({
    loading,
    error,
    trips,
    activeTrip,
    members,
    ledgerMembers,
    itineraryItems,
    expenses,
    settlements,
    profile,
    currentUserId,
    selectTrip,
    refresh,
    createTrip: createTripAction,
    joinTrip,
    createInvite,
    saveTrip,
    setMemberRole,
    removeMember,
    saveProfile,
    addItineraryItem,
    addStayTransfer,
    addEqualExpense,
    attachExpenseReceipt,
    markSettlement,
    unmarkSettlement,
  }), [loading, error, trips, activeTrip, members, ledgerMembers, itineraryItems, expenses, settlements, profile, currentUserId, selectTrip, refresh, createTripAction, joinTrip, createInvite, saveTrip, setMemberRole, removeMember, saveProfile, addItineraryItem, addStayTransfer, addEqualExpense, attachExpenseReceipt, markSettlement, unmarkSettlement]);

  return <MvpContext.Provider value={value}>{children}</MvpContext.Provider>;
}

export function useMvp() {
  const value = useContext(MvpContext);
  if (!value) throw new Error('useMvp must be used inside MvpProvider');
  return value;
}
