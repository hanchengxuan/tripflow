/* eslint-disable react-hooks/immutability -- Reanimated shared values are intentionally mutable in worklets. */
import worldMap from '@svg-maps/world';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Line, Path, Polyline, Rect } from 'react-native-svg';

import { Chevron } from '@/components/chevron';
import { DestinationPlaceSheet } from '@/components/destination-place-sheet';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { ItineraryItem } from '@/domain/models';
import { projectDestination } from '@/features/destinations/destination-search';
import { destinationStatus, type DestinationStatus } from '@/lib/destination-status';
import {
  clampToBounds,
  contentFit,
  frameDestinations,
  MAP_HEIGHT,
  MAP_WIDTH,
  panBounds,
} from '@/lib/map-framing';
import { useTheme } from '@/hooks/use-theme';

// The world outline is vector, so magnifying it stays crisp; a trip inside one
// country needs a lot of magnification before its cities stop overlapping.
const MAX_SCALE = 24;

interface AtlasDestination {
  key: string;
  cityName: string;
  countryName: string;
  countryCode: string;
  timeZone: string;
  currency?: string;
  items: ItineraryItem[];
  status: DestinationStatus;
  x: number;
  y: number;
}

function destinationKey(item: ItineraryItem) {
  const destination = item.destination!;
  return `${destination.countryCode}:${destination.cityName}:${destination.latitude.toFixed(3)}:${destination.longitude.toFixed(3)}`;
}

function statusLabel(status: DestinationStatus, tx: (zh: string, en: string) => string) {
  if (status === 'current') return tx('正在这里', 'Here now');
  if (status === 'visited') return tx('已去过', 'Visited');
  return tx('准备前往', 'Planned');
}

function statusColor(status: DestinationStatus, theme: ReturnType<typeof useTheme>) {
  if (status === 'current') return theme.mapRoute;
  if (status === 'visited') return theme.mapMarker;
  return theme.accent;
}

/**
 * The destination map.
 *
 * The map is the screen, not a card inside one: it takes every pixel below the
 * header, opens framed on the trip rather than on the whole world, and hands
 * the detail to a compact card pinned to its lower edge — which opens the full
 * place panel. That split is the one Apple Maps and Google's place card both
 * make, and it is why a viewport locked to the world outline's 1010:666 ratio
 * is no longer what decides how much map a reader gets.
 *
 * A legend names each status beside its colour: on the map itself a pin is
 * only a colour and a count, and status must never be carried by hue alone.
 */
