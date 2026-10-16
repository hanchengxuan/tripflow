import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ChatActionCard } from '@/components/chat-action-card';
import { InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { VoiceRecordingControl } from '@/components/voice-recording-control';
import { Radius, Size, Spacing } from '@/constants/theme';
import { proposalsFromReply, sendTripChat, transcribeTripChat, type TripChatMessage, type TripChatProposal } from '@/features/ai/trip-chat';
import { useI18n } from '@/features/i18n/i18n-provider';
import { captureReceiptPhoto, type ReceiptPhotoResult } from '@/features/ledger/receipt-photo';
import { useMvp } from '@/features/mvp/mvp-provider';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/user-error';

type Turn = TripChatMessage & { id: number; imageUri?: string; proposals?: TripChatProposal[] };
type Photo = Extract<ReceiptPhotoResult, { status: 'ok' }>['receipt'];

export function TripChatSheet({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const theme = useTheme();
  const { locale, tx } = useI18n();
  const { activeTrip, itineraryItems, members } = useMvp();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [photo, setPhoto] = useState<Photo>();
  const nextId = useRef(0);
  const suggestions = [
    { icon: '🕒', text: tx('下一项是什么？', "What's next?") },
    { icon: '✏️', text: tx('午饭推迟半小时', 'Move lunch 30 min later') },
    { icon: '💴', text: tx('打车 2400 日元，我付的', 'Taxi 2400 yen, I paid') },
  ];

  const pickPhoto = async (source: 'camera' | 'library') => {
    setError(undefined);
    try {
      const result = await captureReceiptPhoto(source);
      if (result.status === 'ok') setPhoto(result.receipt);
      else if (result.status === 'permission-denied') setError(tx('需要相机权限才能拍照。', 'Allow camera access to take a photo.'));
      else if (result.status === 'too-large') setError(tx('照片太大，请换一张。', 'That photo is too large. Try another.'));
    } catch {
      setError(tx('没能读取这张照片，请换一张。', "Couldn't read that photo. Try another."));
    }
  };

  const send = async (message: string) => {
    const attached = photo;
    const content = message.trim() || (attached ? tx('帮我看看这张图', 'Take a look at this photo') : '');
    if (!activeTrip || !content || busy) return;
    nextId.current += 2;
    const turnId = nextId.current;
    const history: Turn[] = [...turns, { id: turnId, role: 'user', text: message.trim(), imageUri: attached?.uri }];
    setTurns(history);
    setDraft('');
    setPhoto(undefined);
    setBusy(true);
    setError(undefined);
    try {
      const reply = await sendTripChat({
        tripId: activeTrip.id,
        messages: history.map(({ id, role, text }) => ({ role, text: id === turnId ? content : text })).filter(({ text }) => text),
        image: attached ? { base64: attached.base64, mimeType: attached.mimeType ?? 'image/jpeg' } : undefined,
        planIds: itineraryItems.map(({ id }) => id),
        memberIds: members.map(({ userId }) => userId),
        locale,
      });
      const proposals = proposalsFromReply(reply.actions, itineraryItems);
      const text = reply.answer || (proposals.length ? tx('这样改可以吗？', 'How about this?') : '');
      setTurns((current) => [...current, { id: turnId + 1, role: 'assistant', text, proposals }]);
    } catch (caught) {
      setError(toUserMessage(caught, tx('小途暂时走神了，请稍后再试。', 'Tabi is unavailable right now. Try again later.'), locale));
      if (attached) setPhoto(attached);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (turnId: number, index: number, status: TripChatProposal['status']) => setTurns((current) => current.map((turn) => turn.id !== turnId ? turn : {
    ...turn,
    proposals: turn.proposals?.map((proposal, proposalIndex) => proposalIndex === index ? { ...proposal, status } : proposal),
  }));

  return (
    <BottomSheet title={tx('小途', 'Tabi')} visible={visible} onDismiss={onDismiss}>
      <View style={styles.body}>
        {turns.length === 0 ? (
          <View style={styles.intro}>
            <ThemedText type="smallBold">{tx('嗨，我是小途 👋', "Hi, I'm Tabi 👋")}</ThemedText>
            <View style={styles.chips}>
              {suggestions.map(({ icon, text }) => (
                <Pressable
                  key={text}
                  accessibilityRole="button"
                  accessibilityLabel={text}
                  disabled={busy}
                  onPress={() => void send(text)}
                  style={({ pressed }) => [styles.chip, { backgroundColor: theme.backgroundSubtle }, pressed && styles.dimmed]}>
                  <ThemedText type="small">{icon}  {text}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {turns.map((turn) => (
          <View key={turn.id} style={[styles.turn, turn.role === 'user' ? styles.userTurn : styles.assistantTurn]}>
            {turn.imageUri ? <Image accessibilityLabel={tx('你发的照片', 'Your photo')} source={turn.imageUri} style={styles.sentPhoto} contentFit="cover" /> : null}
            {turn.text ? (
              <View style={[styles.bubble, { backgroundColor: turn.role === 'user' ? theme.accentSoft : theme.backgroundSubtle }]}>
                <ThemedText type="small">{turn.text}</ThemedText>
              </View>
            ) : null}
            {turn.proposals?.map((proposal, index) => (
              <ChatActionCard key={`${turn.id}-${index}`} proposal={proposal} onStatus={(status) => setStatus(turn.id, index, status)} />
            ))}
          </View>
        ))}
        {busy ? <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">{tx('小途在想…', 'Tabi is thinking…')}</ThemedText> : null}
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

        <VoiceRecordingControl
          disabled={busy}
          label={tx('语音输入', 'Dictate')}
          recordingLabel={tx('正在听', 'Listening')}
          processingLabel={tx('正在转文字…', 'Transcribing…')}
          cancelLabel={tx('取消录音', 'Cancel recording')}
          permissionMessage={tx('需要麦克风权限才能语音输入。', 'Allow microphone access to dictate.')}
          failureMessage={tx('没听清，请再说一次或直接打字。', "Didn't catch that. Try again or type instead.")}
          onAudioReady={async (audioBase64, audioMimeType) => {
            if (!activeTrip) return;
            const transcript = await transcribeTripChat({ tripId: activeTrip.id, audioBase64, audioMimeType });
            setDraft((current) => [current.trim(), transcript].filter(Boolean).join(' '));
          }}
          render={(micButton, feedback, voiceActive, cancel) => (
            <>
              {photo && !voiceActive ? (
                <View style={styles.preview}>
                  <Image accessibilityLabel={tx('待发送的照片', 'Photo to send')} source={photo.uri} style={styles.previewPhoto} contentFit="cover" />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={tx('移除照片', 'Remove photo')}
                    hitSlop={8}
                    onPress={() => setPhoto(undefined)}
                    style={[styles.removePhoto, { backgroundColor: theme.text }]}>
                    <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={12} tintColor={theme.background} />
                  </Pressable>
                </View>
              ) : null}
              {voiceActive ? (
                <View style={[styles.inputBar, { backgroundColor: theme.backgroundElement, borderColor: theme.danger }]}>
                  {cancel}
                  <View style={styles.listening}>
                    {cancel ? <View style={[styles.dot, { backgroundColor: theme.danger }]} /> : null}
                    {feedback}
                  </View>
                  {micButton}
                </View>
              ) : (
                <View style={[styles.inputBar, { backgroundColor: theme.backgroundElement, borderColor: theme.borderField }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={tx('拍照', 'Take a photo')}
                    disabled={busy}
                    onPress={() => void pickPhoto(Platform.OS === 'web' ? 'library' : 'camera')}
                    style={({ pressed }) => [styles.send, { backgroundColor: theme.accent }, (busy || pressed) && styles.dimmed]}>
                    <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} size={18} tintColor={theme.textOnAccent} />
                  </Pressable>
                  <TextInput
                    accessibilityLabel={tx('给小途发消息', 'Message Tabi')}
                    value={draft}
                    onChangeText={setDraft}
                    editable={!busy}
                    placeholder={tx('跟小途说…', 'Message Tabi…')}
                    placeholderTextColor={theme.textMuted}
                    maxLength={600}
                    returnKeyType="send"
                    onSubmitEditing={() => void send(draft)}
                    style={[styles.input, { color: theme.text }]}
                  />
                  {draft.trim() || photo ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={tx('发送', 'Send')}
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={() => void send(draft)}
                      style={({ pressed }) => [styles.send, { backgroundColor: theme.accent }, (busy || pressed) && styles.dimmed]}>
                      <SymbolView name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} size={18} tintColor={theme.textOnAccent} />
                    </Pressable>
                  ) : (
                    <>
                      {micButton}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={tx('从相册选照片', 'Choose a photo')}
                        disabled={busy}
                        onPress={() => void pickPhoto('library')}
                        style={({ pressed }) => [styles.send, (busy || pressed) && styles.dimmed]}>
                        <SymbolView name={{ ios: 'photo.on.rectangle', android: 'image', web: 'image' }} size={20} tintColor={theme.text} />
                      </Pressable>
                    </>
                  )}
                </View>
              )}
              {voiceActive ? null : feedback}
            </>
          )}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md },
  intro: { gap: Spacing.sm },
  chips: { gap: Spacing.sm, alignItems: 'flex-start' },
  chip: { minHeight: 40, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  turn: { gap: Spacing.xs, maxWidth: '92%' },
  userTurn: { alignSelf: 'flex-end' },
  assistantTurn: { alignSelf: 'flex-start', width: '92%' },
  bubble: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  inputBar: { minHeight: Size.control, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, borderWidth: 1, borderRadius: Radius.pill, padding: Spacing['2xs'] },
  input: { flex: 1, minWidth: 0, minHeight: Size.touchMin, paddingHorizontal: Spacing.xs, fontSize: 16 },
  send: { width: Size.touchMin, height: Size.touchMin, borderRadius: Size.touchMin / 2, alignItems: 'center', justifyContent: 'center' },
  listening: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sentPhoto: { width: 160, height: 200, borderRadius: Radius.md },
  preview: { alignSelf: 'flex-start' },
  previewPhoto: { width: 72, height: 72, borderRadius: Radius.md },
  removePhoto: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dimmed: { opacity: 0.55 },
});
