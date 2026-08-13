import { StyleSheet, View } from 'react-native';

export function Chevron({ color, direction = 'right' }: { color: string; direction?: 'right' | 'down' }) {
  return (
    <View accessibilityElementsHidden style={[styles.frame, direction === 'down' && styles.down]}>
      <View style={[styles.stroke, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  down: { transform: [{ rotate: '-45deg' }] },
  stroke: { width: 8, height: 8, borderRightWidth: 1.5, borderBottomWidth: 1.5, transform: [{ rotate: '-45deg' }] },
});
