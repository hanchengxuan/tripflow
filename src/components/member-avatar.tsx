import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function MemberAvatar({
  avatarUrl,
  displayName,
  size = 40,
}: {
  avatarUrl?: string;
  displayName: string;
  size?: number;
}) {
  const theme = useTheme();
  const initials = displayName.trim().slice(0, 2).toUpperCase() || 'TF';

  return (
    <View
      accessible={false}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.backgroundSelected,
        },
      ]}>
      {avatarUrl ? (
        <Image
          accessible={false}
          source={{ uri: avatarUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={160}
        />
      ) : (
        <ThemedText type="smallBold" style={{ color: theme.accentOnSoft }}>{initials}</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
