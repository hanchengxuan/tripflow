import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-provider';
import { setInitialPassword, signOut } from '@/features/auth/auth-service';
import { useI18n } from '@/features/i18n/i18n-provider';
import { toUserMessage } from '@/lib/user-error';

/**
 * Recovery lands here with a real but limited session, so the route is allowed
 * through the session router ahead of the onboarding gate. An expired link
 * arrives with no session at all, which is why the empty state is an error
 * rather than a form that would fail on submit.
 */
export default function ResetPasswordScreen() {
  const { tx } = useI18n();
  const { session, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      if (password !== confirmPassword) {
        throw new Error(tx('两次输入的密码不一致。', 'The passwords do not match.'));
      }
      await setInitialPassword(password);
      // Sign out so the new password is exercised once, immediately.
      await signOut();
      router.replace('/');
    } catch (caught) {
      setError(toUserMessage(caught, tx('无法重置密码，请重新申请一封邮件。', 'Could not reset the password. Request a new email.')));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Screen title={tx('重置密码', 'Reset password')} context={[tx('正在检查链接…', 'Checking the link…')]}>
        <View />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen title={tx('链接已失效', 'This link expired')} context={[tx('重置链接只能使用一次', 'A reset link works once')]}>
        <InlineNotice tone="error">
          {tx('这个重置链接已过期或已被使用。请回到登录页重新申请。', 'This reset link has expired or was already used. Request a new one from the sign-in screen.')}
        </InlineNotice>
        <ActionButton onPress={() => router.replace('/')}>{tx('返回登录', 'Back to sign in')}</ActionButton>
      </Screen>
    );
  }

  return (
    <Screen title={tx('设置新密码', 'Set a new password')} context={session.user.email ? [session.user.email] : []}>
      <FormField
        label={tx('新密码', 'New password')}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
        placeholder={tx('至少 8 位，包含字母和数字', '8+ characters with letters and numbers')}
      />
      <FormField
        label={tx('确认新密码', 'Confirm new password')}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
        placeholder={tx('再次输入新密码', 'Enter the new password again')}
      />
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      <ActionButton busy={busy} disabled={!password || !confirmPassword} onPress={() => void submit()}>
        {tx('设置新密码并登录', 'Set password and sign in')}
      </ActionButton>
      <ThemedText type="small" themeColor="textSecondary">
        {tx('设置完成后需要用新密码重新登录。', 'You will sign in again with the new password.')}
      </ThemedText>
    </Screen>
  );
}
