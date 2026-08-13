import { Link, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useI18n } from '@/features/i18n/i18n-provider';

export function PublicPageFooter() {
  const { tx } = useI18n();
  return (
    <View style={styles.footer}>
      <Link href={'/' as Href} target="_self"><ThemedText type="linkPrimary">{tx('返回 TripFlow', 'Back to TripFlow')}</ThemedText></Link>
      <Link href={'/privacy' as Href} asChild><ThemedText type="linkPrimary">{tx('隐私政策', 'Privacy')}</ThemedText></Link>
      <Link href={'/support' as Href} asChild><ThemedText type="linkPrimary">{tx('支持与帮助', 'Support')}</ThemedText></Link>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, justifyContent: 'center', marginTop: 8 },
});
