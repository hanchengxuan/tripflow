import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Size, Spacing } from '@/constants/theme';
import { useI18n } from '@/features/i18n/i18n-provider';

export function PublicPageFooter({ showHome = true }: { showHome?: boolean }) {
  const { tx } = useI18n();
  return (
    <View style={styles.footer}>
      {showHome ? (
        <Link href={'/' as Href} target="_self" style={styles.link}>
          <ThemedText type="smallBold" themeColor="link">{tx('返回 TripFlow', 'Back to TripFlow')}</ThemedText>
        </Link>
      ) : null}
      <Link href={'/privacy' as Href} asChild>
        <Pressable accessibilityRole="link" style={styles.link}>
          <ThemedText type="smallBold" themeColor="link">{tx('隐私政策', 'Privacy')}</ThemedText>
        </Pressable>
      </Link>
      <Link href={'/support' as Href} asChild>
        <Pressable accessibilityRole="link" style={styles.link}>
          <ThemedText type="smallBold" themeColor="link">{tx('支持与帮助', 'Support')}</ThemedText>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg, justifyContent: 'center' },
  link: { minHeight: Size.touchMin, justifyContent: 'center' },
});
