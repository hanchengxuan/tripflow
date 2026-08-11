import { Link, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export function PublicPageFooter() {
  return (
    <View style={styles.footer}>
      <Link href={'/' as Href} asChild><ThemedText type="linkPrimary">返回 TripFlow</ThemedText></Link>
      <Link href={'/privacy' as Href} asChild><ThemedText type="linkPrimary">隐私政策</ThemedText></Link>
      <Link href={'/support' as Href} asChild><ThemedText type="linkPrimary">支持与帮助</ThemedText></Link>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, justifyContent: 'center', marginTop: 8 },
});
