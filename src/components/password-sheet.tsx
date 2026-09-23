import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function PasswordSheet({
  busy,
  error,
  hasPassword,
  onDismiss,
  onSubmit,
  tx,
  visible,
}: {
  busy: boolean;
  error?: string;
  hasPassword: boolean;
  onDismiss: () => void;
  onSubmit: (input: { current: string; next: string; confirm: string }) => Promise<boolean>;
  tx: (zh: string, en: string) => string;
  visible: boolean;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  function reset() {
    setCurrent('');
    setNext('');
    setConfirm('');
  }

  async function submit() {
    if (await onSubmit({ current, next, confirm })) reset();
  }

  return (
    <BottomSheet
      dismissDisabled={busy}
      onDismiss={() => { reset(); onDismiss(); }}
      title={hasPassword ? tx('修改密码', 'Change password') : tx('设置密码', 'Set a password')}
      visible={visible}
    >
      <View style={styles.form}>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        {hasPassword ? (
          <FormField
          editable={!busy}
            label={tx('当前密码', 'Current password')}
            value={current}
            onChangeText={setCurrent}
            autoCapitalize="none"
            autoComplete="current-password"
            secureTextEntry
            placeholder={tx('输入当前密码', 'Enter current password')}
          />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {tx('这个账号通过 Google 创建，还没有密码。设置后即可用邮箱和密码登录。',
                'This account was created with Google and has no password yet. Set one to also sign in with email.')}
          </ThemedText>
        )}
        <FormField
          editable={!busy}
          label={tx('新密码', 'New password')}
          value={next}
          onChangeText={setNext}
          autoCapitalize="none"
          autoComplete="new-password"
          secureTextEntry
          placeholder={tx('至少 8 位，包含字母和数字', '8+ characters with letters and numbers')}
        />
        <FormField
          editable={!busy}
          label={tx('确认新密码', 'Confirm new password')}
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="none"
          autoComplete="new-password"
          secureTextEntry
          placeholder={tx('再次输入新密码', 'Enter the new password again')}
        />
        <ActionButton
          busy={busy}
          disabled={(hasPassword && !current) || !next || !confirm}
          onPress={() => void submit()}>
          {hasPassword ? tx('更新密码', 'Update password') : tx('设置密码', 'Set password')}
        </ActionButton>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', gap: Spacing.sm },
});