export function DestinationAtlas({
  items,
  languageTag,
  tx,
  onViewItem,
  onViewPlace,
}: {
  items: ItineraryItem[];
  languageTag: string;
  tx: (zh: string, en: string) => string;
  onViewItem?: (item: ItineraryItem) => void;
  onViewPlace?: (destination: { cityName: string; items: ItineraryItem[] }) => void;
}) {
  const theme = useTheme();
  const [selectedKey, setSelectedKey] = useState<string>();
  const [placeOpen, setPlaceOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const cards = useRef<ScrollView>(null);
  const [mapOpacity] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(1));
  const mapScale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const mapTranslateX = useSharedValue(0);
  const mapTranslateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const viewportWidth = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const contentWidth = useSharedValue(0);
  const contentHeight = useSharedValue(0);

  const mapTransformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: mapTranslateX.value },
      { translateY: mapTranslateY.value },
      { scale: mapScale.value },
    ],
  }));

  // Pins ride inside the transformed map so their coordinates stay in map
  // space, but a pin is chrome, not terrain: it keeps its size at every zoom.
  const markerScaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 / mapScale.value }] }));

  const panGesture = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      panStartX.value = mapTranslateX.value;
      panStartY.value = mapTranslateY.value;
    })
    .onUpdate((event) => {
      const bounds = panBounds(
        { width: viewportWidth.value, height: viewportHeight.value },
        { width: contentWidth.value, height: contentHeight.value },
        mapScale.value,
      );
      mapTranslateX.value = Math.max(-bounds.x, Math.min(bounds.x, panStartX.value + event.translationX));
      mapTranslateY.value = Math.max(-bounds.y, Math.min(bounds.y, panStartY.value + event.translationY));
    })
    .onEnd(() => {
      mapTranslateX.value = withSpring(mapTranslateX.value);
      mapTranslateY.value = withSpring(mapTranslateY.value);
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = mapScale.value;
    })
    .onUpdate((event) => {
      const nextScale = Math.max(1, Math.min(MAX_SCALE, savedScale.value * event.scale));
      const next = clampToBounds(
        { scale: nextScale, translateX: mapTranslateX.value, translateY: mapTranslateY.value },
        { width: viewportWidth.value, height: viewportHeight.value },
        { width: contentWidth.value, height: contentHeight.value },
      );
      mapScale.value = next.scale;
      mapTranslateX.value = next.translateX;
      mapTranslateY.value = next.translateY;
    })
    .onEnd(() => {
      mapScale.value = withSpring(mapScale.value);
      mapTranslateX.value = withSpring(mapTranslateX.value);
      mapTranslateY.value = withSpring(mapTranslateY.value);
    });

  const mapGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(clock);
  }, []);

  const destinations = useMemo<AtlasDestination[]>(() => {
    const grouped = new Map<string, ItineraryItem[]>();
    for (const item of items) {
      if (!item.destination) continue;
      const key = destinationKey(item);
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return [...grouped.entries()].map(([key, groupedItems]) => {
      const destination = groupedItems[0].destination!;
      const point = projectDestination(destination.latitude, destination.longitude);
      return {
        key,
        cityName: destination.cityName,
        countryName: destination.countryName,
        countryCode: destination.countryCode,
        timeZone: destination.timeZone,
        currency: destination.currency,
        items: groupedItems.sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
        status: destinationStatus(groupedItems, now),
        ...point,
      };
    }).sort((left, right) => left.items[0].startsAt.localeCompare(right.items[0].startsAt));
  }, [items, now]);

  const selected = destinations.find(({ key }) => key === selectedKey) ?? destinations[0];
  const content = useMemo(() => contentFit(viewport), [viewport]);
  // Keyed on the coordinates rather than on `destinations`, whose identity
  // changes every minute when the clock ticks. Without that the opening frame
  // would be re-applied on the minute and snap a reader's pan away.
  const placeKey = destinations.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join('|');
  const opening = useMemo(
    () => frameDestinations(
      placeKey ? placeKey.split('|').map((pair) => {
        const [x, y] = pair.split(',');
        return { x: Number(x), y: Number(y) };
      }) : [],
      viewport,
      content,
      { maxScale: MAX_SCALE },
    ),
    [content, placeKey, viewport],
  );

  // The opening view frames the trip. It is applied once per layout or route
  // change rather than on every render, so a pan the reader has made is not
  // snapped back under their finger.
  useEffect(() => {
    mapScale.value = withSpring(opening.scale);
    mapTranslateX.value = withSpring(opening.translateX);
    mapTranslateY.value = withSpring(opening.translateY);
  }, [mapScale, mapTranslateX, mapTranslateY, opening]);

  useEffect(() => {
    viewportWidth.value = viewport.width;
    viewportHeight.value = viewport.height;
    contentWidth.value = content.width;
    contentHeight.value = content.height;
  }, [content, contentHeight, contentWidth, viewport, viewportHeight, viewportWidth]);

  useEffect(() => {
    const entrance = Animated.timing(mapOpacity, { toValue: 1, duration: 520, useNativeDriver: true });
    entrance.start();
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.16, duration: 1100, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
    ]));
    pulseLoop.start();
    return () => {
      entrance.stop();
      pulseLoop.stop();
    };
  }, [mapOpacity, pulse]);

  function zoomMap(delta: number) {
    const nextScale = Math.max(1, Math.min(MAX_SCALE, mapScale.value + delta));
    const next = clampToBounds(
      { scale: nextScale, translateX: mapTranslateX.value, translateY: mapTranslateY.value },
      viewport,
      content,
    );
    mapScale.value = withSpring(next.scale);
    mapTranslateX.value = withSpring(next.translateX);
    mapTranslateY.value = withSpring(next.translateY);
  }

  function resetMap() {
    mapScale.value = withSpring(opening.scale);
    mapTranslateX.value = withSpring(opening.translateX);
    mapTranslateY.value = withSpring(opening.translateY);
  }

  const orderedPoints = destinations.map(({ x, y }) => `${x},${y}`).join(' ');
  const selectedCountryCodes = new Set(destinations.map(({ countryCode }) => countryCode.toLowerCase()));
  const legend: DestinationStatus[] = ['current', 'planned', 'visited'];

  const control = (label: string, accessibilityLabel: string, onPress: () => void, small = false) => (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.mapControl, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
      <ThemedText type={small ? 'smallBold' : 'default'} style={{ color: theme.text }}>{label}</ThemedText>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.legend} accessibilityRole="list">
        {legend.map((status) => (
          <View key={status} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: statusColor(status, theme) },
                status === 'visited' && { borderWidth: 1, borderColor: theme.border },
              ]}
            />
            <ThemedText type="small" themeColor="textSecondary">{statusLabel(status, tx)}</ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.mapArea}>
        <Animated.View
          style={[styles.mapShell, { backgroundColor: theme.mapBackground, opacity: mapOpacity }]}
          onLayout={({ nativeEvent }) => setViewport({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })}>
          <GestureDetector gesture={mapGesture}>
            <Reanimated.View
              style={[
                styles.mapContent,
                { width: content.width, height: content.height, marginLeft: -content.width / 2, marginTop: -content.height / 2 },
                mapTransformStyle,
              ]}>
              <Svg width="100%" height="100%" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
                <Rect width={MAP_WIDTH} height={MAP_HEIGHT} fill={theme.mapBackground} />
                {[130, 250, 370, 490].map((y) => <Line key={`h-${y}`} x1="0" y1={y} x2={MAP_WIDTH} y2={y} stroke={theme.mapGrid} strokeWidth="1" opacity="0.45" />)}
                {[150, 350, 550, 750, 950].map((x) => <Line key={`v-${x}`} x1={x} y1="0" x2={x} y2={MAP_HEIGHT} stroke={theme.mapGrid} strokeWidth="1" opacity="0.35" />)}
                {(worldMap.locations as { id: string; path: string }[]).map((location) => (
                  <Path
                    key={location.id}
                    d={location.path}
                    fill={selectedCountryCodes.has(location.id) ? theme.mapLandSelected : theme.mapLand}
                    stroke={theme.mapGrid}
                    strokeWidth="0.7"
                    opacity="0.86"
                  />
                ))}
                {orderedPoints ? <Polyline points={orderedPoints} fill="none" stroke={theme.mapRoute} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.86" /> : null}
              </Svg>
              {destinations.map((destination, index) => {
                const selectedMarker = destination.key === selected?.key;
                const pinColor = statusColor(destination.status, theme);
                return (
                  <Reanimated.View
                    key={destination.key}
                    style={[styles.markerHit, { left: `${(destination.x / MAP_WIDTH) * 100}%`, top: `${(destination.y / MAP_HEIGHT) * 100}%` }, markerScaleStyle]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={tx(
                      `${destination.cityName}，${statusLabel(destination.status, tx)}，${destination.items.length} 项安排`,
                      `${destination.cityName}, ${statusLabel(destination.status, tx)}, ${destination.items.length} plans`,
                    )}
                    accessibilityState={{ selected: selectedMarker }}
                    // Pressing a pin selects it, always. Which place is selected
                    // is the map's job; opening a plan belongs to the panel.
                    onPress={() => {
                      setSelectedKey(destination.key);
                      if (viewport.width > 0) cards.current?.scrollTo({ x: index * viewport.width, animated: true });
                    }}
                    style={styles.markerPress}
                    testID={`destination-marker-${index}`}>
                    <Animated.View style={[styles.markerGlow, { backgroundColor: pinColor, transform: [{ scale: selectedMarker || destination.status === 'current' ? pulse : 1 }] }]} />
                    <View style={[styles.marker, { backgroundColor: pinColor, borderColor: theme.mapBackground }, selectedMarker && styles.markerSelected]}>
                      <ThemedText style={{ color: destination.status === 'visited' ? theme.mapBackground : theme.textOnAccent, fontSize: 10, lineHeight: 12, fontWeight: '800' }}>{destination.items.length}</ThemedText>
                    </View>
                  </Pressable>
                  </Reanimated.View>
                );
              })}
            </Reanimated.View>
          </GestureDetector>

          {/* One tonal surface with one shadow: a control never carries a
              border and an elevation at the same time. */}
          <View style={[styles.mapControls, { backgroundColor: theme.border, shadowColor: theme.shadow }]}>
            {control('＋', tx('放大地图', 'Zoom in map'), () => zoomMap(0.75))}
            {control('−', tx('缩小地图', 'Zoom out map'), () => zoomMap(-0.75))}
            {control(tx('复位', 'Fit'), tx('回到整段行程', 'Fit the whole trip'), resetMap, true)}
          </View>

          {/* Source credit, which the data licences require to stay on the
              map. It is attribution, not an instruction — the drag-and-pinch
              caption that used to sit here is gone. */}
          <ThemedText style={[styles.attribution, { color: theme.mapMarker }]} pointerEvents="none">
            {tx('城市坐标：Open-Meteo · 世界轮廓：SVG Maps', 'Coordinates: Open-Meteo · Outline: SVG Maps')}
          </ThemedText>
        </Animated.View>

        {/* Cities inside one country land within a few pixels of each other on
            a world outline, so pins alone cannot be the way to reach a place.
            The cards page horizontally and stay in step with the selection —
            the carousel Google Maps puts under its map for the same reason. */}
        {destinations.length > 0 ? (
          <ScrollView
            ref={cards}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={viewport.width}
            decelerationRate="fast"
            contentContainerStyle={styles.cards}
            onMomentumScrollEnd={({ nativeEvent }) => {
              if (viewport.width <= 0) return;
              const index = Math.round(nativeEvent.contentOffset.x / viewport.width);
              const next = destinations[Math.max(0, Math.min(destinations.length - 1, index))];
              if (next) setSelectedKey(next.key);
            }}>
            {destinations.map((destination) => (
              <View key={destination.key} style={[styles.cardSlot, { width: viewport.width }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tx(`${destination.cityName} 的安排`, `Plans in ${destination.cityName}`)}
                  onPress={() => { setSelectedKey(destination.key); setPlaceOpen(true); }}
                  style={({ pressed }) => [
                    styles.placeCard,
                    { backgroundColor: theme.backgroundElement, shadowColor: theme.shadow },
                    pressed && styles.pressed,
                  ]}>
                  <View style={[styles.placeStatus, { backgroundColor: statusColor(destination.status, theme) }]} />
                  <View style={styles.placeCopy}>
                    <ThemedText type="smallBold" numberOfLines={1} style={styles.placeCity}>{destination.cityName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {[
                        statusLabel(destination.status, tx),
                        tx(`${destination.items.length} 项安排`, `${destination.items.length} plans`),
                        destination.timeZone,
                        destination.currency,
                      ].filter(Boolean).join(' · ')}
                    </ThemedText>
                  </View>
                  <Chevron color={theme.textMuted} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.placeCard, styles.placeEmpty, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">{tx('地图还在等第一个目的地', 'The map is waiting for its first destination')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {tx('在添加安排时搜索城市即可，时区和币种会自动带入。', 'Search a city while adding a plan; timezone and currency will be suggested automatically.')}
            </ThemedText>
          </View>
        )}
      </View>

      {selected ? (
        <DestinationPlaceSheet
          cityName={selected.cityName}
          countryName={selected.countryName}
          currency={selected.currency}
          items={selected.items}
          languageTag={languageTag}
          onDismiss={() => setPlaceOpen(false)}
          onViewAll={onViewPlace ? () => { setPlaceOpen(false); onViewPlace({ cityName: selected.cityName, items: selected.items }); } : undefined}
          onViewItem={onViewItem ? (item) => { setPlaceOpen(false); onViewItem(item); } : undefined}
          status={selected.status}
          statusColor={statusColor(selected.status, theme)}
          statusLabel={statusLabel(selected.status, tx)}
          timeZone={selected.timeZone}
          tx={tx}
          visible={placeOpen}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 0, gap: Spacing.sm },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  mapArea: { flex: 1, minHeight: 0, justifyContent: 'flex-end' },
  mapShell: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: Radius.xl, overflow: 'hidden' },
  // Centred by half-size negative margins so the transform's own origin is the
  // middle of the map, which is what `frameDestinations` solves against.
  mapContent: { position: 'absolute', left: '50%', top: '50%' },
  mapControls: { position: 'absolute', right: 14, top: 14, borderRadius: Radius.md, overflow: 'hidden', gap: StyleSheet.hairlineWidth, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  mapControl: { width: 44, height: 42, alignItems: 'center', justifyContent: 'center' },
  markerHit: { position: 'absolute', width: 44, height: 44, marginLeft: -22, marginTop: -22 },
  markerPress: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  markerGlow: { position: 'absolute', width: 30, height: 30, borderRadius: 15, opacity: 0.28 },
  marker: { minWidth: 25, height: 25, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  markerSelected: { minWidth: 31, height: 31, borderRadius: 16, borderWidth: 3 },
  cards: { alignItems: 'stretch' },
  cardSlot: { justifyContent: 'flex-end' },
  placeStatus: { width: 4, alignSelf: 'stretch', minHeight: 32, borderRadius: 2 },
  placeCard: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, margin: Spacing.sm, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  placeEmpty: { flexDirection: 'column', alignItems: 'flex-start', gap: 3, elevation: 0, shadowOpacity: 0 },
  placeCopy: { flex: 1, minWidth: 0, gap: 2 },
  placeCity: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  // Above the place card, which is docked at the map's lower edge.
  attribution: { position: 'absolute', left: 14, bottom: 96, fontSize: 11, lineHeight: 16, fontWeight: '500', opacity: 0.68 },
  pressed: { opacity: 0.68 },
});
