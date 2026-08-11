import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link, type Href } from 'expo-router';

import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { sendEmailOtp, verifyEmailOtp } from '@/features/auth/auth-service';
import { toUserMessage } from '@/lib/user-error';

export function AuthScreen() {
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
      setError(toUserMessage(caught, '登录邮件发送失败，请稍后重试。'));
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
      setError(toUserMessage(caught, '验证码校验失败，请重新获取验证码。'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      eyebrow="TripFlow 内测版"
      title="把大家的旅程放在一起"
      subtitle="无需密码，通过邮箱安全登录；同行者可使用邀请码加入。">
      <InfoCard label={step === 'email' ? '登录' : '查看邮箱'} title={step === 'email' ? '使用邮箱继续' : email}>
        <View style={styles.form}>
          {step === 'email' ? (
            <>
              <FormField
                label="邮箱"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
              />
              <ActionButton busy={busy} onPress={sendCode}>发送登录邮件</ActionButton>
            </>
          ) : (
            <>
              <ThemedText themeColor="textSecondary">
                如果邮件中有六位验证码，请在下方输入；如果收到的是安全登录链接，请在当前设备上打开。
              </ThemedText>
              <FormField
                label="六位验证码"
                value={token}
                onChangeText={setToken}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
              />
              <ActionButton busy={busy} onPress={verifyCode}>验证并登录</ActionButton>
              <ActionButton tone="secondary" disabled={busy} onPress={() => setStep('email')}>更换邮箱</ActionButton>
            </>
          )}
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        </View>
      </InfoCard>
      <View style={styles.legalLinks}>
        <Link href={'/privacy' as Href} asChild><ThemedText type="linkPrimary">隐私政策</ThemedText></Link>
        <Link href={'/support' as Href} asChild><ThemedText type="linkPrimary">支持与帮助</ThemedText></Link>
      </View>
    </Screen>
  );
}

export function AuthLoadingScreen({ configured }: { configured: boolean }) {
  return (
    <Screen
      eyebrow="TripFlow"
      title={configured ? '正在恢复你的旅程' : '需要完成配置'}
      subtitle={configured ? '正在检查安全登录状态…' : '请添加 Supabase 公共地址与发布密钥后再启动应用。'}>
      {!configured ? (
        <InlineNotice tone="error">
          请设置 EXPO_PUBLIC_SUPABASE_URL 和 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY。
        </InlineNotice>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  legalLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, justifyContent: 'center' },
});
