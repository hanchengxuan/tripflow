import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

interface SectionHeadingProps {
  title: string;
  detail?: string;
  eyebrow?: string;
  trailing?: ReactNode;
}

/** Shared heading for operational sections; keeps copy short and hierarchy consistent. */
export function SectionHeading({ title, detail, eyebrow, trailing }: SectionHeadingProps) {
  return (
    <View style={styles.wrap}>
      {eyebrow ? <ThemedText type="smallBold" style={{ color: '#087F6A' }}>{eyebrow}</ThemedText> : null}
      <View style={styles.titleRow}>
        <ThemedText type="title" style={styles.title}>{title}</ThemedText>
        {trailing}
      </View>
      {detail ? <ThemedText type="small" themeColor="textSecondary">{detail}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 21, lineHeight: 28 },
});
