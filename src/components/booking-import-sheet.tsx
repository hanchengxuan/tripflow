import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { BookingDraftFields } from '@/components/booking-draft-fields';
import { BottomSheet } from '@/components/bottom-sheet';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { ActionButton, InlineNotice } from '@/components/form-controls';
import { SettingsGroup, SettingsRow } from '@/components/settings-list';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { deleteBookingDocument, getBookingDocumentUrl, type BookingDocument } from '@/data/booking-repository';
import type { Trip } from '@/domain/models';
import { useBookingImport } from '@/features/bookings/use-booking-import';
import { useI18n } from '@/features/i18n/i18n-provider';

export function BookingImportSheet({ trip, userId, canEdit, onDismiss, onImported }: {
  trip: Trip; userId: string; canEdit: boolean; onDismiss: () => void; onImported: (message: string) => void;
}) {
  const { tx, locale } = useI18n();
  const flow = useBookingImport(trip, userId, locale, tx);
  const [deleting, setDeleting] = useState<BookingDocument>();
  const [documentBusy, setDocumentBusy] = useState(false);
  const count = flow.selected.filter(Boolean).length;
  const alreadyImported = flow.documents.some((document) => document.fingerprint === flow.file?.fingerprint);

  async function save() {
    const result = await flow.save();
    if (!result) return;
    onImported(result.alreadyImported ? tx('这个订单已导入，没有重复添加。', 'Already imported; no plans were duplicated.')
      : tx(`已加入 ${result.added} 项安排，跳过 ${result.skipped} 项重复安排。`, `Added ${result.added} ${result.added === 1 ? 'plan' : 'plans'}; skipped ${result.skipped} duplicates.`));
    onDismiss();
  }

  async function openOriginal(document: BookingDocument) {
    setDocumentBusy(true);
    try { await Linking.openURL(await getBookingDocumentUrl(document)); }
    catch { flow.setError(tx('无法打开原件，请重试。', 'Could not open the original. Please retry.')); }
    finally { setDocumentBusy(false); }
  }

  async function removeOriginal() {
    if (!deleting) return;
    setDocumentBusy(true);
    flow.setError(undefined);
    try {
      await deleteBookingDocument(deleting);
      flow.setDocuments((rows) => rows.filter((row) => row.id !== deleting.id));
      setDeleting(undefined);
    } catch { flow.setError(tx('删除未完成，请重试。', 'Deletion did not finish. Please retry.')); }
    finally { setDocumentBusy(false); }
  }

  if (deleting) return <ConfirmSheet visible title={tx('删除订单原件？', 'Delete booking original?')} detail={deleting.file_name} consequence={tx('已加入的安排会保留。原件删除后无法恢复。', 'Imported plans remain. The original cannot be recovered.')} confirmLabel={tx('删除原件', 'Delete original')} onConfirm={() => void removeOriginal()} onDismiss={() => { if (!documentBusy) setDeleting(undefined); }} busy={documentBusy} error={flow.error} />;

  return <BottomSheet visible title={tx('导入订单', 'Import bookings')} onDismiss={onDismiss} dismissDisabled={Boolean(flow.busy) || documentBusy}>
    <View style={[styles.content, flow.busy && styles.disabledContent]}>
      {canEdit ? <>
        <ThemedText themeColor="textSecondary">{tx('机票或酒店 PDF／截图 · 每个文件不超过 5 MB', 'Flight or hotel PDF / screenshot · up to 5 MB per file')}</ThemedText>
        <ActionButton tone="secondary" disabled={Boolean(flow.busy)} onPress={() => void flow.chooseFile()}>{flow.file ? tx('更换文件', 'Change file') : tx('选择文件', 'Choose file')}</ActionButton>
        {flow.file ? <ThemedText type="smallBold">{flow.file.name}</ThemedText> : null}
        {flow.file && !flow.recognized && !alreadyImported ? <>
          <ThemedText type="small" themeColor="textSecondary">{tx('点击识别会将此文件发送到 Supabase 和 Google Gemini，生成可编辑预览。确认后，原件仅你可查看，安排会与同行成员共享。', 'Recognizing sends this file to Supabase and Google Gemini to create an editable preview. After confirmation, the original stays private to you; plans are shared with your trip.')}</ThemedText>
          <ActionButton busy={flow.busy === 'recognizing'} onPress={() => void flow.recognize()}>{tx('发送并识别', 'Send and recognize')}</ActionButton>
        </> : null}
        {flow.recognized && !flow.drafts.length ? <InlineNotice>{tx('没有识别到有效机票或酒店订单。请更换清晰的文件，或手动添加。', 'No flight or hotel booking found. Choose a clearer file or add the plan manually.')}</InlineNotice> : null}
        {flow.drafts.length ? <>
          <ThemedText type="smallBold">{tx('检查后加入行程', 'Review before adding')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{tx(`请核对原订单。时间线将按 ${trip.defaultTimeZone} 显示；日期需在 ${trip.startsOn} 至 ${trip.endsOn} 内。`, `Check against the original. The timeline uses ${trip.defaultTimeZone}; bookings must fit ${trip.startsOn} to ${trip.endsOn}.`)}</ThemedText>
          {flow.drafts.map((draft, index) => <BookingDraftFields key={index} draft={draft} index={index} selected={flow.selected[index]} onToggle={() => flow.toggle(index)} onChange={(patch) => flow.update(index, patch)} />)}
          <ActionButton busy={flow.busy === 'saving'} disabled={!count} onPress={() => void save()}>{tx(`确认加入 ${count} 项安排`, `Confirm and add ${count} ${count === 1 ? 'plan' : 'plans'}`)}</ActionButton>
        </> : null}
      </> : null}
      {flow.error ? <InlineNotice tone="error">{flow.error}</InlineNotice> : null}
      {flow.documents.length ? <>
        <ThemedText type="smallBold">{tx('我的订单原件 · 仅自己可见', 'My originals · private to me')}</ThemedText>
        {flow.documents.map((document) => <SettingsGroup key={document.id}>
          <SettingsRow label={document.file_name} subtitle={tx('查看原件', 'Open original')} onPress={() => void openOriginal(document)} disabled={documentBusy} />
          <SettingsRow label={tx('删除原件', 'Delete original')} labelColor="danger" onPress={() => { flow.setError(undefined); setDeleting(document); }} disabled={documentBusy} />
        </SettingsGroup>)}
      </> : null}
    </View>
  </BottomSheet>;
}

const styles = StyleSheet.create({ content: { width: '100%', gap: Spacing.md }, disabledContent: { pointerEvents: 'none' } });
