import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ChoiceChip, InlineNotice } from '@/components/form-controls';
import { MemberAvatar } from '@/components/member-avatar';
import { SettingsGroup, SettingsRow } from '@/components/settings-list';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { TripMember, TripRole } from '@/domain/models';

const roles: TripRole[] = ['owner', 'editor', 'viewer'];

/**
 * One traveller's access.
 *
 * This used to expand inside the traveller list, and removing them expanded
 * again inside that — pushing every row below down twice while the reader's
 * thumb was on the row they meant to press. Removal now opens its own
 * confirmation, the way every other irreversible action in the product does.
 */
export function MemberAccessSheet({
  busy,
  error,
  member,
  onDismiss,
  onRemove,
  onRoleChange,
  roleLabel,
  tx,
  visible,
}: {
  busy: boolean;
  error?: string;
  member?: TripMember;
  onDismiss: () => void;
  onRemove: () => void;
  onRoleChange: (role: TripRole) => void;
  roleLabel: (role: TripRole) => string;
  tx: (zh: string, en: string) => string;
  visible: boolean;
}) {
  if (!member) return null;
  return (
    <BottomSheet onDismiss={onDismiss} title={member.displayName} visible={visible}>
      <View style={styles.body}>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        <View style={styles.identity}>
          <MemberAvatar avatarUrl={member.avatarUrl} displayName={member.displayName} size={40} />
          <ThemedText type="small" themeColor="textSecondary">{roleLabel(member.role)}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="small" themeColor="textMuted" style={styles.label}>{tx('权限', 'Access')}</ThemedText>
          <View style={styles.roles}>
            {roles.map((role) => (
              <ChoiceChip
                key={role}
                role="radio"
                disabled={busy}
                selected={member.role === role}
                onPress={() => onRoleChange(role)}>
                {roleLabel(role)}
              </ChoiceChip>
            ))}
          </View>
        </View>

        <SettingsGroup>
          <SettingsRow label={tx('移出此行程', 'Remove from trip')} labelColor="danger" onPress={onRemove} />
        </SettingsGroup>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { width: '100%', gap: Spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  section: { gap: Spacing.xs },
  label: { fontSize: 12, lineHeight: 17, fontWeight: '700', letterSpacing: 0.6 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
});
