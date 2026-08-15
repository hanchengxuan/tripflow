import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { ThemedText } from '@/components/themed-text';
import { destinationLabel, searchDestinations, type DestinationSuggestion } from '@/features/destinations/destination-search';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/hooks/use-theme';

export function DestinationField({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: DestinationSuggestion) => void;
}) {
  const theme = useTheme();
  const { locale, tx } = useI18n();
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const requestId = useRef(0);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2 || !available) {
      requestId.current += 1;
      return;
    }
    const id = requestId.current + 1;
    requestId.current = id;
    const timer = setTimeout(() => {
      setLoading(true);
      void searchDestinations(query, locale)
        .then((next) => {
          if (requestId.current === id) setSuggestions(next);
        })
        .catch(() => {
          if (requestId.current === id) {
            setSuggestions([]);
            setAvailable(false);
          }
        })
        .finally(() => {
          if (requestId.current === id) setLoading(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [available, locale, value]);

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <ThemedText type="smallBold">{tx('目的地', 'Destination')}</ThemedText>
        <ThemedText type="small" themeColor="textMuted">{tx('可选，用于地图和智能默认', 'Optional, powers the map and smart defaults')}</ThemedText>
      </View>
      <View style={[styles.inputWrap, { backgroundColor: theme.backgroundElement, borderColor: theme.borderField }]}>
        <TextInput
          value={value}
          onChangeText={(next) => {
            onChange(next);
            if (!available) setAvailable(true);
          }}
          autoCorrect={false}
          placeholder={tx('搜索城市或国家，例如：东京', 'Search a city or country, e.g. Tokyo')}
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text }]}
        />
        {loading ? <ActivityIndicator color={theme.accent} /> : null}
      </View>
      {value.trim().length >= 2 && suggestions.length > 0 ? (
        <View style={[styles.suggestions, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.id}
              accessibilityRole="button"
              onPress={() => {
                onSelect(suggestion);
                setSuggestions([]);
                requestId.current += 1;
              }}
              style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
              <View style={[styles.dot, { backgroundColor: theme.accent }]} />
              <View style={styles.copy}>
                <ThemedText type="smallBold">{destinationLabel(suggestion)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[suggestion.adminArea, suggestion.timeZone, suggestion.currency].filter(Boolean).join(' · ')}
                </ThemedText>
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
  field: { gap: 6, zIndex: 3 },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 },
  inputWrap: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minHeight: 46, fontSize: 16 },
  suggestions: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  suggestion: { minHeight: 60, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  copy: { flex: 1, gap: 2 },
  pressed: { opacity: 0.65 },
});
