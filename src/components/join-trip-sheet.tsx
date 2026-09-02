import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { InviteQrScanner } from '@/components/invite-qr';
import { Spacing } from '@/constants/theme';

const INVITE_CODE_LENGTH = 48;

/** Joining someone else's trip: scan the code, or paste it. */
export function JoinTripSheet({
  busy,
  code,
  error,
  notice,
  onChangeCode,
  onDismiss,
  onScanned,
  onSubmit,
  onToggleScanner,
  scanning,
  tx,
  visible,
}: {
  busy: boolean;
  code: string;
  error?: string;
  notice?: string;
  onChangeCode: (value: string) => void;
  onDismiss: () => void;
  onScanned: (token: string) => void;
  onSubmit: () => void;
  onToggleScanner: () => void;
  scanning: boolean;
  tx: (zh: string, en: string) => string;
  visible: boolean;
}) {
  return (
    <BottomSheet onDismiss={onDismiss} title={tx('加入行程', 'Join a trip')} visible={visible}>
      <View style={styles.body}>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        {notice ? <InlineNotice>{notice}</InlineNotice> : null}
        <ActionButton tone="secondary" onPress={onToggleScanner}>
          {scanning ? tx('关闭扫码', 'Close scanner') : tx('扫描二维码', 'Scan QR code')}
        </ActionButton>
        {scanning ? <InviteQrScanner tx={tx} onToken={onScanned} /> : null}
        <FormField
          label={tx('邀请码', 'Invite code')}
          value={code}
          onChangeText={onChangeCode}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={tx('粘贴邀请码', 'Paste invite code')}
        />
        <ActionButton busy={busy} disabled={code.trim().length !== INVITE_CODE_LENGTH} onPress={onSubmit}>
          {tx('确认加入', 'Join trip')}
        </ActionButton>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { width: '100%', gap: Spacing.sm },
});
