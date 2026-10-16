import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { MemberAvatar } from '@/components/member-avatar';
import type { TripMember } from '@/domain/models';
import { useTheme } from '@/hooks/use-theme';

/** Who pays whom, drawn as payer → recipient. Decorative: the row's label names both. */
export function TransferPair({ from, to, fromName, toName, size = 30 }: {
  from?: TripMember;
  to?: TripMember;
  fromName: string;
  toName: string;
  size?: number;
}) {
  const theme = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.pair}>
      <MemberAvatar avatarUrl={from?.avatarUrl} displayName={from?.displayName ?? fromName} size={size} />
      <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} size={14} tintColor={theme.textMuted} />
      <MemberAvatar avatarUrl={to?.avatarUrl} displayName={to?.displayName ?? toName} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
