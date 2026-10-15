import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { DateTimePairField } from '@/components/date-time-pair-field';
import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { Spacing } from '@/constants/theme';
import { useI18n } from '@/features/i18n/i18n-provider';
import { cleanPollDraft, maxPollOptions } from '@/features/polls/poll-state';
import { isoToZonedDateTime, zonedDateTimeToIso } from '@/lib/trip-time';
import { toUserMessage } from '@/lib/user-error';

interface PollComposerSheetProps {
  timeZone: string;
  visible: boolean;
  onDismiss: () => void;
  onCreate: (input: { question: string; options: string[]; closesAt?: string }) => Promise<void>;
}

const halfHourMs = 30 * 60 * 1000;

/** About three hours out, on a whole half hour. */
function defaultDeadline() {
  return new Date(Math.ceil((Date.now() + 3 * 60 * 60 * 1000) / halfHourMs) * halfHourMs).toISOString();
}

export function PollComposerSheet({ timeZone, visible, onDismiss, onCreate }: PollComposerSheetProps) {
  const { locale, tx } = useI18n();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [deadline, setDeadline] = useState<{ date: string; time: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const reset = () => {
    setQuestion('');
    setOptions(['', '']);
    setDeadline(undefined);
    setError(undefined);
  };

  const submit = async () => {
    const draft = cleanPollDraft({ question, options }, tx);
    if ('error' in draft) return setError(draft.error);
    const closesAt = deadline ? zonedDateTimeToIso(deadline.date, deadline.time, timeZone) : undefined;
    if (closesAt && new Date(closesAt).getTime() <= Date.now()) return setError(tx('截止时间需要晚于现在。', 'The deadline must be in the future.'));
    setBusy(true);
    setError(undefined);
    try {
      await onCreate({ ...draft, closesAt });
      reset();
      onDismiss();
    } catch (caught) {
      setError(toUserMessage(caught, tx('发起投票失败，请稍后重试。', 'Could not start the poll. Try again later.'), locale));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet title={tx('发起投票', 'Start a poll')} visible={visible} onDismiss={onDismiss} dismissDisabled={busy}>
      <View style={styles.form}>
        <FormField label={tx('问题', 'Question')} value={question} onChangeText={(value) => { setQuestion(value); setError(undefined); }} placeholder={tx('例如：今晚吃什么？', 'For example: Where should we eat tonight?')} maxLength={160} />
        {options.map((option, index) => (
          <FormField
            key={index}
            label={tx(`选项 ${index + 1}`, `Option ${index + 1}`)}
            value={option}
            maxLength={120}
            onChangeText={(value) => {
              setOptions((current) => current.map((entry, entryIndex) => entryIndex === index ? value : entry));
              setError(undefined);
            }}
          />
        ))}
        <View style={styles.chips}>
          {options.length < maxPollOptions ? (
            <ChoiceChip role="button" selected={false} onPress={() => setOptions((current) => [...current, ''])}>{tx('+ 添加选项', '+ Add option')}</ChoiceChip>
          ) : null}
          <ChoiceChip
            role="checkbox"
            selected={Boolean(deadline)}
            onPress={() => setDeadline((current) => current ? undefined : isoToZonedDateTime(defaultDeadline(), timeZone))}>
            {tx('设截止时间', 'Set a deadline')}
          </ChoiceChip>
        </View>
        {deadline ? (
          <DateTimePairField
            label={tx('截止', 'Closes')}
            dateLabel={tx('截止日期', 'Deadline date')}
            dateValue={deadline.date}
            timeLabel={tx('截止时间', 'Deadline time')}
            timeValue={deadline.time}
            onDateChange={(date) => setDeadline((current) => current && { ...current, date })}
            onTimeChange={(time) => setDeadline((current) => current && { ...current, time })}
          />
        ) : null}
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        <ActionButton busy={busy} onPress={() => void submit()}>{tx('发起投票', 'Start poll')}</ActionButton>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
