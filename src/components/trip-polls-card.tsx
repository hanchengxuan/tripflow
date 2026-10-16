import { SymbolView } from 'expo-symbols';
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
import { canManagePoll, pollStatus, pollVoteAction, tallyPoll } from '@/features/polls/poll-state';
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
  const { polls, loadError, refreshing, reload, create, vote, withdraw, decide, reopen, remove } = useTripPolls(trip.id);
  const [composerOpen, setComposerOpen] = useState(false);
  const [decidingPollId, setDecidingPollId] = useState<string>();
  const [votingOptionId, setVotingOptionId] = useState<string>();
  const [voteError, setVoteError] = useState<string>();
  const [now] = useState(() => new Date());
  const isEditor = role === 'owner' || role === 'editor';

  if (!polls?.length && !isEditor) return null;

  const castVote = async (poll: TripPoll, optionId: string) => {
    const action = pollVoteAction(poll, currentUserId, optionId, now);
    if (!action) return;
    setVotingOptionId(optionId);
    setVoteError(undefined);
    try {
      await (action === 'withdraw' ? withdraw(poll.id) : vote(poll.id, optionId));
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
          {polls?.length ? null : <ThemedText type="small" themeColor="textSecondary">{tx('一起决定去哪、吃什么。', 'Decide together where to go and what to eat.')}</ThemedText>}
        </View>
        {polls?.length ? (
          <Pressable accessibilityRole="button" accessibilityLabel={tx('刷新投票', 'Refresh polls')} disabled={refreshing} onPress={() => void reload()} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}>
            <SymbolView name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} size={20} tintColor={theme.link} />
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
              : tx('点选项投票，可改投；再点一次撤回', 'Tap to vote or switch; tap your vote again to take it back');
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
                  accessibilityHint={status === 'open' && mine ? tx('再点一次撤回投票', 'Tap again to take back your vote') : undefined}
                  onPress={() => void castVote(poll, option.id)}
                  style={({ pressed }) => [styles.option, { backgroundColor: mine || winner ? theme.accentSoft : theme.backgroundSubtle, borderColor: mine || winner ? theme.accent : 'transparent' }, pressed && styles.pressed]}>
                  <View style={styles.optionHead}>
                    {winner ? <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={16} tintColor={theme.accent} /> : null}
                    <ThemedText style={styles.grow} type={mine || winner ? 'smallBold' : 'small'}>{option.label}</ThemedText>
                    <AvatarStack people={voters} size={24} />
                  </View>
                  <View style={styles.optionFoot}>
                    <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                      <View style={[styles.fill, { width: `${Math.round(share * 100)}%`, backgroundColor: winner || mine ? theme.accent : theme.textMuted }]} />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
                      {votingOptionId === option.id ? '…' : tx(`${option.count} 票`, `${option.count}`)}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
            {canManagePoll(poll, currentUserId, role) ? (
              <Pressable accessibilityRole="button" onPress={() => setDecidingPollId(poll.id)} style={styles.textAction}>
                <ThemedText type="smallBold" themeColor="link">{status === 'decided' ? tx('更改结果', 'Change the result') : tx('选定结果', 'Pick the result')}</ThemedText>
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
        onReopen={reopen}
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
  option: { minHeight: 44, borderRadius: Radius.md, borderWidth: 1.5, gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: 24 },
  optionFoot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  track: { flex: 1, height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  count: { minWidth: 36, textAlign: 'right' },
  iconAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  textAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  pressed: { opacity: 0.75 },
});
