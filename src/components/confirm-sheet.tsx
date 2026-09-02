import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ActionButton, InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/hooks/use-theme';

/**
 * How an irreversible action asks, everywhere in the product.
 *
 * The shape follows Apple's action-sheet guidance: the consequence stated once,
 * the destructive action prominent, 取消 last and separated by a hairline — and
 * the panel never scrolls. It replaced four different confirmations, each of
 * which used to grow inside the surface it was confirming and push whatever sat
 * below it out from under the reader's thumb.
 *
 * `detail` is the thing being acted on, stated in its own terms — a plan's time
 * and place, a trip's range and traveller count — so the reader can tell they
 * are about to delete the right one.
 */
export function ConfirmSheet({
  busy = false,
  confirmLabel,
  consequence,
  detail,
  error,
  onConfirm,
  onDismiss,
  title,
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
  visible: boolean;
}) {
  const theme = useTheme();
  const { tx } = useI18n();
  return (
    <BottomSheet closeLabel={tx('返回', 'Back')} onDismiss={onDismiss} title={title} visible={visible}>
      <View style={styles.body}>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        {detail ? <ThemedText type="small" themeColor="textSecondary">{detail}</ThemedText> : null}
        <ThemedText type="small" themeColor="textSecondary">{consequence}</ThemedText>
        <ActionButton tone="danger" busy={busy} onPress={onConfirm}>{confirmLabel}</ActionButton>
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
