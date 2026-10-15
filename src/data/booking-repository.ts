import { decodeBookingFile, sanitizeBookings } from '../../supabase/functions/parse-booking/contract';
import type { BookingFile } from '@/features/bookings/booking-file';
import type { bookingToPlan } from '@/features/bookings/booking-time';
import { getSupabaseClient } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type BookingDocument = Tables<'booking_documents'>;

export async function listBookingDocuments(tripId?: string) {
  let query = getSupabaseClient().from('booking_documents').select('*').order('created_at', { ascending: false });
  if (tripId) query = query.eq('trip_id', tripId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function parseBookingFile(tripId: string, file: BookingFile, locale: string, signal?: AbortSignal) {
  const { data, error } = await getSupabaseClient().functions.invoke('parse-booking', {
    body: { tripId, base64: file.base64, mimeType: file.mimeType, locale, consent: true },
    signal,
  });
  if (error) throw error;
  return sanitizeBookings(data?.bookings);
}

export async function importBookingFile(tripId: string, userId: string, file: BookingFile, plans: ReturnType<typeof bookingToPlan>[]) {
  const client = getSupabaseClient();
  const path = `${userId}/${tripId}/${file.fingerprint}`;
  const { bytes } = decodeBookingFile(file.base64, file.mimeType);
  const { error: uploadError } = await client.storage.from('booking-documents').upload(path, bytes.buffer, { contentType: file.mimeType, upsert: false });
  if (uploadError && !('statusCode' in uploadError && String(uploadError.statusCode) === '409')) throw uploadError;
  const { data, error } = await client.rpc('import_booking_document', {
    requested_trip_id: tripId,
    document_fingerprint: file.fingerprint,
    document_name: file.name,
    document_mime_type: file.mimeType,
    plans: plans.map((plan) => ({ ...plan, createdBy: userId })),
  });
  // A failed response can follow a committed transaction; retain the private
  // object for an idempotent retry instead of removing a saved original.
  if (error) throw error;
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.added !== 'number' || typeof data.skipped !== 'number' || typeof data.alreadyImported !== 'boolean') throw new Error('Invalid import response');
  return { added: data.added, skipped: data.skipped, alreadyImported: data.alreadyImported };
}

export async function getBookingDocumentUrl(document: BookingDocument) {
  const { data, error } = await getSupabaseClient().storage.from('booking-documents').createSignedUrl(document.storage_path, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteBookingDocument(document: BookingDocument) {
  const client = getSupabaseClient();
  const { error: storageError } = await client.storage.from('booking-documents').remove([document.storage_path]);
  if (storageError) throw storageError;
  const { error } = await client.from('booking_documents').delete().eq('id', document.id);
  if (error) throw error;
}

export async function deleteAllBookingFiles(userId: string) {
  const client = getSupabaseClient();
  const bucket = client.storage.from('booking-documents');
  const folders: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await bucket.list(userId, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    folders.push(...data.map(({ name }) => name));
    if (data.length < 100) break;
  }
  for (const folder of folders) {
    // Re-read offset zero after deleting a page so objects never shift past us.
    while (true) {
      const { data, error } = await bucket.list(`${userId}/${folder}`, { limit: 100 });
      if (error) throw error;
      if (!data.length) break;
      const { error: removeError } = await bucket.remove(data.map(({ name }) => `${userId}/${folder}/${name}`));
      if (removeError) throw removeError;
    }
  }
  const { error } = await client.from('booking_documents').delete().eq('user_id', userId);
  if (error) throw error;
}
