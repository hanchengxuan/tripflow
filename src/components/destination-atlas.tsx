/* eslint-disable react-hooks/immutability -- Reanimated shared values are intentionally mutable in worklets. */
import worldMap from '@svg-maps/world';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Line, Path, Polyline, Rect } from 'react-native-svg';

import { SectionHeading } from '@/components/section-heading';
import { ThemedText } from '@/components/themed-text';
import type { ItineraryItem } from '@/domain/models';
import { projectDestination } from '@/features/destinations/destination-search';
import { formatZonedDateTimeRange } from '@/lib/trip-time';
import { useTheme } from '@/hooks/use-theme';

const MAP_WIDTH = 1010;
const MAP_HEIGHT = 666;

type DestinationStatus = 'visited' | 'current' | 'planned';

interface AtlasDestination {
  key: string;
  cityName: string;
  countryName: string;
  countryCode: string;
  timeZone: string;
  currency?: string;
  latitude: number;
  longitude: number;
  items: ItineraryItem[];
  status: DestinationStatus;
  x: number;
  y: number;
}

function destinationKey(item: ItineraryItem) {
  const destination = item.destination!;
  return `${destination.countryCode}:${destination.cityName}:${destination.latitude.toFixed(3)}:${destination.longitude.toFixed(3)}`;
}

