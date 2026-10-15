import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AvatarStack } from '@/components/avatar-stack';
import { ActionButton, InlineNotice } from '@/components/form-controls';
import { PollComposerSheet } from '@/components/poll-composer-sheet';
import { PollDecideSheet } from '@/components/poll-decide-sheet';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { Trip, TripMember, TripPoll, TripRole } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { pollStatus, tallyPoll } from '@/features/polls/poll-state';
import { useTripPolls } from '@/features/polls/use-trip-polls';
import { useTheme } from '@/hooks/use-theme';
import { formatZonedDateTimeRange } from '@/lib/trip-time';
import { toUserMessage } from '@/lib/user-error';

interface TripPollsCardProps {
  trip: Pick<Trip, 'id' | 'defaultTimeZone'>;
  currentUserId: string;
  role?: TripRole;
  members: TripMember[];
}

export function TripPollsCard({ trip, currentUserId, role, members }: TripPollsCardProps) {
  const theme = useTheme();
  const { languageTag, locale, tx } = useI18n();
  const { polls, loadError, refreshing, reload, create, vote, decide, remove } = useTripPolls(trip.id);
  const [composerOpen, setComposerOpen] = useState(false);
  const [decidingPollId, setDecidingPollId] = useState<string>();
  const [votingOptionId, setVotingOptionId] = useState<string>();
  const [voteError, setVoteError] = useState<string>();
  const [now] = useState(() => new Date());
  const isEditor = role === 'owner' || role === 'editor';
  const canManage = (poll: TripPoll) => isEditor || poll.createdBy === currentUserId;

  if (!polls?.length && !isEditor) return null;

  const castVote = async (pollId: string, optionId: string) => {
    setVotingOptionId(optionId);
    setVoteError(undefined);
    try {
      await vote(pollId, optionId);
    } catch (caught) {
      setVoteError(toUserMessage(caught, tx('投票失败，请稍后重试。', 'Could not save your vote. Try again later.'), locale));
    } finally {
      setVotingOptionId(undefined);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.grow}>
          <ThemedText type="smallBold">{tx('投票', 'Polls')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{tx('一起决定去哪、吃什么。', 'Decide together where to go and what to eat.')}</ThemedText>
        </View>
        {polls?.length ? (
          <Pressable accessibilityRole="button" disabled={refreshing} onPress={() => void reload()} style={styles.textAction}>
            <ThemedText type="smallBold" themeColor="link">{tx('刷新', 'Refresh')}</ThemedText>
          </Pressable>
        ) : null}
        {isEditor ? <ActionButton tone="secondary" onPress={() => setComposerOpen(true)}>{tx('发起投票', 'Start a poll')}</ActionButton> : null}
      </View>

      {loadError ? <InlineNotice tone="error">{toUserMessage(loadError, tx('投票暂时无法加载。', 'Polls could not load right now.'), locale)}</InlineNotice> : null}
      {voteError ? <InlineNotice tone="error">{voteError}</InlineNotice> : null}

      {polls?.map((poll) => {
        const status = pollStatus(poll, now);
        const tally = tallyPoll(poll, currentUserId);
        const selected = poll.options.find((option) => option.id === poll.selectedOptionId);
        const statusText = status === 'decided'
          ? tx(`已决定：${selected?.label ?? ''}`, `Decided: ${selected?.label ?? ''}`)
          : status === 'expired'
            ? tx('已截止，等待选定结果', 'Closed, waiting for a result')
            : poll.closesAt
              ? tx(`截止 ${formatZonedDateTimeRange(poll.closesAt, undefined, languageTag, trip.defaultTimeZone)}`, `Closes ${formatZonedDateTimeRange(poll.closesAt, undefined, languageTag, trip.defaultTimeZone)}`)
              : tx('点一个选项投票，可随时改', 'Tap an option to vote; you can change it');
        return (
          <View key={poll.id} style={[styles.poll, { borderColor: theme.border }]}>
            <ThemedText type="smallBold">{poll.question}</ThemedText>
            <ThemedText type="small" style={{ color: status === 'decided' ? theme.accent : theme.textSecondary }}>
              {statusText} · {tx(`${tally.total} 人已投`, `${tally.total} voted`)}
            </ThemedText>
            {tally.options.map((option) => {
              const mine = tally.myOptionId === option.id;
              const winner = poll.selectedOptionId === option.id;
              const share = tally.total ? option.count / tally.total : 0;
              const voters = poll.votes
                .filter((vote) => vote.optionId === option.id)
                .map((vote) => {
                  const member = members.find(({ userId }) => userId === vote.userId);
                  return { id: vote.userId, displayName: member?.displayName ?? tx('同行者', 'Traveller'), avatarUrl: member?.avatarUrl };
                });
              const voterNames = voters.map(({ displayName }) => displayName).join(tx('、', ', '));
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole={status === 'open' ? 'radio' : 'text'}
                  accessibilityState={status === 'open' ? { checked: mine, disabled: Boolean(votingOptionId) } : undefined}
                  accessibilityLabel={tx(
                    `${option.label}，${option.count} 票${voterNames ? `：${voterNames}` : ''}${mine ? '，你的选择' : ''}`,
                    `${option.label}, ${option.count} ${option.count === 1 ? 'vote' : 'votes'}${voterNames ? `: ${voterNames}` : ''}${mine ? ', your vote' : ''}`,
                  )}
                  disabled={status !== 'open' || Boolean(votingOptionId)}
                  onPress={() => void castVote(poll.id, option.id)}
                  style={({ pressed }) => [styles.option, { backgroundColor: theme.backgroundSubtle, borderColor: mine || winner ? theme.accent : 'transparent' }, pressed && styles.pressed]}>
                  <View style={[styles.bar, { width: `${Math.round(share * 100)}%`, backgroundColor: theme.accentSoft }]} />
                  <ThemedText style={styles.grow} type={mine || winner ? 'smallBold' : 'small'}>{winner ? '✓ ' : ''}{option.label}</ThemedText>
                  <AvatarStack people={voters} />
                  <ThemedText type="smallBold">{votingOptionId === option.id ? '…' : option.count}</ThemedText>
                </Pressable>
              );
            })}
            {status !== 'decided' && canManage(poll) ? (
              <Pressable accessibilityRole="button" onPress={() => setDecidingPollId(poll.id)} style={styles.textAction}>
                <ThemedText type="smallBold" themeColor="link">{tx('选定结果', 'Pick the result')}</ThemedText>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {polls && polls.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">{tx('还没有投票。发起一个，让大家一起决定。', 'No polls yet. Start one so everyone can weigh in.')}</ThemedText>
      ) : null}

      <PollComposerSheet timeZone={trip.defaultTimeZone} visible={composerOpen} onDismiss={() => setComposerOpen(false)} onCreate={(input) => create({ tripId: trip.id, ...input })} />
      <PollDecideSheet
        poll={polls?.find((poll) => poll.id === decidingPollId)}
        currentUserId={currentUserId}
        onDismiss={() => setDecidingPollId(undefined)}
        onDecide={decide}
        onDelete={remove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  grow: { flex: 1 },
  poll: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  option: { minHeight: 44, borderRadius: Radius.md, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  textAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  pressed: { opacity: 0.75 },
});
