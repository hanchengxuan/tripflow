import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface VoiceRecordingControlProps {
  disabled?: boolean;
  label: string;
  permissionMessage: string;
  recordingLabel: string;
  processingLabel: string;
  failureMessage: string;
  onAudioReady: (audioBase64: string, audioMimeType: string) => Promise<void>;
}

export function VoiceRecordingControl({
  disabled = false,
  label,
  permissionMessage,
  recordingLabel,
  processingLabel,
  failureMessage,
  onAudioReady,
}: VoiceRecordingControlProps) {
  const theme = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const state = useAudioRecorderState(recorder);
  const recordingRef = useRef(false);
  const [error, setError] = useState<string>();
  const [processing, setProcessing] = useState(false);

  useEffect(() => () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    void recorder.stop()
      .catch(() => undefined)
      .finally(() => setAudioModeAsync({ allowsRecording: false }).catch(() => undefined));
  }, [recorder]);

  async function startRecording() {
    setError(undefined);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError(permissionMessage);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingRef.current = true;
    } catch {
      setError(failureMessage);
    }
  }

  async function stopAndSend() {
    setProcessing(true);
    setError(undefined);
    recordingRef.current = false;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (!recorder.uri) throw new Error('Recording is unavailable');
      const response = await fetch(recorder.uri);
      const blob = await response.blob();
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Could not read recording'));
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.readAsDataURL(blob);
      });
      const audioMimeType = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
      await onAudioReady(audioBase64, audioMimeType);
    } catch {
      setError(failureMessage);
    } finally {
      setProcessing(false);
    }
  }

  const recording = state.isRecording;
  const busy = disabled || processing;
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={processing ? processingLabel : recording ? recordingLabel : label}
          accessibilityState={{ disabled: busy, busy: processing }}
          disabled={busy}
          onPress={() => void (recording ? stopAndSend() : startRecording())}
          style={({ pressed }) => [styles.button, { backgroundColor: recording ? theme.danger : theme.backgroundSelected }, pressed && styles.pressed, busy && styles.disabled]}>
          <SymbolView
            name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
            size={18}
            tintColor={recording ? theme.textOnAccent : theme.text}
          />
        </Pressable>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {processing ? processingLabel : recording ? `${Math.round(state.durationMillis / 1000)}s` : label}
        </ThemedText>
      </View>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.xs },
  row: { minHeight: Size.touchMin, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  button: { width: Size.touchMin, height: Size.touchMin, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.55 },
});
