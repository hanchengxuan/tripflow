import { useEffect, useRef, useState } from 'react';

import type { BookingPreview } from './booking-preview';
import { importBookingFile, listBookingDocuments, parseBookingFile, type BookingDocument } from '@/data/booking-repository';
import type { Trip } from '@/domain/models';
import { pickBookingFile, type BookingFile } from './booking-file';
import { prepareBookingImport } from './prepare-booking-import';
import type { AppLocale } from '@/features/i18n/i18n-provider';

type Translate = (zh: string, en: string) => string;

export function useBookingImport(trip: Trip, userId: string, locale: AppLocale, tx: Translate) {
  const [file, setFile] = useState<BookingFile>();
  const [drafts, setDrafts] = useState<BookingPreview[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [busy, setBusy] = useState<'recognizing' | 'saving'>();
  const [error, setError] = useState<string>();
  const [recognized, setRecognized] = useState(false);
  const [issues, setIssues] = useState<Record<number, string>>({});
  const operation = useRef(0);
  const recognition = useRef<AbortController | undefined>(undefined);
  const working = useRef(false);

  useEffect(() => {
    let active = true;
    void listBookingDocuments(trip.id).then((rows) => { if (active) setDocuments(rows); }).catch(() => {
      if (active) setError(tx('无法加载已导入订单，请重试。', 'Could not load imported bookings. Please retry.'));
    });
    return () => { active = false; };
  }, [trip.id, tx]);

  useEffect(() => () => { operation.current += 1; recognition.current?.abort(); }, [trip.id, userId]);

  function cancelRecognition() {
    if (!recognition.current) return;
    operation.current += 1;
    recognition.current.abort();
    recognition.current = undefined;
    working.current = false;
    setBusy(undefined);
  }

  async function chooseFile() {
    if (working.current) return;
    const current = ++operation.current;
    try {
      const picked = await pickBookingFile();
      if (!picked || current !== operation.current) return;
      setError(undefined);
      setFile(picked);
      setDrafts([]);
      setIssues({});
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
    const controller = new AbortController();
    recognition.current = controller;
    setBusy('recognizing');
    setError(undefined);
    try {
      const rows = await parseBookingFile(trip.id, file, locale, controller.signal);
      if (current !== operation.current) return;
      setDrafts(rows);
      setIssues({});
      setSelected(rows.map(() => true));
      setRecognized(true);
    } catch {
      if (current === operation.current) setError(tx('识别失败，请重试或手动添加安排。', 'Recognition failed. Retry or add the plan manually.'));
    } finally {
      if (current === operation.current) {
        working.current = false;
        recognition.current = undefined;
        setBusy(undefined);
      }
    }
  }

  async function save() {
    if (!file || working.current) return;
    const { plans, issues: nextIssues } = prepareBookingImport(drafts, selected, trip, locale);
    setIssues(nextIssues);
    if (Object.keys(nextIssues).length) {
      setError(tx('请修正标出的订单信息后重试。', 'Fix the highlighted booking details and retry.'));
      return;
    }
    if (!plans.length) { setError(tx('请至少选择一项订单。', 'Choose at least one booking.')); return; }
    working.current = true;
    const current = ++operation.current;
    setBusy('saving');
    setError(undefined);
    try {
      const result = await importBookingFile(trip.id, userId, file, plans);
      if (current === operation.current) return result;
    } catch {
      if (current === operation.current) setError(tx('保存未确认，预览已保留。请检查网络和行程编辑权限后重试；不会重复添加。', 'Save was not confirmed. Your preview is kept. Check your connection and trip editing access, then retry; plans will not be duplicated.'));
    } finally {
      if (current === operation.current) { working.current = false; setBusy(undefined); }
    }
  }

  function update(index: number, patch: Partial<BookingPreview>) {
    if (working.current) return;
    setError(undefined);
    setIssues((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== String(index))));
    setDrafts((rows) => rows.map((row, position) => position === index ? { ...row, ...patch } : row));
  }

  return { file, drafts, selected, documents, busy, error, issues, recognized, cancelRecognition, chooseFile, recognize, save, update, setError, setDocuments,
    toggle: (index: number) => {
      if (working.current) return;
      setError(undefined);
      setIssues((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== String(index))));
      setSelected((values) => values.map((value, position) => position === index ? !value : value));
    },
  };
}
