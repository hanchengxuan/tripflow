import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ActionButton, InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/hooks/use-theme';

export function ConfirmSheet({
  busy = false,
  confirmLabel,
  consequence,
  detail,
  error,
  onConfirm,
  onDismiss,
  title,
  tone = 'danger',
  visible,
}: {
  busy?: boolean;
  confirmLabel: string;
  consequence: string;
  detail?: string;
  error?: string;
  onConfirm: () => void;
  onDismiss: () => void;
  title: string;
  tone?: 'primary' | 'danger';
  visible: boolean;
}) {
  const theme = useTheme();
  const { tx } = useI18n();
  return (
    <BottomSheet dismissDisabled={busy} closeLabel={tx('返回', 'Back')} onDismiss={onDismiss} title={title} visible={visible}>
      <View style={styles.body}>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        {detail ? <ThemedText type="small" themeColor="textSecondary">{detail}</ThemedText> : null}
        <ThemedText type="small" themeColor="textSecondary">{consequence}</ThemedText>
        <ActionButton tone={tone} busy={busy} onPress={onConfirm}>{confirmLabel}</ActionButton>
        <View style={[styles.rule, { backgroundColor: theme.border }]} />
        <ActionButton tone="secondary" disabled={busy} onPress={onDismiss}>{tx('取消', 'Cancel')}</ActionButton>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { width: '100%', gap: Spacing.sm },
  rule: { height: StyleSheet.hairlineWidth },
});
