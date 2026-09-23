import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { OtpCodeInput } from '@/components/otp-code-input';
import { SettingsDivider, SettingsGroup, SettingsRow } from '@/components/settings-list';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type LinkMode = 'email' | 'phone';

export function SignInMethodsSheet({
  busy,
  canLinkGoogle,
  canLinkPhone,
  email,
  error,
  googleLinked,
  onBeginLink,
  onConfirmLink,
  onDismiss,
  onLinkGoogle,
  phone,
  tx,
  visible,
}: {
  busy: boolean;
  canLinkGoogle: boolean;
  canLinkPhone: boolean;
  email?: string;
  error?: string;
  googleLinked: boolean;
  onBeginLink: (mode: LinkMode, value: string) => Promise<string | undefined>;
  onConfirmLink: (mode: LinkMode, value: string, token: string) => Promise<boolean>;
  onDismiss: () => void;
  onLinkGoogle: () => void;
  phone?: string;
  tx: (zh: string, en: string) => string;
  visible: boolean;
}) {
  const [mode, setMode] = useState<LinkMode>();
  const [value, setValue] = useState('');
  const [token, setToken] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  function start(next: LinkMode) {
    setMode(next);
    setValue('');
    setToken('');
    setCodeSent(false);
  }

  function cancel() {
    setMode(undefined);
    setValue('');
    setToken('');
    setCodeSent(false);
  }

  async function sendCode() {
    if (!mode) return;
    const normalized = await onBeginLink(mode, value);
    if (normalized === undefined) return;
    setValue(normalized);
    setToken('');
    setCodeSent(true);
  }

  async function confirm() {
    if (!mode) return;
    if (await onConfirmLink(mode, value, token)) cancel();
  }

  return (
    <BottomSheet dismissDisabled={busy} onDismiss={() => { cancel(); onDismiss(); }} title={tx('登录方式', 'Sign-in methods')} visible={visible}>
      <View style={styles.body}>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

        {mode ? (
          <View style={styles.linkForm}>
            {codeSent ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  {tx(`验证码已发送至 ${value}`, `Code sent to ${value}`)}
                </ThemedText>
                <OtpCodeInput disabled={busy} value={token} onChangeText={setToken} />
                <ActionButton busy={busy} disabled={!/^\d{8}$/.test(token)} onPress={() => void confirm()}>
                  {tx('验证并绑定', 'Verify and link')}
                </ActionButton>
              </>
            ) : (
              <>
                <FormField
                  editable={!busy}
                  label={mode === 'email' ? tx('邮箱', 'Email') : tx('手机号（含国家区号）', 'Phone with country code')}
                  value={value}
                  onChangeText={setValue}
                  autoCapitalize="none"
                  keyboardType={mode === 'email' ? 'email-address' : 'phone-pad'}
                  placeholder={mode === 'email' ? 'you@example.com' : '+61412345678'}
                />
                <ActionButton busy={busy} disabled={!value.trim()} onPress={() => void sendCode()}>
                  {tx('发送验证码', 'Send code')}
                </ActionButton>
              </>
            )}
            <ActionButton tone="secondary" disabled={busy} onPress={cancel}>{tx('返回', 'Back')}</ActionButton>
          </View>
        ) : (
          <SettingsGroup>
            <SettingsRow
              label={tx('邮箱', 'Email')}
              disabled={busy}
              value={email ?? tx('未绑定', 'Not linked')}
              onPress={email ? undefined : () => start('email')}
            />
            {canLinkPhone || phone ? (
              <>
                <SettingsDivider />
                <SettingsRow
                  label={tx('手机号', 'Phone')}
                  disabled={busy}
                  value={phone ?? tx('未绑定', 'Not linked')}
                  onPress={phone ? undefined : () => start('phone')}
                />
              </>
            ) : null}
            {canLinkGoogle || googleLinked ? (
              <>
                <SettingsDivider />
                <SettingsRow
                  label="Google"
                  value={googleLinked ? tx('已绑定', 'Linked') : tx('未绑定', 'Not linked')}
                  busy={busy}
                  onPress={googleLinked ? undefined : onLinkGoogle}
                />
              </>
            ) : null}
          </SettingsGroup>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { width: '100%', gap: Spacing.sm },
  linkForm: { gap: Spacing.sm },
});
