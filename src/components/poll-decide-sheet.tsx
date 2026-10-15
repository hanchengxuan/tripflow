import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { InlineNotice } from '@/components/form-controls';
import { ListDivider, ListSurface } from '@/components/list-surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { TripPoll } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { tallyPoll } from '@/features/polls/poll-state';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/user-error';

interface PollDecideSheetProps {
  poll?: TripPoll;
  currentUserId: string;
  onDismiss: () => void;
  onDecide: (pollId: string, optionId: string) => Promise<void>;
  onDelete: (pollId: string) => Promise<void>;
}

export function PollDecideSheet({ poll, currentUserId, onDismiss, onDecide, onDelete }: PollDecideSheetProps) {
  const theme = useTheme();
  const { locale, tx } = useI18n();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string>();
  const tally = poll ? tallyPoll(poll, currentUserId) : undefined;

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      setConfirmDelete(false);
      onDismiss();
    } catch (caught) {
      setError(toUserMessage(caught, fallback, locale));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet title={tx('选定结果', 'Pick the result')} visible={Boolean(poll)} onDismiss={() => { setConfirmDelete(false); onDismiss(); }} dismissDisabled={busy}>
      {poll && tally ? (
        <View style={styles.body}>
          <ThemedText type="smallBold">{poll.question}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{tx('选定后投票结束，大家都会看到结果。', 'Picking a result ends the vote and shows it to everyone.')}</ThemedText>
          <ListSurface>
            {tally.options.map((option, index) => (
              <View key={option.id}>
                {index > 0 ? <ListDivider /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tx(`选定 ${option.label}，${option.count} 票`, `Pick ${option.label}, ${option.count} votes`)}
                  disabled={busy}
                  onPress={() => void run(() => onDecide(poll.id, option.id), tx('选定失败，请稍后重试。', 'Could not save the result. Try again later.'))}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <ThemedText style={styles.grow}>{option.label}</ThemedText>
                  {tally.leaderIds.includes(option.id) ? <ThemedText type="small" style={{ color: theme.accent }}>{tx('票数最多', 'Most votes')}</ThemedText> : null}
                  <ThemedText type="smallBold">{tx(`${option.count} 票`, `${option.count} ${option.count === 1 ? 'vote' : 'votes'}`)}</ThemedText>
                </Pressable>
              </View>
            ))}
          </ListSurface>
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
          {confirmDelete ? (
            <View style={styles.confirm}>
              <ThemedText type="small">{tx('删除后投票和所有选择都会消失。', 'Deleting removes the poll and every vote.')}</ThemedText>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(() => onDelete(poll.id), tx('删除失败，请稍后重试。', 'Could not delete the poll. Try again later.'))} style={styles.textAction}>
                <ThemedText type="smallBold" style={{ color: theme.danger }}>{tx('确认删除', 'Delete poll')}</ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmDelete(true)} style={styles.textAction}>
              <ThemedText type="smallBold" style={{ color: theme.danger }}>{tx('删除这个投票', 'Delete this poll')}</ThemedText>
            </Pressable>
          )}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md },
  grow: { flex: 1 },
  confirm: { gap: Spacing.xs, alignItems: 'center' },
  textAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'center' },
  pressed: { opacity: 0.7 },
});
