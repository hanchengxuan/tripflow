import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chevron } from '@/components/chevron';
import { useI18n } from '@/features/i18n/i18n-provider';
import { type PlaceSuggestion, searchPlaces } from '@/features/places/place-search';
import { useTheme } from '@/hooks/use-theme';

function newSessionToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function LocationField({ value, onChange, onSelect }: { value: string; onChange: (value: string) => void; onSelect: (suggestion: PlaceSuggestion) => void }) {
  const theme = useTheme();
  const { locale, tx } = useI18n();
  const sessionToken = useRef(newSessionToken());
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (value.trim().length < 3 || !available) return;
    const timer = setTimeout(() => {
      setLoading(true);
      void searchPlaces(value, locale, sessionToken.current)
        .then(setSuggestions)
        .catch(() => {
          setSuggestions([]);
          setAvailable(false);
        })
        .finally(() => setLoading(false));
    }, 450);
    return () => clearTimeout(timer);
  }, [available, locale, value]);

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{tx('在哪里？', 'Where?')}</ThemedText>
      <View style={[styles.inputWrap, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
        <TextInput
          value={value}
          onChangeText={(next) => {
            onChange(next);
            if (!available) setAvailable(true);
          }}
          autoCorrect={false}
          placeholder={tx('搜索地点、酒店、车站或地址', 'Search places, hotels, stations, or addresses')}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
        />
        {loading ? <ActivityIndicator color="#087F6A" /> : null}
      </View>
      {value.trim().length >= 3 && suggestions.length > 0 ? (
        <View style={[styles.suggestions, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.placeId}
              accessibilityRole="button"
              onPress={() => {
                onSelect(suggestion);
                setSuggestions([]);
                sessionToken.current = newSessionToken();
              }}
              style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
              <View style={[styles.dot, { backgroundColor: '#1B70A6' }]} />
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
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#087F6A' },
  copy: { flex: 1 },
});
