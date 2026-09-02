import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Radius, Size, Spacing } from '@/constants/theme';
import type { ItineraryItem, Trip } from '@/domain/models';
import {
  mergeItineraryEdit,
  suggestItineraryEdit,
  type ItineraryEditProposal,
  validateMergedItineraryEdit,
} from '@/features/ai/itinerary-edit';
import { useI18n } from '@/features/i18n/i18n-provider';
import { formatZonedDateTimeRange } from '@/lib/trip-time';
import { useTheme } from '@/hooks/use-theme';

/** The rail's gutter. The diff's label column sits on the same axis. */
const LABEL_COLUMN = 46;

interface ItineraryEditAssistantProps {
  trip: Pick<Trip, 'id' | 'startsOn' | 'endsOn' | 'defaultTimeZone'>;
  item: ItineraryItem;
  items: ItineraryItem[];
  onApply: (candidate: ItineraryItem & { endsAt: string }) => Promise<void>;
}

function issueCopy(code: 'INVALID_RANGE' | 'OUTSIDE_TRIP' | 'OVERLAP', tx: (zh: string, en: string) => string) {
  return {
    INVALID_RANGE: tx('结束时间必须晚于开始时间。', 'The end must be after the start.'),
    OUTSIDE_TRIP: tx('这项修改超出行程日期，请先调整行程范围。', 'This change is outside the trip dates. Adjust the trip range first.'),
    OVERLAP: tx('这项修改会与其他安排重叠，请先处理冲突。', 'This change overlaps another plan. Resolve the conflict first.'),
  }[code];
}

/**
 * Smart edit, inside the plan editor.
 *
 * Collapsed it is one text link, not a container with an accent rule sitting
 * inside the sheet's own surface. Open, exactly one primary action exists at a
 * time: `生成预览` until a proposal arrives, then `应用修改` — regenerating and
 * discarding drop to links so the sheet never shows two primary paths at once.
 */
