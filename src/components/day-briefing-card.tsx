import { StyleSheet, View } from 'react-native';

import { InfoCard } from '@/components/info-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ItineraryItem } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { buildDayBriefing } from '@/features/itinerary/day-briefing';

export function DayBriefingCard({ items, timeZone, now }: { items: ItineraryItem[]; timeZone: string; now: number }) {
  const { languageTag, tx } = useI18n();
  const briefing = buildDayBriefing(items, new Date(now), timeZone);
  if (!briefing) return null;

  const formatDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString(languageTag, { timeZone: 'UTC', month: 'short', day: 'numeric', weekday: 'short' });
  const dateLabel = formatDate(briefing.date);
  const dayLabel = { today: tx('今天', 'Today'), tomorrow: tx('明天', 'Tomorrow'), later: dateLabel }[briefing.relative];
  const lastDate = briefing.last?.date ? `${formatDate(briefing.last.date)} · ` : '';
  const lines = [
    ...briefing.checkOuts.map((entry, index) => ({ key: `out-${index}`, time: entry.time, text: tx(`退房：${entry.title}`, `Check out: ${entry.title}`) })),
    ...briefing.checkIns.map((entry, index) => ({ key: `in-${index}`, time: entry.time, text: tx(`入住：${entry.title}`, `Check in: ${entry.title}`) })),
    ...(briefing.last ? [{ key: 'last', time: briefing.last.time, text: tx(`${lastDate}最后一项结束：${briefing.last.title}`, `${lastDate}Day ends: ${briefing.last.title}`) }] : []),
  ];
  const summary = briefing.relative === 'later' ? dayLabel : `${dayLabel} · ${dateLabel}`;

  return (
    <InfoCard title={tx(`${summary} · ${briefing.planCount} 项安排`, `${summary} · ${briefing.planCount} ${briefing.planCount === 1 ? 'plan' : 'plans'}`)}>
      <View style={styles.lines}>
        {lines.map((line) => (
          <View key={line.key} style={styles.line}>
            <ThemedText type="smallBold" style={styles.time}>{line.time}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.text}>{line.text}</ThemedText>
          </View>
        ))}
      </View>
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  lines: { gap: Spacing.xs },
  line: { flexDirection: 'row', gap: Spacing.sm },
  time: { width: 48, fontVariant: ['tabular-nums'] },
  text: { flex: 1 },
});
