import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
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

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tx('为当前安排获取智能建议', 'Get a smart suggestion for this plan')}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setOpen((current) => !current);
          setError(undefined);
        }}
        style={({ pressed }) => [styles.trigger, { borderColor: theme.borderField }, pressed && styles.pressed]}
      >
        <SparklesIcon color={theme.accent} />
        <ThemedText type="smallBold" themeColor="link">{tx('智能建议', 'Smart suggestion')}</ThemedText>
      </Pressable>

      {open ? (
        <View style={[styles.panel, { backgroundColor: theme.backgroundSubtle, borderColor: theme.border }]}>
          <View style={styles.panelHeader}>
            <View style={styles.panelTitle}>
              <ThemedText type="smallBold">{tx('调整这项安排', 'Adjust this plan')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{selectedItem.title}</ThemedText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tx('关闭智能建议', 'Close smart suggestion')} onPress={() => setOpen(false)} style={({ pressed }) => [styles.closeAction, pressed && styles.pressed]}>
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
          <ActionButton tone="primary" busy={busy} disabled={!selectedItem || !instruction.trim()} onPress={() => void generatePreview()}>
            {tx('生成预览', 'Generate preview')}
          </ActionButton>

          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          {success ? <InlineNotice>{tx('修改已保存。', 'Edit saved.')}</InlineNotice> : null}
          {proposal ? (
            <View style={[styles.preview, { backgroundColor: theme.backgroundSubtle, borderColor: theme.border }]}>
              <ThemedText type="smallBold">{tx('修改预览', 'Edit preview')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{proposal.summary}</ThemedText>
              {change && selectedItem ? (
                <View style={styles.diffList}>
                  {change.title ? <DiffRow label={tx('名称', 'Title')} before={selectedItem.title} after={change.title} /> : null}
                  {change.startsAt || change.endsAt ? <DiffRow label={tx('时间', 'Time')} before={formatZonedDateTimeRange(selectedItem.startsAt, selectedItem.endsAt, languageTag, trip.defaultTimeZone)} after={formatZonedDateTimeRange(candidate?.startsAt ?? selectedItem.startsAt, candidate?.endsAt, languageTag, trip.defaultTimeZone)} /> : null}
                  <ThemedText type="small" themeColor="textSecondary">{change.reason}</ThemedText>
                </View>
              ) : null}
              {proposal.warnings.map((warning) => <InlineNotice key={warning}>{warning}</InlineNotice>)}
              {validation?.errors.map((issue) => <InlineNotice key={`${issue.code}-${issue.itemIds.join('-')}`} tone="error">{issueCopy(issue.code, tx)}</InlineNotice>)}
              <ActionButton tone="primary" busy={applyBusy} disabled={!candidateWithEnd || Boolean(validation?.errors.length) || !change} onPress={() => void applyPreview()}>
                {tx('应用修改', 'Apply edit')}
              </ActionButton>
              <Pressable accessibilityRole="button" onPress={() => { setProposalState(undefined); setSuccess(false); }}>
                <ThemedText type="smallBold" themeColor="link" style={styles.cancel}>{tx('取消预览', 'Discard preview')}</ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SparklesIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path d="M4 20 15.5 8.5" fill="none" stroke={color} strokeLinecap="round" strokeWidth={2} />
      <Path d="m15.5 3 .8 2.2L18.5 6l-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" fill={color} />
      <Path d="m6 10 .5 1.5L8 12l-1.5.5L6 14l-.5-1.5L4 12l1.5-.5L6 10Z" fill={color} />
    </Svg>
  );
}

function DiffRow({ label, before, after }: { label: string; before: string; after: string }) {
  const theme = useTheme();
  return (
    <View style={styles.diffRow}>
      <ThemedText type="smallBold" style={{ width: 44 }}>{label}</ThemedText>
      <View style={styles.diffCopy}>
        <ThemedText type="small" themeColor="textSecondary">{before}</ThemedText>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>→ {after}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'flex-start', gap: Spacing.sm },
  trigger: { minHeight: 44, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  panel: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.md },
  panelHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md },
  panelTitle: { flex: 1, gap: 2 },
  closeAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.xs },
  input: { minHeight: 86 },
  preview: { borderWidth: 1, borderRadius: Radius.sm, padding: Spacing.md, gap: Spacing.sm },
  diffList: { gap: Spacing.sm },
  diffRow: { flexDirection: 'row', gap: Spacing.sm },
  diffCopy: { flex: 1, gap: 2 },
  cancel: { textAlign: 'center', paddingVertical: Spacing.xs },
  pressed: { opacity: 0.78 },
});
