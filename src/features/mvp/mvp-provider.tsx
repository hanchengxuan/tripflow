import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  addExpenseReceipt,
  acceptTripInvite,
  createCustomExpense,
  createEqualExpense,
  createItineraryItem,
  createStayTransfer,
  createTrip,
  createTripInvite,
  deleteItineraryItem,
  deleteTrip,
  getProfile,
  listExpenses,
  listItineraryItems,
  listLedgerMembers,
  listSettlements,
  listTripMembers,
  listTrips,
  moveItineraryItem as moveItineraryItemRepository,
  recordSettlement,
  removeTripMember,
  unrecordSettlement,
  updateProfile,
  updateItineraryItem,
  updateItineraryRouteMode,
  updateCustomExpense,
  setExpenseSettled,
  updateTrip,
  updateTripMember,
} from '@/data/trip-repository';
import type { Expense, ItineraryItem, Profile, RouteTravelMode, Settlement, Trip, TripMember } from '@/domain/models';
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
  deleteTrip: () => Promise<void>;
  setMemberRole: (userId: string, role: 'owner' | 'editor' | 'viewer') => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  saveProfile: (input: { displayName: string; avatar?: { uri: string; mimeType?: string | null } }) => Promise<void>;
  addItineraryItem: (input: { title: string; kind: Database['public']['Enums']['itinerary_kind']; startsAt: string; endsAt?: string; locationLabel?: string; googlePlaceId?: string }) => Promise<void>;
  addStayTransfer: (input: { stayId: string; sourceItemId: string; title: string }) => Promise<void>;
  saveItineraryItem: (input: { itemId: string; title: string; startsAt: string; endsAt: string; locationLabel?: string; googlePlaceId?: string }) => Promise<void>;
  setItineraryRouteMode: (itemId: string, travelMode: RouteTravelMode) => Promise<void>;
  moveItineraryItem: (itemId: string, targetTripId: string) => Promise<void>;
  removeItineraryItem: (itemId: string) => Promise<void>;
  addEqualExpense: (input: { title: string; currency: string; totalMinor: number; baseCurrency?: string; baseAmountMinor?: number; exchangeRate?: number; exchangeRateSource?: string; payerUserId: string; participantUserIds: string[]; receipt?: { uri: string; base64?: string | null; mimeType?: string | null; fileSize?: number } }) => Promise<{ receiptUploaded: boolean; receiptError?: unknown }>;
  addCustomExpense: (input: { title: string; currency: string; totalMinor: number; baseCurrency?: string; baseAmountMinor?: number; exchangeRate?: number; exchangeRateSource?: string; payerAllocations: { userId: string; amountMinor: number }[]; shareAllocations: { userId: string; amountMinor: number }[]; itineraryItemId?: string; source?: Database['public']['Enums']['expense_source']; clientMutationId?: string; receipt?: { uri: string; base64?: string | null; mimeType?: string | null; fileSize?: number } }) => Promise<{ receiptUploaded: boolean; receiptError?: unknown }>;
  updateCustomExpense: (input: { expenseId: string; title: string; currency: string; totalMinor: number; baseCurrency: string; baseAmountMinor: number; exchangeRate: number; exchangeRateSource?: string; payerAllocations: { userId: string; amountMinor: number }[]; shareAllocations: { userId: string; amountMinor: number }[]; itineraryItemId?: string }) => Promise<{ expenseId: string }>;
  setExpenseSettled: (expenseId: string, settled: boolean) => Promise<void>;
  attachExpenseReceipt: (expenseId: string, receipt: { uri: string; base64?: string | null; mimeType?: string | null; fileSize?: number }) => Promise<void>;
  markSettlement: (input: { toUserId: string; currency: string; amountMinor: number; baseCurrency?: string; baseAmountMinor?: number; exchangeRate?: number; exchangeRateSource?: string }) => Promise<void>;
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

  const deleteTripAction = useCallback(async () => {
    if (!activeTrip) throw new Error('请先选择一个行程。');
    await deleteTrip(activeTrip.id);
    const nextTrips = await listTrips();
    setTrips(nextTrips);
    await loadTripDetails(nextTrips[0]);
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

  const addItineraryItem = useCallback(async (input: { title: string; kind: Database['public']['Enums']['itinerary_kind']; startsAt: string; endsAt?: string; locationLabel?: string; googlePlaceId?: string }) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    await createItineraryItem(currentUserId, { ...input, tripId: activeTrip.id });
    setItineraryItems(await listItineraryItems(activeTrip.id));
  }, [activeTrip, currentUserId]);

  const addStayTransfer = useCallback(async (input: { stayId: string; sourceItemId: string; title: string }) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    await createStayTransfer(input);
    setItineraryItems(await listItineraryItems(activeTrip.id));
  }, [activeTrip]);

  const saveItineraryItem = useCallback(async (input: { itemId: string; title: string; startsAt: string; endsAt: string; locationLabel?: string; googlePlaceId?: string }) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    await updateItineraryItem(input);
    setItineraryItems(await listItineraryItems(activeTrip.id));
  }, [activeTrip]);

  const setItineraryRouteMode = useCallback(async (itemId: string, travelMode: RouteTravelMode) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    await updateItineraryRouteMode(itemId, travelMode);
    setItineraryItems(await listItineraryItems(activeTrip.id));
  }, [activeTrip]);

  const moveItineraryItemAction = useCallback(async (itemId: string, targetTripId: string) => {
    if (!activeTrip) throw new Error('请先选择一个行程。');
    if (!trips.some(({ id }) => id === targetTripId)) throw new Error('目标行程不存在。');
    await moveItineraryItemRepository(itemId, targetTripId);
    const [nextItems, nextExpenses] = await Promise.all([
      listItineraryItems(activeTrip.id),
      listExpenses(activeTrip.id),
    ]);
    setItineraryItems(nextItems);
    setExpenses(nextExpenses);
  }, [activeTrip, trips]);

  const removeItineraryItem = useCallback(async (itemId: string) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    await deleteItineraryItem(itemId);
    setItineraryItems(await listItineraryItems(activeTrip.id));
  }, [activeTrip]);

  const addEqualExpense = useCallback(async (input: { title: string; currency: string; totalMinor: number; baseCurrency?: string; baseAmountMinor?: number; exchangeRate?: number; exchangeRateSource?: string; payerUserId: string; participantUserIds: string[]; receipt?: { uri: string; base64?: string | null; mimeType?: string | null; fileSize?: number } }) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    const result = await createEqualExpense({ ...input, tripId: activeTrip.id, userId: currentUserId });
    setExpenses(await listExpenses(activeTrip.id));
    return result;
  }, [activeTrip, currentUserId]);

  const addCustomExpense = useCallback(async (input: { title: string; currency: string; totalMinor: number; baseCurrency?: string; baseAmountMinor?: number; exchangeRate?: number; exchangeRateSource?: string; payerAllocations: { userId: string; amountMinor: number }[]; shareAllocations: { userId: string; amountMinor: number }[]; itineraryItemId?: string; source?: Database['public']['Enums']['expense_source']; clientMutationId?: string; receipt?: { uri: string; base64?: string | null; mimeType?: string | null; fileSize?: number } }) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    const result = await createCustomExpense({ ...input, tripId: activeTrip.id, userId: currentUserId });
    setExpenses(await listExpenses(activeTrip.id));
    return result;
  }, [activeTrip, currentUserId]);

  const updateCustomExpenseAction = useCallback(async (input: { expenseId: string; title: string; currency: string; totalMinor: number; baseCurrency: string; baseAmountMinor: number; exchangeRate: number; exchangeRateSource?: string; payerAllocations: { userId: string; amountMinor: number }[]; shareAllocations: { userId: string; amountMinor: number }[]; itineraryItemId?: string }) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    const result = await updateCustomExpense({ ...input, userId: currentUserId });
    setExpenses(await listExpenses(activeTrip.id));
    return result;
  }, [activeTrip, currentUserId]);

  const setExpenseSettledAction = useCallback(async (expenseId: string, settled: boolean) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    await setExpenseSettled(expenseId, settled);
    setExpenses(await listExpenses(activeTrip.id));
  }, [activeTrip]);

  const markSettlement = useCallback(async (input: { toUserId: string; currency: string; amountMinor: number; baseCurrency?: string; baseAmountMinor?: number; exchangeRate?: number; exchangeRateSource?: string }) => {
    if (!activeTrip) throw new Error('请先创建或加入一个行程。');
    await recordSettlement({ ...input, tripId: activeTrip.id });
    const [nextSettlements, nextExpenses] = await Promise.all([
      listSettlements(activeTrip.id),
      listExpenses(activeTrip.id),
    ]);
    setSettlements(nextSettlements);
    setExpenses(nextExpenses);
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
    const [nextSettlements, nextExpenses] = await Promise.all([
      listSettlements(activeTrip.id),
      listExpenses(activeTrip.id),
    ]);
    setSettlements(nextSettlements);
    setExpenses(nextExpenses);
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
    deleteTrip: deleteTripAction,
    setMemberRole,
    removeMember,
    saveProfile,
    addItineraryItem,
    addStayTransfer,
    saveItineraryItem,
    setItineraryRouteMode,
    moveItineraryItem: moveItineraryItemAction,
    removeItineraryItem,
    addEqualExpense,
    addCustomExpense,
    updateCustomExpense: updateCustomExpenseAction,
    setExpenseSettled: setExpenseSettledAction,
    attachExpenseReceipt,
    markSettlement,
    unmarkSettlement,
  }), [loading, error, trips, activeTrip, members, ledgerMembers, itineraryItems, expenses, settlements, profile, currentUserId, selectTrip, refresh, createTripAction, joinTrip, createInvite, saveTrip, deleteTripAction, setMemberRole, removeMember, saveProfile, addItineraryItem, addStayTransfer, saveItineraryItem, setItineraryRouteMode, moveItineraryItemAction, removeItineraryItem, addEqualExpense, addCustomExpense, updateCustomExpenseAction, setExpenseSettledAction, attachExpenseReceipt, markSettlement, unmarkSettlement]);

  return <MvpContext.Provider value={value}>{children}</MvpContext.Provider>;
}

export function useMvp() {
  const value = useContext(MvpContext);
  if (!value) throw new Error('useMvp must be used inside MvpProvider');
  return value;
}
