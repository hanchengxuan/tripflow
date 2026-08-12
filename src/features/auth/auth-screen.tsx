import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Link, type Href, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { completeRegistration, sendEmailOtp, signInWithPassword, signOut, verifyEmailOtp } from '@/features/auth/auth-service';
import { useAuth } from '@/features/auth/auth-provider';
import { useI18n } from '@/features/i18n/i18n-provider';
import { parseInviteToken } from '@/features/invites/invite-link';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/user-error';

type AuthFlow = 'login' | 'register' | 'otp-login';
type AvatarDraft = { uri: string; mimeType?: string | null };

function useInviteToken() {
  const params = useLocalSearchParams<{ invite?: string | string[] }>();
  const value = Array.isArray(params.invite) ? params.invite[0] : params.invite;
  return value ? parseInviteToken(value) : undefined;
}

export function AuthScreen() {
  const { locale, setLocale, tx } = useI18n();
  const inviteToken = useInviteToken();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [flow, setFlow] = useState<AuthFlow>('login');
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function chooseFlow(nextFlow: AuthFlow) {
    setFlow(nextFlow);
    setVerifying(false);
    setToken('');
    setError(undefined);
  }

  async function login() {
    setBusy(true);
    setError(undefined);
    try {
      await signInWithPassword(email, password);
    } catch (caught) {
      setError(toUserMessage(caught, tx('邮箱或密码不正确。也可以改用邮箱验证码登录。', 'Email or password is incorrect. You can also use an email code.')));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    setBusy(true);
    setError(undefined);
    try {
      const normalized = await sendEmailOtp(email, flow === 'register');
      setEmail(normalized);
      setVerifying(true);
    } catch (caught) {
      setError(toUserMessage(caught, flow === 'register'
        ? tx('注册验证码发送失败，请稍后重试。', 'Could not send the registration code. Please try again.')
        : tx('登录验证码发送失败；如果还没有账号，请先选择注册。', 'Could not send a login code. Choose Register if you do not have an account.')));
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
      setError(toUserMessage(caught, tx('验证码无效或已过期，请重新获取。', 'The code is invalid or expired. Request a new one.')));
    } finally {
      setBusy(false);
    }
  }

  const cardLabel = flow === 'login' ? tx('登录', 'Sign in') : flow === 'register' ? tx('注册', 'Register') : tx('验证码登录', 'Code sign-in');
  return (
    <Screen
      meta={tx('TripFlow', 'TripFlow')}
      title={inviteToken ? tx('先登录或注册，再加入行程', 'Sign in or register to join') : tx('把大家的旅程放在一起', 'One trip, shared by everyone')}
      subtitle={tx('任何人都可以注册创建自己的行程；邀请只用于加入同行者的行程。', 'Anyone can register and create a trip. Invites are only needed to join someone else’s trip.')}>
      {inviteToken ? <InlineNotice>{tx('邀请已保留。完成登录或注册后，你仍需确认加入行程。', 'Your invite is saved. After signing in or registering, you will still confirm before joining.')}</InlineNotice> : null}
      <View style={styles.flowChoices}>
        <ChoiceChip selected={flow === 'login'} onPress={() => chooseFlow('login')}>{tx('密码登录', 'Sign in')}</ChoiceChip>
        <ChoiceChip selected={flow === 'register'} onPress={() => chooseFlow('register')}>{tx('免费注册', 'Register')}</ChoiceChip>
        <ChoiceChip selected={flow === 'otp-login'} onPress={() => chooseFlow('otp-login')}>{tx('验证码登录', 'Email code')}</ChoiceChip>
      </View>
      <InfoCard label={cardLabel} title={verifying ? email : flow === 'register' ? tx('创建你的 TripFlow 账号', 'Create your TripFlow account') : tx('欢迎回来', 'Welcome back')}>
        <View style={styles.form}>
          {!verifying ? (
            <>
              <FormField label={tx('邮箱', 'Email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" />
              {flow === 'login' ? <FormField label={tx('密码', 'Password')} value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="current-password" secureTextEntry placeholder={tx('输入密码', 'Enter password')} /> : null}
              {flow === 'login'
                ? <ActionButton busy={busy} disabled={!email.trim() || !password} onPress={() => void login()}>{tx('登录', 'Sign in')}</ActionButton>
                : <ActionButton busy={busy} disabled={!email.trim()} onPress={() => void sendCode()}>{flow === 'register' ? tx('发送注册验证码', 'Send registration code') : tx('发送登录验证码', 'Send login code')}</ActionButton>}
              {flow === 'register' ? <ThemedText type="small" themeColor="textSecondary">{tx('验证邮箱后，你将设置密码、显示名称和可选头像。', 'After verifying your email, you will set a password, display name, and optional avatar.')}</ThemedText> : null}
            </>
          ) : (
            <>
              <ThemedText themeColor="textSecondary">{tx('请输入邮件中的数字验证码（6 到 10 位）。', 'Enter the numeric code from the email (6–10 digits).')}</ThemedText>
              <FormField label={tx('邮件验证码', 'Email verification code')} value={token} onChangeText={setToken} keyboardType="number-pad" maxLength={10} placeholder="123456" />
              <ActionButton busy={busy} disabled={!/^\d{6,10}$/.test(token.replace(/\s/g, ''))} onPress={() => void verifyCode()}>{flow === 'register' ? tx('验证并继续注册', 'Verify and continue') : tx('验证并登录', 'Verify and sign in')}</ActionButton>
              <ActionButton tone="secondary" disabled={busy} onPress={() => setVerifying(false)}>{tx('更换邮箱', 'Use another email')}</ActionButton>
            </>
          )}
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        </View>
      </InfoCard>
      <LanguageAndLegal locale={locale} setLocale={setLocale} tx={tx} />
    </Screen>
  );
}

export function OnboardingScreen() {
  const theme = useTheme();
  const { session, finishOnboarding } = useAuth();
  const { locale, setLocale, tx } = useI18n();
  const inviteToken = useInviteToken();
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState<AvatarDraft>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function chooseAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(tx('请允许访问照片后再选择头像。', 'Allow photo access to choose an avatar.'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.82 });
    if (!result.canceled && result.assets[0]) setAvatar({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType });
  }

  async function finish() {
    if (!session) return;
    setBusy(true);
    setError(undefined);
    try {
      if (password !== confirmPassword) throw new Error(tx('两次输入的密码不一致。', 'Passwords do not match.'));
      await completeRegistration({ userId: session.user.id, displayName, password, avatar });
      finishOnboarding();
    } catch (caught) {
      setError(toUserMessage(caught, tx('无法完成注册，请检查资料后重试。', 'Could not complete registration. Check your details and try again.')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen meta={tx('最后一步', 'Final step')} title={tx('设置你的 TripFlow 账号', 'Set up your TripFlow account')} subtitle={tx('设置密码和基本资料后即可创建行程，或确认加入收到的邀请。', 'Set a password and basic profile, then create a trip or confirm an invite.')}>
      {inviteToken ? <InlineNotice>{tx('邀请仍然有效，完成资料后将回到加入确认。', 'Your invite is still available. You will return to its confirmation after setup.')}</InlineNotice> : null}
      <View style={[styles.onboardingCard, { backgroundColor: theme.backgroundElement }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('选择头像', 'Choose avatar')} onPress={() => void chooseAvatar()} style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
          {avatar ? <Image source={{ uri: avatar.uri }} style={styles.avatarImage} contentFit="cover" /> : <ThemedText type="smallBold">{tx('添加头像（可选）', 'Add avatar (optional)')}</ThemedText>}
        </Pressable>
        <FormField label={tx('显示名称', 'Display name')} value={displayName} onChangeText={setDisplayName} maxLength={80} placeholder={tx('同行者会看到这个名称', 'This is shown to travellers')} />
        <FormField label={tx('设置密码', 'Create password')} value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="new-password" secureTextEntry placeholder={tx('至少 8 位，包含字母和数字', '8+ characters with letters and numbers')} />
        <FormField label={tx('确认密码', 'Confirm password')} value={confirmPassword} onChangeText={setConfirmPassword} autoCapitalize="none" autoComplete="new-password" secureTextEntry placeholder={tx('再次输入密码', 'Enter password again')} />
        <ActionButton busy={busy} disabled={!displayName.trim() || !password || !confirmPassword} onPress={() => void finish()}>{inviteToken ? tx('完成注册并继续加入', 'Finish and continue to invite') : tx('完成注册', 'Finish registration')}</ActionButton>
        <ActionButton tone="secondary" disabled={busy} onPress={() => void signOut()}>{tx('退出并更换邮箱', 'Sign out and use another email')}</ActionButton>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      </View>
      <LanguageAndLegal locale={locale} setLocale={setLocale} tx={tx} />
    </Screen>
  );
}

function LanguageAndLegal(props: { locale: string; setLocale: (locale: 'zh-CN' | 'en') => void; tx: (zh: string, en: string) => string }) {
  return <><View style={styles.languageRow}><ChoiceChip selected={props.locale === 'zh-CN'} onPress={() => props.setLocale('zh-CN')}>简体中文</ChoiceChip><ChoiceChip selected={props.locale === 'en'} onPress={() => props.setLocale('en')}>English</ChoiceChip></View><View style={styles.legalLinks}><Link href={'/privacy' as Href} asChild><ThemedText type="linkPrimary">{props.tx('隐私政策', 'Privacy')}</ThemedText></Link><Link href={'/support' as Href} asChild><ThemedText type="linkPrimary">{props.tx('支持与帮助', 'Support')}</ThemedText></Link></View></>;
}

export function AuthLoadingScreen({ configured }: { configured: boolean }) {
  const { tx } = useI18n();
  return <Screen meta="TripFlow" title={configured ? tx('正在恢复你的旅程', 'Restoring your trip') : tx('需要完成配置', 'Setup required')} subtitle={configured ? tx('正在检查安全登录状态…', 'Checking your secure session…') : tx('请添加 Supabase 公共地址与发布密钥后再启动应用。', 'Add the Supabase public URL and publishable key before starting the app.')}>{!configured ? <InlineNotice tone="error">{tx('请设置 EXPO_PUBLIC_SUPABASE_URL 和 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY。', 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')}</InlineNotice> : null}</Screen>;
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  flowChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  onboardingCard: { borderRadius: 16, padding: 18, gap: 14 },
  avatar: { alignSelf: 'center', width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 12 },
  avatarImage: { width: '100%', height: '100%' },
  languageRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  legalLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, justifyContent: 'center' },
});
