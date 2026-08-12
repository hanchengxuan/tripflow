import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link, type Href } from 'expo-router';

import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { sendEmailOtp, verifyEmailOtp } from '@/features/auth/auth-service';
import { toUserMessage } from '@/lib/user-error';
import { useI18n } from '@/features/i18n/i18n-provider';

export function AuthScreen() {
  const { locale, setLocale, tx } = useI18n();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function sendCode() {
    setBusy(true);
    setError(undefined);
    try {
      const normalized = await sendEmailOtp(email);
      setEmail(normalized);
      setStep('verify');
    } catch (caught) {
      setError(toUserMessage(caught, tx('登录邮件发送失败，请稍后重试。', 'Could not send the login email. Please try again.')));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError(undefined);
    try {
      await verifyEmailOtp(email, token);
    } catch (caught) {
      setError(toUserMessage(caught, tx('验证码校验失败，请重新获取验证码。', 'The code could not be verified. Request a new code and try again.')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      meta={tx('TripFlow 内测版', 'TripFlow beta')}
      title={tx('把大家的旅程放在一起', 'One trip, shared by everyone')}
      subtitle={tx('无需密码，通过邮箱安全登录；同行者可扫码或使用邀请码加入。', 'Sign in securely by email. Travellers can join by QR code or invite code.') }>
      <InfoCard label={step === 'email' ? tx('登录', 'Sign in') : tx('查看邮箱', 'Check your inbox')} title={step === 'email' ? tx('使用邮箱继续', 'Continue with email') : email}>
        <View style={styles.form}>
          {step === 'email' ? (
            <>
              <FormField
                label={tx('邮箱', 'Email')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
              />
              <ActionButton busy={busy} onPress={sendCode}>{tx('发送登录邮件', 'Send login email')}</ActionButton>
            </>
          ) : (
            <>
              <ThemedText themeColor="textSecondary">
                {tx('如果邮件中有六位验证码，请在下方输入；如果收到的是安全登录链接，请在当前设备上打开。', 'Enter the six-digit code below, or open the secure sign-in link on this device.')}
              </ThemedText>
              <FormField
                label={tx('六位验证码', 'Six-digit code')}
                value={token}
                onChangeText={setToken}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
              />
              <ActionButton busy={busy} onPress={verifyCode}>{tx('验证并登录', 'Verify and sign in')}</ActionButton>
              <ActionButton tone="secondary" disabled={busy} onPress={() => setStep('email')}>{tx('更换邮箱', 'Use another email')}</ActionButton>
            </>
          )}
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        </View>
      </InfoCard>
      <View style={styles.languageRow}>
        <ChoiceChip selected={locale === 'zh-CN'} onPress={() => setLocale('zh-CN')}>简体中文</ChoiceChip>
        <ChoiceChip selected={locale === 'en'} onPress={() => setLocale('en')}>English</ChoiceChip>
      </View>
      <View style={styles.legalLinks}>
        <Link href={'/privacy' as Href} asChild><ThemedText type="linkPrimary">{tx('隐私政策', 'Privacy')}</ThemedText></Link>
        <Link href={'/support' as Href} asChild><ThemedText type="linkPrimary">{tx('支持与帮助', 'Support')}</ThemedText></Link>
      </View>
    </Screen>
  );
}

export function AuthLoadingScreen({ configured }: { configured: boolean }) {
  const { tx } = useI18n();
  return (
    <Screen
      meta="TripFlow"
      title={configured ? tx('正在恢复你的旅程', 'Restoring your trip') : tx('需要完成配置', 'Setup required')}
      subtitle={configured ? tx('正在检查安全登录状态…', 'Checking your secure session…') : tx('请添加 Supabase 公共地址与发布密钥后再启动应用。', 'Add the Supabase public URL and publishable key before starting the app.')}>
      {!configured ? (
        <InlineNotice tone="error">
          {tx('请设置 EXPO_PUBLIC_SUPABASE_URL 和 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY。', 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')}
        </InlineNotice>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  languageRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  legalLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, justifyContent: 'center' },
});