export function ItineraryEditAssistant({ trip, item, items, onApply }: ItineraryEditAssistantProps) {
  const theme = useTheme();
  const { languageTag, tx } = useI18n();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [proposalState, setProposalState] = useState<{ signature: string; proposal: ItineraryEditProposal }>();
  const [busy, setBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const selectedItem = item;
  const selectedSignature = selectedItem ? [selectedItem.id, selectedItem.title, selectedItem.startsAt, selectedItem.endsAt, selectedItem.locationLabel, selectedItem.googlePlaceId].join(':') : '';
  const proposal = proposalState?.signature === selectedSignature ? proposalState.proposal : undefined;
  const change = proposal?.changes[0];
  const candidate = selectedItem && change ? mergeItineraryEdit(selectedItem, change) : undefined;
  const candidateWithEnd = candidate?.endsAt ? candidate as ItineraryItem & { endsAt: string } : undefined;
  const validation = useMemo(() => {
    if (!candidate) return undefined;
    return validateMergedItineraryEdit({ candidate, items, trip, timeZone: trip.defaultTimeZone });
  }, [candidate, items, trip]);

  const generatePreview = async () => {
    if (!selectedItem) return;
    setBusy(true);
    setError(undefined);
    setSuccess(false);
    try {
      const nextProposal = await suggestItineraryEdit({ tripId: trip.id, itemId: selectedItem.id, instruction });
      setProposalState({ signature: selectedSignature, proposal: nextProposal });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tx('智能调整暂时不可用，请稍后重试。', 'Smart edit is unavailable. Try again later.'));
    } finally {
      setBusy(false);
    }
  };

  const applyPreview = async () => {
    if (!candidateWithEnd || validation?.errors.length) return;
    setApplyBusy(true);
    setError(undefined);
    try {
      await onApply(candidateWithEnd);
      setProposalState(undefined);
      setInstruction('');
      setSuccess(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tx('保存修改失败，请稍后重试。', 'Could not save the edit. Try again later.'));
    } finally {
      setApplyBusy(false);
    }
  };

  function discardPreview() {
    setProposalState(undefined);
    setSuccess(false);
  }

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tx('为当前安排获取智能建议', 'Get a smart suggestion for this plan')}
        accessibilityState={{ expanded: false }}
        onPress={() => {
          setOpen(true);
          setError(undefined);
        }}
        style={({ pressed }) => [styles.collapsed, pressed && styles.pressed]}>
        <ThemedText type="smallBold" themeColor="link">{tx('智能调整这项安排', 'Smart-edit this plan')}</ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundSubtle }]}>
      <View style={styles.panelHeader}>
        <ThemedText type="smallBold" style={styles.panelTitle} numberOfLines={2}>
          {tx('智能调整 · ', 'Smart edit · ') + selectedItem.title}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('关闭智能建议', 'Close smart suggestion')}
          hitSlop={6}
          onPress={() => setOpen(false)}
          style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="link">{tx('关闭', 'Close')}</ThemedText>
        </Pressable>
      </View>

      <FormField
        label={tx('想怎么改？', 'What should change?')}
        value={instruction}
        onChangeText={(value) => { setInstruction(value); setProposalState(undefined); setError(undefined); setSuccess(false); }}
        placeholder={tx('例如：改到博物馆结束后，18:30 开始', 'For example: move it to after the museum, starting at 6:30 pm')}
        multiline
        maxLength={500}
        textAlignVertical="top"
        style={styles.input}
      />

      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {success ? <InlineNotice>{tx('修改已保存。', 'Edit saved.')}</InlineNotice> : null}

      {proposal ? (
        <>
          <View style={styles.preview}>
            <ThemedText type="smallBold">{tx('修改预览', 'Edit preview')}</ThemedText>
            <ThemedText style={styles.previewSummary} themeColor="textSecondary">{proposal.summary}</ThemedText>
            {change && selectedItem ? (
              <View style={styles.diffList}>
                {change.title ? <DiffRow label={tx('名称', 'Title')} before={selectedItem.title} after={change.title} /> : null}
                {change.startsAt || change.endsAt ? (
                  <DiffRow
                    label={tx('时间', 'Time')}
                    before={formatZonedDateTimeRange(selectedItem.startsAt, selectedItem.endsAt, languageTag, trip.defaultTimeZone)}
                    after={formatZonedDateTimeRange(candidate?.startsAt ?? selectedItem.startsAt, candidate?.endsAt, languageTag, trip.defaultTimeZone)}
                  />
                ) : null}
                <ThemedText style={styles.previewSummary} themeColor="textSecondary">{change.reason}</ThemedText>
              </View>
            ) : null}
          </View>
          {proposal.warnings.map((warning) => <InlineNotice key={warning}>{warning}</InlineNotice>)}
          {validation?.errors.map((issue) => <InlineNotice key={`${issue.code}-${issue.itemIds.join('-')}`} tone="error">{issueCopy(issue.code, tx)}</InlineNotice>)}
          <ActionButton tone="primary" busy={applyBusy} disabled={!candidateWithEnd || Boolean(validation?.errors.length) || !change} onPress={() => void applyPreview()}>
            {tx('应用修改', 'Apply edit')}
          </ActionButton>
          <View style={styles.secondaryActions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              hitSlop={6}
              onPress={() => void generatePreview()}
              style={({ pressed }) => [styles.headerAction, (pressed || busy) && styles.pressed]}>
              <ThemedText type="smallBold" themeColor="link">
                {busy ? tx('生成中…', 'Generating…') : tx('重新生成', 'Regenerate')}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              hitSlop={6}
              onPress={discardPreview}
              style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
              <ThemedText type="smallBold" themeColor="link">{tx('放弃预览', 'Discard preview')}</ThemedText>
            </Pressable>
          </View>
        </>
      ) : (
        <ActionButton tone="primary" busy={busy} disabled={!selectedItem || !instruction.trim()} onPress={() => void generatePreview()}>
          {tx('生成预览', 'Generate preview')}
        </ActionButton>
      )}

      <ThemedText style={styles.caption} themeColor="textMuted">
        {tx('确认后才会保存，随时可以撤回。', 'Nothing is saved until you confirm, and the edit stays reversible.')}
      </ThemedText>
    </View>
  );
}

function DiffRow({ label, before, after }: { label: string; before: string; after: string }) {
  const theme = useTheme();
  const { tx } = useI18n();
  return (
    <View style={styles.diffRow}>
      <ThemedText style={styles.diffLabel} themeColor="textSecondary">{label}</ThemedText>
      <View style={styles.diffCopy}>
        <ThemedText style={styles.diffBefore} themeColor="textMuted">{before}</ThemedText>
        <ThemedText style={[styles.diffAfter, { color: theme.accent }]}>
          {tx('改为 ', 'to ') + after}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsed: { minHeight: Size.touchMin, justifyContent: 'center' },
  panel: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  panelHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  panelTitle: { flex: 1, minWidth: 0 },
  headerAction: { minHeight: Size.touchMin, justifyContent: 'center', paddingHorizontal: Spacing['2xs'] },
  input: { minHeight: 66 },
  preview: { gap: Spacing['2xs'] },
  previewSummary: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  diffList: { gap: Spacing.xs, paddingTop: Spacing['2xs'] },
  diffRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  diffLabel: { width: LABEL_COLUMN, flexGrow: 0, flexShrink: 0, flexBasis: 'auto', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  diffCopy: { flex: 1, minWidth: 0, gap: 2 },
  diffBefore: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  diffAfter: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  secondaryActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.lg },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '500', textAlign: 'center' },
  pressed: { opacity: 0.68 },
});
