import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { MemberAvatar } from '@/components/member-avatar';
import { SettingsDivider, SettingsGroup, SettingsRow } from '@/components/settings-list';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Trip, TripMember } from '@/domain/models';

/**
 * Managing the current trip.
 *
 * Everything the Trips page used to unfold in place — the facts, the traveller
 * list, invites, deletion — reads here as the one settings row Me established:
 * a trailing value means the row opens nothing, a chevron means it does. Each
 * action that needs a form or a confirmation opens its own panel rather than
 * growing inside this one.
 */
export function TripManageSheet({
  canEdit,
  currentUserId,
  isOwner,
  members,
  onDelete,
  onDismiss,
  onEdit,
  onInvite,
  onMember,
  roleLabel,
  trip,
  tripRange,
  tx,
  visible,
}: {
  canEdit: boolean;
  currentUserId?: string;
  isOwner: boolean;
  members: TripMember[];
  onDelete?: () => void;
  onDismiss: () => void;
  onEdit: () => void;
  onInvite: () => void;
  onMember: (userId: string) => void;
  roleLabel: (role: TripMember['role']) => string;
  trip: Trip;
  tripRange: string;
  tx: (zh: string, en: string) => string;
  visible: boolean;
}) {
  const myRole = members.find(({ userId }) => userId === currentUserId)?.role;

  return (
    <BottomSheet onDismiss={onDismiss} title={trip.name} visible={visible}>
      <View style={styles.body}>
        <SettingsGroup label={tx('行程资料', 'Trip details')}>
          {/* The range is localized here, the way Trips already states one in
              its own list, rather than the two raw ISO dates this panel used. */}
          <SettingsRow label={tx('日期', 'Dates')} value={tripRange} />
          <SettingsDivider />
          <SettingsRow label={tx('记账币种', 'Home currency')} value={trip.homeCurrency} />
          <SettingsDivider />
          <SettingsRow label={tx('时区', 'Time zone')} value={trip.defaultTimeZone} />
          <SettingsDivider />
          <SettingsRow label={tx('我的权限', 'My access')} value={myRole ? roleLabel(myRole) : '—'} />
          {canEdit ? (
            <>
              <SettingsDivider />
              <SettingsRow label={tx('编辑行程资料', 'Edit trip details')} onPress={onEdit} />
            </>
          ) : null}
        </SettingsGroup>

        <View style={styles.group}>
          <View style={styles.groupHead}>
            <ThemedText type="small" themeColor="textMuted" style={styles.groupLabel}>{tx('同行者', 'Travellers')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{tx(`${members.length} 人`, `${members.length} people`)}</ThemedText>
          </View>
          <SettingsGroup>
            {members.map((member, index) => {
              const self = member.userId === currentUserId;
              return (
                <View key={member.userId}>
                  {index > 0 ? <SettingsDivider /> : null}
                  <SettingsRow
                    label={self ? tx(`${member.displayName}（你）`, `${member.displayName} (you)`) : member.displayName}
                    leading={<MemberAvatar avatarUrl={member.avatarUrl} displayName={member.displayName} size={32} />}
                    value={roleLabel(member.role)}
                    onPress={isOwner && !self ? () => onMember(member.userId) : undefined}
                  />
                </View>
              );
            })}
            {isOwner ? (
              <>
                <SettingsDivider />
                <SettingsRow label={tx('邀请同行者', 'Invite travellers')} onPress={onInvite} />
              </>
            ) : null}
          </SettingsGroup>
        </View>

        {onDelete ? (
          <SettingsGroup>
            <SettingsRow label={tx('删除行程', 'Delete trip')} labelColor="danger" onPress={onDelete} />
          </SettingsGroup>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { width: '100%', gap: Spacing.md },
  group: { gap: Spacing.xs },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
  groupLabel: { fontSize: 12, lineHeight: 17, fontWeight: '700', letterSpacing: 0.6, paddingHorizontal: Spacing['2xs'] },
});
