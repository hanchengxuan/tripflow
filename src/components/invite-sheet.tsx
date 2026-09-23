import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ActionButton, ChoiceChip, InlineNotice } from '@/components/form-controls';
import { InviteQrCode } from '@/components/invite-qr';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * Inviting travellers.
 *
 * Access is chosen before the invite exists, because it is stamped into the
 * token — the chips are the one control on the panel until there is something
 * to share.
 */
export function InviteSheet({
  busy,
  error,
  expiresLabel,
  invite,
  inviteUrl,
  onDismiss,
  onGenerate,
  onRoleChange,
  onShare,
  role,
  tx,
  visible,
}: {
  busy: boolean;
  error?: string;
  expiresLabel?: string;
  invite?: { token: string; expiresAt: string };
  inviteUrl?: string;
  onDismiss: () => void;
  onGenerate: () => void;
  onRoleChange: (role: 'editor' | 'viewer') => void;
  onShare: () => void;
  role: 'editor' | 'viewer';
  tx: (zh: string, en: string) => string;
  visible: boolean;
}) {
  return (
    <BottomSheet onDismiss={onDismiss} title={tx('邀请同行者', 'Invite travellers')} visible={visible}>
      <View style={styles.body}>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        <View style={styles.roles}>
          <ChoiceChip role="radio" selected={role === 'editor'} onPress={() => onRoleChange('editor')}>{tx('可编辑', 'Can edit')}</ChoiceChip>
          <ChoiceChip role="radio" selected={role === 'viewer'} onPress={() => onRoleChange('viewer')}>{tx('仅查看', 'View only')}</ChoiceChip>
        </View>
        <ActionButton busy={busy} onPress={onGenerate}>
          {invite ? tx('重新生成邀请', 'Create a new invite') : tx('生成邀请', 'Create invite')}
        </ActionButton>
        {invite && inviteUrl ? (
          <View style={styles.generated}>
            <InviteQrCode value={inviteUrl} />
            <InlineNotice>
              {tx('邀请码', 'Invite code')}：{invite.token}{'\n'}{tx('有效期至', 'Expires')}：{expiresLabel}
            </InlineNotice>
            <ActionButton tone="secondary" onPress={onShare}>{tx('分享邀请链接', 'Share invite link')}</ActionButton>
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {tx('生成后会得到一个二维码和一段邀请码，权限已经写进邀请里。', 'You will get a QR code and an invite code; the access level is baked into the invite.')}
          </ThemedText>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { width: '100%', gap: Spacing.sm },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  generated: { gap: Spacing.sm },
});
