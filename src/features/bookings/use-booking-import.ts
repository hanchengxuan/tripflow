import { useEffect, useRef, useState } from 'react';

import type { BookingDraft } from '../../../supabase/functions/parse-booking/contract';
import { importBookingFile, listBookingDocuments, parseBookingFile, type BookingDocument } from '@/data/booking-repository';
import type { Trip } from '@/domain/models';
import { pickBookingFile, type BookingFile } from './booking-file';
import { bookingToPlan } from './booking-time';

type Translate = (zh: string, en: string) => string;

export function useBookingImport(trip: Trip, userId: string, locale: string, tx: Translate) {
  const [file, setFile] = useState<BookingFile>();
  const [drafts, setDrafts] = useState<BookingDraft[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [busy, setBusy] = useState<'recognizing' | 'saving'>();
  const [error, setError] = useState<string>();
  const [recognized, setRecognized] = useState(false);
  const operation = useRef(0);
  const working = useRef(false);

  useEffect(() => {
    let active = true;
    void listBookingDocuments(trip.id).then((rows) => { if (active) setDocuments(rows); }).catch(() => {
      if (active) setError(tx('无法加载已导入订单，请重试。', 'Could not load imported bookings. Please retry.'));
    });
    return () => { active = false; operation.current += 1; };
  }, [trip.id, tx]);

  async function chooseFile() {
    if (working.current) return;
    const current = ++operation.current;
    try {
      const picked = await pickBookingFile();
      if (!picked || current !== operation.current) return;
      setError(undefined);
      setFile(picked);
      setDrafts([]);
      setSelected([]);
      setRecognized(false);
      if (documents.some((document) => document.fingerprint === picked.fingerprint)) setError(tx('这个文件已经导入过，可在下方查看原件。', 'This file was already imported. Open its original below.'));
    } catch {
      if (current === operation.current) setError(tx('无法读取文件。请选择 5 MB 以内的 PDF、JPEG、PNG 或 WebP。', 'Could not read the file. Choose a PDF, JPEG, PNG, or WebP smaller than 5 MB.'));
    }
  }

  async function recognize() {
    if (!file || working.current) return;
    working.current = true;
    const current = ++operation.current;
    setBusy('recognizing');
    setError(undefined);
    try {
      const rows = await parseBookingFile(trip.id, file, locale);
      if (current !== operation.current) return;
      setDrafts(rows);
      setSelected(rows.map(() => true));
      setRecognized(true);
    } catch {
      if (current === operation.current) setError(tx('识别失败，请重试或手动添加安排。', 'Recognition failed. Retry or add the plan manually.'));
    } finally {
      working.current = false;
      if (current === operation.current) setBusy(undefined);
    }
  }

  async function save() {
    if (!file || working.current) return;
    working.current = true;
    setBusy('saving');
    setError(undefined);
    try {
      const plans = drafts.filter((_, index) => selected[index]).map((draft) => bookingToPlan(draft, trip));
      if (!plans.length) throw new Error('Choose a booking');
      return await importBookingFile(trip.id, userId, file, plans);
    } catch {
      setError(tx('未能加入行程。请检查名称、地点、当地时间和时区，并确保日期在行程范围内。网络失败时可安全重试。', 'Could not add bookings. Check titles, places, local times, zones, and trip dates. You can safely retry after a network failure.'));
    } finally {
      working.current = false;
      setBusy(undefined);
    }
  }

  function update(index: number, patch: Partial<BookingDraft>) {
    setDrafts((rows) => rows.map((row, position) => position === index ? { ...row, ...patch } : row));
  }

  return { file, drafts, selected, documents, busy, error, recognized, chooseFile, recognize, save, update, setError, setDocuments,
    toggle: (index: number) => setSelected((values) => values.map((value, position) => position === index ? !value : value)),
  };
}