function statusForItems(items: ItineraryItem[], now: number): DestinationStatus {
  if (items.some((item) => {
    const start = new Date(item.startsAt).getTime();
    const end = new Date(item.endsAt ?? item.startsAt).getTime();
    return start <= now && now <= end;
  })) return 'current';
  if (items.some((item) => new Date(item.startsAt).getTime() > now)) return 'planned';
  return 'visited';
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

export function DestinationAtlas({
  items,
  languageTag,
  tx,
  onViewItem,
}: {
  items: ItineraryItem[];
  languageTag: string;
  tx: (zh: string, en: string) => string;
  onViewItem?: (item: ItineraryItem) => void;
}) {
  const theme = useTheme();
  const [selectedKey, setSelectedKey] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const [mapOpacity] = useState(() => new Animated.Value(0));
  const [mapOffset] = useState(() => new Animated.Value(10));
  const [pulse] = useState(() => new Animated.Value(1));
  const mapScale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const mapTranslateX = useSharedValue(0);
  const mapTranslateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const viewportWidth = useSharedValue(0);
  const viewportHeight = useSharedValue(0);

  const mapTransformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: mapTranslateX.value },
      { translateY: mapTranslateY.value },
      { scale: mapScale.value },
    ],
  }));

  const panGesture = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      panStartX.value = mapTranslateX.value;
      panStartY.value = mapTranslateY.value;
    })
    .onUpdate((event) => {
      const maxX = Math.max(0, (viewportWidth.value * (mapScale.value - 1)) / 2);
      const maxY = Math.max(0, (viewportHeight.value * (mapScale.value - 1)) / 2);
      mapTranslateX.value = Math.max(-maxX, Math.min(maxX, panStartX.value + event.translationX));
      mapTranslateY.value = Math.max(-maxY, Math.min(maxY, panStartY.value + event.translationY));
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
      const nextScale = Math.max(1, Math.min(3, savedScale.value * event.scale));
      const maxX = Math.max(0, (viewportWidth.value * (nextScale - 1)) / 2);
      const maxY = Math.max(0, (viewportHeight.value * (nextScale - 1)) / 2);
      mapScale.value = nextScale;
      mapTranslateX.value = Math.max(-maxX, Math.min(maxX, mapTranslateX.value));
      mapTranslateY.value = Math.max(-maxY, Math.min(maxY, mapTranslateY.value));
    })
    .onEnd(() => {
      mapScale.value = withSpring(mapScale.value);
      mapTranslateX.value = withSpring(mapTranslateX.value);
      mapTranslateY.value = withSpring(mapTranslateY.value);
    });

  const mapGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  function zoomMap(delta: number) {
    const nextScale = Math.max(1, Math.min(3, mapScale.value + delta));
    mapScale.value = withSpring(nextScale);
    if (nextScale === 1) {
      mapTranslateX.value = withSpring(0);
      mapTranslateY.value = withSpring(0);
    }
  }

  function resetMap() {
    mapScale.value = withSpring(1);
    mapTranslateX.value = withSpring(0);
    mapTranslateY.value = withSpring(0);
  }

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
        latitude: destination.latitude,
        longitude: destination.longitude,
        items: groupedItems.sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
        status: statusForItems(groupedItems, now),
        ...point,
      };
    }).sort((left, right) => left.items[0].startsAt.localeCompare(right.items[0].startsAt));
  }, [items, now]);

  const selected = destinations.find(({ key }) => key === selectedKey) ?? destinations[0];

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(mapOpacity, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(mapOffset, { toValue: 0, duration: 620, useNativeDriver: true }),
    ]);
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
  }, [mapOffset, mapOpacity, pulse]);

  const orderedPoints = destinations.map(({ x, y }) => `${x},${y}`).join(' ');
  const selectedCountryCodes = new Set(destinations.map(({ countryCode }) => countryCode.toLowerCase()));

  return (
    <View style={styles.wrap}>
      <SectionHeading
        title={tx('目的地地图', 'Destination atlas')}
        detail={destinations.length > 0
          ? tx('点一下标记，查看这个地点的安排。', 'Tap a pin to see the plans for that place.')
          : tx('选择安排的目的地后，轨迹会在这里出现。', 'Choose destinations on your plans to build the map.')}
        trailing={destinations.length > 0 ? <ThemedText type="small" themeColor="textSecondary">{tx(`${destinations.length} 个地点`, `${destinations.length} places`)}</ThemedText> : null}
      />

      <Animated.View style={[styles.mapShell, { backgroundColor: theme.mapBackground, opacity: mapOpacity, transform: [{ translateY: mapOffset }] }]}>
        <View
          style={styles.mapViewport}
          onLayout={({ nativeEvent }) => {
            viewportWidth.value = nativeEvent.layout.width;
            viewportHeight.value = nativeEvent.layout.height;
          }}>
          <GestureDetector gesture={mapGesture}>
            <Reanimated.View style={[styles.mapContent, mapTransformStyle]}>
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
                  <Pressable
                    key={destination.key}
                    accessibilityRole="button"
                    accessibilityLabel={tx(`${destination.cityName}，${statusLabel(destination.status, tx)}`, `${destination.cityName}, ${statusLabel(destination.status, tx)}`)}
                    accessibilityState={{ selected: selectedMarker }}
                    onPress={() => setSelectedKey(destination.key)}
                    style={[styles.markerHit, { left: `${(destination.x / MAP_WIDTH) * 100}%`, top: `${(destination.y / MAP_HEIGHT) * 100}%` }]}
                    testID={`destination-marker-${index}`}>
                    <Animated.View style={[styles.markerGlow, { backgroundColor: pinColor, transform: [{ scale: selectedMarker || destination.status === 'current' ? pulse : 1 }] }]} />
                    <View style={[styles.marker, { backgroundColor: pinColor, borderColor: theme.mapBackground }, selectedMarker && styles.markerSelected]}>
                      <ThemedText style={{ color: destination.status === 'visited' ? theme.mapBackground : theme.textOnAccent, fontSize: 10, lineHeight: 12, fontWeight: '800' }}>{destination.items.length}</ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </Reanimated.View>
          </GestureDetector>
          <View style={styles.mapOverlay} pointerEvents="box-none">
            <View style={styles.mapControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx('缩小地图', 'Zoom out map')}
                onPress={() => zoomMap(-0.5)}
                style={({ pressed }) => [styles.mapControl, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && styles.pressed]}>
                <ThemedText type="subtitle" style={{ color: theme.text }}>−</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx('放大地图', 'Zoom in map')}
                onPress={() => zoomMap(0.5)}
                style={({ pressed }) => [styles.mapControl, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && styles.pressed]}>
                <ThemedText type="subtitle" style={{ color: theme.text }}>＋</ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx('重置地图', 'Reset map')}
                onPress={resetMap}
                style={({ pressed }) => [styles.mapControl, styles.resetControl, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && styles.pressed]}>
                <ThemedText type="smallBold" style={{ color: theme.text }}>1:1</ThemedText>
              </Pressable>
            </View>
            <View style={styles.mapCaption} pointerEvents="none">
              <ThemedText type="small" style={{ color: theme.mapMarker }}>{tx('旅途轨迹', 'TRIP TRACE')}</ThemedText>
              <ThemedText type="small" style={{ color: theme.mapMarker, opacity: 0.72 }}>{tx('拖动浏览 · 双指缩放', 'Drag to explore · pinch to zoom')}</ThemedText>
            </View>
          </View>
        </View>
      </Animated.View>

      {selected ? (
        <View style={[styles.detail, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.detailHeader}>
            <View style={styles.detailCopy}>
              <ThemedText type="subtitle" style={styles.city}>{selected.cityName}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{selected.countryName} · {selected.timeZone}{selected.currency ? ` · ${selected.currency}` : ''}</ThemedText>
            </View>
            <View style={[styles.status, { backgroundColor: selected.status === 'visited' ? theme.backgroundSubtle : theme.accentSoft }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor(selected.status, theme) }]} />
              <ThemedText type="smallBold" style={{ color: selected.status === 'visited' ? theme.textSecondary : theme.accent }}>{statusLabel(selected.status, tx)}</ThemedText>
            </View>
          </View>
          <View style={styles.planList}>
            {selected.items.slice(0, 4).map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole={onViewItem ? 'button' : undefined}
                onPress={onViewItem ? () => onViewItem(item) : undefined}
                style={({ pressed }) => [styles.planRow, pressed && styles.pressed]}>
                <View style={[styles.planDot, { backgroundColor: theme.accent }]} />
                <View style={styles.planCopy}>
                  <ThemedText type="smallBold" numberOfLines={1}>{item.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{formatZonedDateTimeRange(item.startsAt, item.endsAt, languageTag, item.destination?.timeZone ?? 'UTC')}</ThemedText>
                </View>
                {onViewItem ? <ThemedText type="smallBold" style={{ color: theme.link }}>{tx('查看', 'View')}</ThemedText> : null}
              </Pressable>
            ))}
            {selected.items.length > 4 ? <ThemedText type="small" themeColor="textSecondary">{tx(`还有 ${selected.items.length - 4} 项安排`, `${selected.items.length - 4} more plans`)}</ThemedText> : null}
          </View>
        </View>
      ) : (
        <View style={[styles.empty, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">{tx('地图还在等第一个目的地', 'The map is waiting for its first destination')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{tx('在添加安排时搜索城市即可，时区和币种会自动带入。', 'Search a city while adding a plan; timezone and currency will be suggested automatically.')}</ThemedText>
        </View>
      )}
      <ThemedText type="small" themeColor="textMuted" style={styles.attribution}>{tx('城市坐标：Open-Meteo · 世界轮廓：SVG Maps', 'City coordinates: Open-Meteo · World outline: SVG Maps')}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, paddingTop: 10 },
  mapShell: { position: 'relative', width: '100%', aspectRatio: MAP_WIDTH / MAP_HEIGHT, borderRadius: 24, overflow: 'hidden' },
  mapViewport: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden' },
  mapContent: { width: '100%', height: '100%' },
  mapOverlay: StyleSheet.absoluteFill,
  mapControls: { position: 'absolute', right: 14, top: 14, gap: 8 },
  mapControl: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  resetControl: { width: 42 },
  markerHit: { position: 'absolute', width: 44, height: 44, marginLeft: -22, marginTop: -22, alignItems: 'center', justifyContent: 'center' },
  markerGlow: { position: 'absolute', width: 30, height: 30, borderRadius: 15, opacity: 0.28 },
  marker: { minWidth: 25, height: 25, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  markerSelected: { minWidth: 31, height: 31, borderRadius: 16, borderWidth: 3 },
  mapCaption: { position: 'absolute', left: 16, bottom: 14, gap: 1 },
  detail: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 14 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailCopy: { flex: 1, gap: 2 },
  city: { fontSize: 26, lineHeight: 32 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  planList: { gap: 2 },
  planRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  planDot: { width: 7, height: 7, borderRadius: 4 },
  planCopy: { flex: 1, minWidth: 0, gap: 1 },
  empty: { borderRadius: 16, padding: 14, gap: 3 },
  attribution: { textAlign: 'right', fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.68 },
});
