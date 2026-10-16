import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ChatActionCard } from '@/components/chat-action-card';
import { ChoiceChip, InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Radius, Size, Spacing } from '@/constants/theme';
import { sendTripChat, type TripChatAction, type TripChatMessage } from '@/features/ai/trip-chat';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/user-error';

type Turn = TripChatMessage & { id: number; actions?: TripChatAction[] };

export function TripChatSheet({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const theme = useTheme();
  const { locale, tx } = useI18n();
  const { activeTrip, itineraryItems, members } = useMvp();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const nextId = useRef(0);
  const suggestions = [
    tx('明天第一项几点开始？', 'When does tomorrow start?'),
    tx('把午饭推迟半小时', 'Move lunch 30 minutes later'),
    tx('记一笔：打车 2400 日元，我付的', 'Taxi 2400 yen, I paid'),
  ];

  const send = async (message: string) => {
    const content = message.trim();
    if (!activeTrip || !content || busy) return;
    nextId.current += 2;
    const turnId = nextId.current;
    const history: Turn[] = [...turns, { id: turnId, role: 'user', text: content }];
    setTurns(history);
    setDraft('');
    setBusy(true);
    setError(undefined);
    try {
      const reply = await sendTripChat({
        tripId: activeTrip.id,
        messages: history.map(({ role, text }) => ({ role, text })),
        planIds: itineraryItems.map(({ id }) => id),
        memberIds: members.map(({ userId }) => userId),
      });
      const fallback = reply.actions.length ? tx('我准备了下面的修改，确认后才会保存。', 'Here is what I would change. Nothing is saved until you confirm.') : '';
      setTurns((current) => [...current, { id: turnId + 1, role: 'assistant', text: reply.answer || fallback, actions: reply.actions }]);
    } catch (caught) {
      setError(toUserMessage(caught, tx('行程助手暂时不可用，请稍后再试。', 'The trip assistant is unavailable. Try again later.'), locale));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet title={tx('行程助手', 'Trip assistant')} visible={visible} onDismiss={onDismiss}>
      <View style={styles.body}>
        {turns.length === 0 ? (
          <View style={styles.intro}>
            <ThemedText type="small" themeColor="textSecondary">
              {tx('问这趟行程的任何事，或让我帮你改安排、记一笔账。修改都要你确认后才会保存。', 'Ask anything about this trip, or have me change a plan or record an expense. Nothing is saved until you confirm.')}
            </ThemedText>
            <View style={styles.chips}>
              {suggestions.map((suggestion) => (
                <ChoiceChip key={suggestion} role="button" selected={false} disabled={busy} onPress={() => void send(suggestion)}>{suggestion}</ChoiceChip>
              ))}
            </View>
          </View>
        ) : null}

        {turns.map((turn) => (
          <View key={turn.id} style={[styles.turn, turn.role === 'user' ? styles.userTurn : styles.assistantTurn]}>
            {turn.text ? (
              <View style={[styles.bubble, { backgroundColor: turn.role === 'user' ? theme.accentSoft : theme.backgroundSubtle }]}>
                <ThemedText type="small">{turn.text}</ThemedText>
              </View>
            ) : null}
            {turn.actions?.map((action, index) => <ChatActionCard key={`${turn.id}-${index}`} action={action} />)}
          </View>
        ))}
        {busy ? <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">{tx('正在想…', 'Thinking…')}</ThemedText> : null}
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

        <View style={[styles.inputBar, { backgroundColor: theme.backgroundElement, borderColor: theme.borderField }]}>
          <TextInput
            accessibilityLabel={tx('给行程助手发消息', 'Message the trip assistant')}
            value={draft}
            onChangeText={setDraft}
            editable={!busy}
            placeholder={tx('问问题，或说要改什么', 'Ask, or say what to change')}
            placeholderTextColor={theme.textMuted}
            maxLength={600}
            returnKeyType="send"
            onSubmitEditing={() => void send(draft)}
            style={[styles.input, { color: theme.text }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx('发送', 'Send')}
            accessibilityState={{ disabled: busy || !draft.trim() }}
            disabled={busy || !draft.trim()}
            onPress={() => void send(draft)}
            style={({ pressed }) => [styles.send, { backgroundColor: theme.accent }, (busy || !draft.trim() || pressed) && styles.dimmed]}>
            <ThemedText type="smallBold" style={{ color: theme.textOnAccent }}>{tx('发送', 'Send')}</ThemedText>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md },
  intro: { gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  turn: { gap: Spacing.xs, maxWidth: '92%' },
  userTurn: { alignSelf: 'flex-end' },
  assistantTurn: { alignSelf: 'flex-start', width: '92%' },
  bubble: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  inputBar: { minHeight: Size.control, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, borderWidth: 1, borderRadius: Radius.sm, padding: Spacing['2xs'] },
  input: { flex: 1, minWidth: 0, minHeight: Size.touchMin, paddingHorizontal: Spacing.xs, fontSize: 16 },
  send: { minHeight: Size.touchMin, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  dimmed: { opacity: 0.55 },
});
