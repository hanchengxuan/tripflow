import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chevron } from '@/components/chevron';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { PlaceSuggestion } from '@/features/places/place-search';
import { usePlaceSuggestions } from '@/features/places/use-place-suggestions';
import { useTheme } from '@/hooks/use-theme';

export function LocationField({ value, onChange, onSelect }: { value: string; onChange: (value: string) => void; onSelect: (suggestion: PlaceSuggestion) => void }) {
  const theme = useTheme();
  const { locale, tx } = useI18n();
  const search = usePlaceSuggestions(value, locale);

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{tx('在哪里？', 'Where?')}</ThemedText>
      <View style={[styles.inputWrap, { backgroundColor: theme.backgroundElement, borderColor: theme.borderField }]}>
        <TextInput
          accessibilityLabel={tx('在哪里？', 'Where?')}
          value={value}
          onChangeText={(next) => {
            onChange(next);
            search.change(next);
          }}
          autoCorrect={false}
          placeholder={tx('搜索地点、酒店、车站或地址', 'Search places, hotels, stations, or addresses')}
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text }]}
        />
        {search.loading ? <ActivityIndicator color={theme.accent} /> : null}
      </View>
      {search.failed ? <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">{tx('地点搜索暂时不可用，可继续输入地址，或修改文字重试。', 'Place search is unavailable. Keep the address, or edit to retry.')}</ThemedText> : null}
      {value.trim().length >= 3 && search.suggestions.length > 0 ? (
        <View style={[styles.suggestions, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {search.suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.placeId}
              accessibilityRole="button"
              onPress={() => {
                onSelect(suggestion);
                search.select();
              }}
              style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
              <View style={[styles.dot, { backgroundColor: theme.info }]} />
              <View style={styles.copy}>
                <ThemedText type="smallBold">{suggestion.mainText}</ThemedText>
                {suggestion.secondaryText ? <ThemedText type="small" themeColor="textSecondary">{suggestion.secondaryText}</ThemedText> : null}
              </View>
              <Chevron color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6, zIndex: 2 },
  inputWrap: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minHeight: 46, fontSize: 16 },
  suggestions: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  suggestion: { minHeight: 54, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pressed: { opacity: 0.65 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  copy: { flex: 1 },
});
