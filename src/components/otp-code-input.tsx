import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const OTP_LENGTH = 8;

export function OtpCodeInput({ value, onChangeText, disabled = false }: { value: string; onChangeText: (value: string) => void; disabled?: boolean }) {
  const input = useRef<TextInput>(null);
  const theme = useTheme();
  const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);

  return (
    <Pressable
      accessibilityLabel="Verification code"
      accessibilityRole="button"
      accessibilityValue={{ text: digits }}
      disabled={disabled}
      onPress={() => input.current?.focus()}>
      <View style={styles.cells}>
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <View
            key={index}
            style={[
              styles.cell,
              { backgroundColor: theme.background, borderColor: index === digits.length ? '#087F6A' : theme.backgroundSelected },
            ]}>
            <ThemedText style={styles.digit}>{digits[index] ?? ''}</ThemedText>
          </View>
        ))}
      </View>
      <TextInput
        ref={input}
        autoComplete="one-time-code"
        caretHidden
        editable={!disabled}
        inputMode="numeric"
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        style={styles.hiddenInput}
        textContentType="oneTimeCode"
        value={digits}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cells: { flexDirection: 'row', gap: 5, width: '100%' },
  cell: { flex: 1, minWidth: 26, maxWidth: 52, aspectRatio: 0.82, borderWidth: 1.5, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  digit: { fontSize: 23, lineHeight: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
