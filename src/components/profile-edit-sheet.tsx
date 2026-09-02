import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ActionButton, FormField } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface AvatarDraft {
  uri: string;
  mimeType?: string | null;
}

/**
 * Editing name and avatar.
 *
 * A sheet rather than a block that unfolds inside the page: the editor used to
 * push every setting below it down the screen, and the composers already
 * established that a form which takes over belongs in a sheet.
 */
export function ProfileEditSheet({
  avatarSource,
  busy,
  draftAvatar,
  draftName,
  hasChanges,
  initials,
  onChooseAvatar,
  onChangeName,
  onDismiss,
  onSave,
  tx,
  visible,
}: {
  avatarSource?: string;
  busy: boolean;
  draftAvatar?: AvatarDraft;
  draftName: string;
  hasChanges: boolean;
  initials: string;
  onChooseAvatar: () => void;
  onChangeName: (value: string) => void;
  onDismiss: () => void;
  onSave: () => void;
  tx: (zh: string, en: string) => string;
  visible: boolean;
}) {
  const theme = useTheme();
  return (
    <BottomSheet onDismiss={onDismiss} title={tx('个人资料', 'Profile')} visible={visible}>
      <View style={styles.form}>
        <Pressable
          accessibilityLabel={tx('更换头像', 'Change avatar')}
          accessibilityRole="button"
          onPress={onChooseAvatar}
          style={({ pressed }) => [styles.avatarRow, pressed && styles.pressed]}>
          <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
            {avatarSource ? (
              <Image source={{ uri: avatarSource }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <ThemedText style={[styles.initials, { color: theme.accentOnSoft }]}>{initials}</ThemedText>
            )}
          </View>
          <View style={styles.avatarCopy}>
            <ThemedText type="smallBold" themeColor="link">
              {draftAvatar ? tx('已选择新头像', 'New avatar selected') : tx('更换头像', 'Change avatar')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {tx('JPG、PNG 或 WebP，最大 5 MB。', 'JPG, PNG or WebP, up to 5 MB.')}
            </ThemedText>
          </View>
        </Pressable>

        <FormField
          label={tx('显示名称', 'Display name')}
          value={draftName}
          onChangeText={onChangeName}
          placeholder={tx('例如：小李', 'For example: Liam')}
          maxLength={80}
        />

        <ActionButton busy={busy} disabled={!draftName.trim() || !hasChanges} onPress={onSave}>
          {tx('保存更改', 'Save changes')}
        </ActionButton>
        {!hasChanges ? (
          <ThemedText type="small" themeColor="textSecondary">
            {tx('修改名称或头像后即可保存。', 'Change your name or avatar to save.')}
          </ThemedText>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', gap: Spacing.md },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  initials: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  avatarCopy: { flex: 1, minWidth: 0, gap: 2 },
  pressed: { opacity: 0.68 },
});
