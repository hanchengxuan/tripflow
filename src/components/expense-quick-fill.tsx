import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { VoiceRecordingControl } from '@/components/voice-recording-control';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ExpenseQuickFill({ text, onChangeText, onFill, onAudioReady, busy, processing = false, tx }: {
  text: string;
  onChangeText: (value: string) => void;
  onFill: () => Promise<void>;
  onAudioReady: (audioBase64: string, audioMimeType: string) => Promise<void>;
  busy: boolean;
  processing?: boolean;
  tx: (zh: string, en: string) => string;
}) {
  const theme = useTheme();
  const label = tx('AI 快速填入', 'AI quick fill');
  return (
    <VoiceRecordingControl
      disabled={busy}
      label={tx('语音记账', 'Record an expense')}
      permissionMessage={tx('需要麦克风权限才能语音记账。', 'Microphone permission is required for voice expenses.')}
      recordingLabel={tx('结束录音并填入', 'Finish recording and fill')}
      processingLabel={tx('解析中…', 'Processing…')}
      failureMessage={tx('无法处理录音，请重试或改用文字。', 'Could not process the recording. Try again or use text.')}
      onAudioReady={onAudioReady}
      render={(voiceButton, feedback, voiceActive) => {
        const canFill = Boolean(text.trim()) && !busy && !voiceActive;
        return (
          <View style={styles.root}>
            <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
            <View style={[styles.inputBar, { backgroundColor: theme.backgroundElement, borderColor: theme.borderField }]}>
              <TextInput
                nativeID="expense-quick-fill"
                accessibilityLabel={label}
                editable={!busy && !voiceActive}
                value={text}
                onChangeText={onChangeText}
                placeholder={tx('例如：晚餐 860 港币', 'For example: Dinner 860 HKD')}
                placeholderTextColor={theme.textMuted}
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={() => { if (canFill) void onFill(); }}
                style={[styles.input, { color: theme.text }]}
              />
              {voiceButton}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx('AI 解析并填入', 'Fill with AI')}
                accessibilityState={{ disabled: !canFill, busy: processing && !voiceActive }}
                disabled={!canFill}
                onPress={() => void onFill()}
                style={({ pressed }) => [styles.fillButton, { backgroundColor: theme.backgroundSubtle }, (!canFill || pressed) && styles.dimmed]}>
                {processing && !voiceActive ? <ActivityIndicator color={theme.textSecondary} /> : (
                  <SymbolView name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} size={18} tintColor={theme.text} />
                )}
              </Pressable>
            </View>
            {feedback}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.xs },
  inputBar: { minHeight: Size.control, flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'], borderWidth: 1, borderRadius: Radius.sm, padding: Spacing['2xs'] },
  input: { flex: 1, minWidth: 0, minHeight: Size.touchMin, paddingHorizontal: Spacing.xs, paddingVertical: Spacing.xs, fontSize: 16, lineHeight: 24 },
  fillButton: { width: Size.touchMin, height: Size.touchMin, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  dimmed: { opacity: 0.55 },
});
