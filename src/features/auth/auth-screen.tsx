import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Link, type Href, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { OtpCodeInput } from '@/components/otp-code-input';
import { Screen } from '@/components/screen';
import { GoogleMark } from '@/components/google-mark';
import { Radius, Size, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { completeRegistration, requestPasswordReset, sendEmailOtp, sendPhoneOtp, signInWithGoogle, signInWithPassword, signOut, verifyEmailOtp, verifyPhoneOtp } from '@/features/auth/auth-service';
import { useAuth } from '@/features/auth/auth-provider';
import { useI18n } from '@/features/i18n/i18n-provider';
import { parseInviteToken } from '@/features/invites/invite-link';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/user-error';

type AuthFlow = 'login' | 'register' | 'otp-login';
type AuthMethod = 'email' | 'phone';
type AvatarDraft = { uri: string; mimeType?: string | null };

const OTP_EXPIRY_SECONDS = 10 * 60;
const OTP_RESEND_COOLDOWN_SECONDS = 30;

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function useInviteToken() {
  const params = useLocalSearchParams<{ invite?: string | string[] }>();
  const value = Array.isArray(params.invite) ? params.invite[0] : params.invite;
  return value ? parseInviteToken(value) : undefined;
}

/** A path that is not the primary one: a 44pt text row, never a filled button. */
function AltLink({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.altLink, (pressed || disabled) && styles.providerPressed]}>
      <ThemedText type="smallBold" style={{ color: disabled ? theme.textMuted : theme.link }}>{label}</ThemedText>
    </Pressable>
  );
}

export function AuthScreen() {
  const theme = useTheme();
  const { locale, setLocale, tx } = useI18n();
  const inviteToken = useInviteToken();
  const { capabilities } = useAuth();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [token, setToken] = useState('');
  // The code path is the default: it needs no password, and it works the
  // same whether or not the reader already has an account. UI 2.0's auth page
  // specified this; only the chips-to-links half had been built.
  const [flow, setFlow] = useState<AuthFlow>('otp-login');
  const [method, setMethod] = useState<AuthMethod>('email');
  const [verifying, setVerifying] = useState(false);
  const [codeSentAt, setCodeSentAt] = useState<number>();
  const [clock, setClock] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const elapsedSeconds = codeSentAt ? Math.floor((clock - codeSentAt) / 1000) : 0;
  const resendSeconds = Math.max(0, OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
  const expirySeconds = Math.max(0, OTP_EXPIRY_SECONDS - elapsedSeconds);
  const codeExpired = Boolean(codeSentAt && expirySeconds === 0);

  useEffect(() => {
    if (!verifying || !codeSentAt || (resendSeconds === 0 && expirySeconds === 0)) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [codeSentAt, expirySeconds, resendSeconds, verifying]);

  function chooseFlow(nextFlow: AuthFlow) {
    setFlow(nextFlow);
    setVerifying(false);
    setCodeSentAt(undefined);
    setToken('');
    setError(undefined);
  }

  async function requestReset() {
    setBusy(true);
    setError(undefined);
    try {
      await requestPasswordReset(email);
      // Reported identically for a registered and an unregistered address:
      // confirming which emails exist would leak account enumeration.
      setResetSent(true);
    } catch (caught) {
      setError(toUserMessage(caught, tx('无法发送重置邮件，请稍后重试。', 'Could not send the reset email. Please try again.')));
    } finally {
      setBusy(false);
    }
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

  async function googleLogin() {
    setBusy(true);
    setError(undefined);
    try {
      await signInWithGoogle(inviteToken);
    } catch (caught) {
      setError(toUserMessage(caught, tx('Google 登录尚未配置或暂时不可用。', 'Google sign-in is not configured or temporarily unavailable.')));
      setBusy(false);
    }
  }

  async function sendCode() {
    setBusy(true);
    setError(undefined);
    try {
      if (method === 'email') {
        const normalized = await sendEmailOtp(email, flow === 'register');
        setEmail(normalized);
      } else {
        const normalized = await sendPhoneOtp(phone, true);
        setPhone(normalized);
      }
      setVerifying(true);
      setToken('');
      const sentAt = Date.now();
      setCodeSentAt(sentAt);
      setClock(sentAt);
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
      if (method === 'email') await verifyEmailOtp(email, token);
      else await verifyPhoneOtp(phone, token);
    } catch (caught) {
      setError(toUserMessage(caught, tx('验证码无效或已过期，请重新获取。', 'The code is invalid or expired. Request a new one.')));
    } finally {
      setBusy(false);
    }
  }

  const cardLabel = verifying
    ? tx('输入验证码', 'Enter the code')
    : method === 'phone' ? tx('手机号登录或注册', 'Phone sign-in or registration')
    : flow === 'login' ? tx('用密码登录', 'Sign in with a password')
    : flow === 'register' ? tx('注册新账号', 'Create an account')
    : tx('登录或注册', 'Sign in or register');
  const screenTitle = inviteToken ? tx('加入行程', 'Join a trip') : tx('结伴同行', 'Travel together');
  const screenSubtitle = inviteToken
    ? tx('登录后确认加入。', 'Sign in, then confirm.')
    : tx('从出发到汇合，一路清楚。', 'From departure to reunion, always clear.');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  return (
    <View style={[styles.authFrame, { backgroundColor: theme.background }] }>
      <ScrollView contentContainerStyle={[styles.authContent, compact && styles.authContentCompact, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.authLayout, !compact && styles.authLayoutWide]}>
          <View style={[styles.authIntro, !compact && styles.authIntroWide]}>
            <ThemedText type="smallBold" style={[styles.authBrand, { color: theme.accent }]}>TripFlow</ThemedText>
            <ThemedText type="subtitle" style={styles.authTitle}>{screenTitle}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.authSubtitle}>{screenSubtitle}</ThemedText>
            {inviteToken ? <ThemedText type="small" themeColor="textSecondary">{tx('邀请已保留。登录后仍需确认。', 'Your invite is saved. You will still confirm before joining.')}</ThemedText> : null}
          </View>
          <View style={[styles.authPanel, { backgroundColor: theme.backgroundElement, shadowColor: theme.shadow }]}>
            <ThemedText type="smallBold" style={styles.authPanelTitle}>{cardLabel}</ThemedText>
            {capabilities.google ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy }}
                  disabled={busy}
                  onPress={() => void googleLogin()}
                  style={({ pressed }) => [styles.provider, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, (pressed || busy) && styles.providerPressed]}>
                  <GoogleMark />
                  <ThemedText style={styles.providerLabel}>{tx('使用 Google 继续', 'Continue with Google')}</ThemedText>
                </Pressable>
                <View style={styles.divider}>
                  <View style={[styles.dividerRule, { backgroundColor: theme.border }]} />
                  <ThemedText type="small" themeColor="textMuted">{tx('或用邮箱', 'or with email')}</ThemedText>
                  <View style={[styles.dividerRule, { backgroundColor: theme.border }]} />
                </View>
              </>
            ) : null}
            {capabilities.phone ? (
              <View style={styles.methodChoices}>
                <ChoiceChip role="radio" selected={method === 'email'} onPress={() => { setMethod('email'); setVerifying(false); setToken(''); }}>{tx('邮箱', 'Email')}</ChoiceChip>
                <ChoiceChip role="radio" selected={method === 'phone'} onPress={() => { setMethod('phone'); setVerifying(false); setToken(''); }}>{tx('手机号', 'Phone')}</ChoiceChip>
              </View>
            ) : null}
            <View style={styles.form}>
          {!verifying ? (
            <>
              {method === 'email' ? <FormField label={tx('邮箱', 'Email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" /> : <FormField label={tx('手机号（含国家区号）', 'Phone with country code')} value={phone} onChangeText={setPhone} autoComplete="tel" keyboardType="phone-pad" placeholder="+61412345678" />}
              {method === 'email' && flow === 'login' ? <FormField label={tx('密码', 'Password')} value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="current-password" secureTextEntry placeholder={tx('输入密码', 'Enter password')} /> : null}
              {method === 'email' && flow === 'login'
                ? <>
                    <ActionButton busy={busy} disabled={!email.trim() || !password} onPress={() => void login()}>{tx('登录', 'Sign in')}</ActionButton>
                    {resetSent ? (
                      <InlineNotice>{tx('如果这个邮箱有账号，重置链接已发送。请查收邮件。', 'If that email has an account, a reset link is on its way.')}</InlineNotice>
                    ) : (
                      <Pressable accessibilityRole="button" disabled={busy || !email.trim()} onPress={() => void requestReset()} style={styles.forgotRow}>
                        <ThemedText style={[styles.switchLink, { color: theme.link }]}>{tx('忘记密码？', 'Forgot password?')}</ThemedText>
                      </Pressable>
                    )}
                  </>
                : <ActionButton busy={busy} disabled={method === 'email' ? !email.trim() : !phone.trim()} onPress={() => void sendCode()}>{method === 'phone' ? tx('发送短信验证码', 'Send SMS code') : flow === 'register' ? tx('发送注册验证码', 'Send registration code') : tx('发送登录验证码', 'Send login code')}</ActionButton>}
              {method === 'email' && flow === 'register' ? <ThemedText type="small" themeColor="textSecondary">{tx('验证邮箱后，你将设置密码、显示名称和可选头像。', 'After verifying your email, you will set a password, display name, and optional avatar.')}</ThemedText> : null}
              {/* The paths that are not the default are named here, after the
                  one that works — not as three chips above the field that a
                  reader has to understand before typing anything. */}
              {method === 'email' ? (
                <View style={[styles.altRow, { borderTopColor: theme.border }]}>
                  {flow !== 'otp-login' ? <AltLink label={tx('用验证码登录', 'Sign in with a code')} onPress={() => chooseFlow('otp-login')} /> : null}
                  {flow !== 'login' ? <AltLink label={tx('用密码登录', 'Sign in with a password')} onPress={() => chooseFlow('login')} /> : null}
                  {flow !== 'register' ? <AltLink label={tx('注册新账号', 'Create an account')} onPress={() => chooseFlow('register')} /> : null}
                </View>
              ) : null}
            </>
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {tx(`已发送到 ${method === 'email' ? email : phone}，8 位，${formatCountdown(expirySeconds)} 后过期。仅最新一封中的验证码有效。`,
                    `Sent to ${method === 'email' ? email : phone}. Eight digits, expires in ${formatCountdown(expirySeconds)}. Only the newest one works.`)}
              </ThemedText>
              <OtpCodeInput disabled={busy} value={token} onChangeText={setToken} />
              {codeExpired ? <InlineNotice tone="error">{tx('验证码已过期，请重新获取。', 'This code has expired. Request a new one.')}</InlineNotice> : null}
              <ActionButton busy={busy} disabled={codeExpired || !/^\d{8}$/.test(token)} onPress={() => void verifyCode()}>{method === 'phone' || flow === 'register' ? tx('验证并继续', 'Verify and continue') : tx('验证并登录', 'Verify and sign in')}</ActionButton>
              {/* One primary at a time. Resending and changing the address are
                  ways back, not competing paths forward. */}
              <View style={[styles.altRow, { borderTopColor: theme.border }]}>
                <AltLink
                  disabled={busy || resendSeconds > 0}
                  label={resendSeconds > 0 ? tx(`${resendSeconds} 秒后可重发`, `Resend in ${resendSeconds}s`) : tx('重新发送验证码', 'Resend code')}
                  onPress={() => void sendCode()}
                />
                <AltLink
                  disabled={busy}
                  label={method === 'email' ? tx('换一个邮箱', 'Use another email') : tx('换一个手机号', 'Use another phone')}
                  onPress={() => { setVerifying(false); setCodeSentAt(undefined); }}
                />
              </View>
            </>
          )}
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
            </View>
          </View>
        </View>
        <LanguageAndLegal locale={locale} setLocale={setLocale} tx={tx} />
      </ScrollView>
    </View>
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
  const provider = session?.user.app_metadata.provider;
  const requiresPassword = provider === 'email';

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
      if (requiresPassword && password !== confirmPassword) throw new Error(tx('两次输入的密码不一致。', 'Passwords do not match.'));
      await completeRegistration({ userId: session.user.id, displayName, password: requiresPassword ? password : undefined, avatar });
      finishOnboarding();
    } catch (caught) {
      setError(toUserMessage(caught, tx('无法完成注册，请检查资料后重试。', 'Could not complete registration. Check your details and try again.')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      context={[session?.user.email ?? session?.user.phone ?? tx('新账号', 'New account'), tx('最后一步', 'Final step')]}
      title={tx('设置你的账号', 'Set up your account')}>
      {inviteToken ? <InlineNotice>{tx('邀请仍然有效，完成资料后将回到加入确认。', 'Your invite is still available. You will return to its confirmation after setup.')}</InlineNotice> : null}
      <View style={[styles.onboardingCard, { backgroundColor: theme.backgroundElement }]}>
        {/* The same avatar row the profile panel uses: the label sits beside
            the circle instead of wrapping inside it. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('选择头像', 'Choose avatar')}
          onPress={() => void chooseAvatar()}
          style={({ pressed }) => [styles.avatarRow, pressed && styles.providerPressed]}>
          <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
            {avatar ? <Image source={{ uri: avatar.uri }} style={styles.avatarImage} contentFit="cover" /> : null}
          </View>
          <View style={styles.avatarCopy}>
            <ThemedText type="smallBold" themeColor="link">{avatar ? tx('换一张头像', 'Change avatar') : tx('添加头像', 'Add an avatar')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{tx('可选。JPG、PNG 或 WebP。', 'Optional. JPG, PNG or WebP.')}</ThemedText>
          </View>
        </Pressable>
        <FormField label={tx('显示名称', 'Display name')} value={displayName} onChangeText={setDisplayName} maxLength={80} placeholder={tx('同行者会看到这个名称', 'This is shown to travellers')} />
        {requiresPassword ? <><FormField label={tx('设置密码', 'Create password')} value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="new-password" secureTextEntry placeholder={tx('至少 8 位，包含字母和数字', '8+ characters with letters and numbers')} /><FormField label={tx('确认密码', 'Confirm password')} value={confirmPassword} onChangeText={setConfirmPassword} autoCapitalize="none" autoComplete="new-password" secureTextEntry placeholder={tx('再次输入密码', 'Enter password again')} /></> : null}
        <ActionButton busy={busy} disabled={!displayName.trim() || (requiresPassword && (!password || !confirmPassword))} onPress={() => void finish()}>{inviteToken ? tx('完成注册并继续加入', 'Finish and continue to invite') : tx('完成注册', 'Finish registration')}</ActionButton>
        <View style={[styles.altRow, { borderTopColor: theme.border }]}>
          <AltLink disabled={busy} label={tx('退出并换一个邮箱', 'Sign out and use another email')} onPress={() => void signOut()} />
        </View>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      </View>
      <LanguageAndLegal locale={locale} setLocale={setLocale} tx={tx} />
    </Screen>
  );
}

function LanguageAndLegal(props: { locale: string; setLocale: (locale: 'zh-CN' | 'en') => void; tx: (zh: string, en: string) => string }) {
  return <><View style={styles.languageRow}><ChoiceChip selected={props.locale === 'zh-CN'} onPress={() => props.setLocale('zh-CN')}>简体中文</ChoiceChip><ChoiceChip selected={props.locale === 'en'} onPress={() => props.setLocale('en')}>English</ChoiceChip></View><View style={styles.legalLinks}><Link href={'/privacy' as Href} asChild><Pressable accessibilityRole="link" style={styles.altLink}><ThemedText type="smallBold" themeColor="link">{props.tx('隐私政策', 'Privacy')}</ThemedText></Pressable></Link><Link href={'/support' as Href} asChild><Pressable accessibilityRole="link" style={styles.altLink}><ThemedText type="smallBold" themeColor="link">{props.tx('支持与帮助', 'Support')}</ThemedText></Pressable></Link></View></>;
}

export function SessionLoadingScreen({ configured }: { configured: boolean }) {
  const { tx } = useI18n();
  const theme = useTheme();
  if (configured) {
    return (
      <View
        accessible
        accessibilityLabel={tx('正在检查登录状态', 'Checking your sign-in status')}
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        style={[styles.loadingScreen, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  return (
    <Screen context={['TripFlow']} title={tx('需要完成配置', 'Setup required')}>
      <InlineNotice tone="error">
        {tx('应用还没有连接到 Supabase。请设置公共地址和发布密钥后重新启动。',
            'This build is not connected to Supabase yet. Set the public URL and publishable key, then restart.')}
      </InlineNotice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  authFrame: { flex: 1 },
  authContent: { width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: 20, gap: 26 },
  authContentCompact: { maxWidth: 560, gap: 22 },
  authLayout: { gap: 24 },
  authLayoutWide: { flexDirection: 'row', alignItems: 'center', gap: 56, minHeight: 520 },
  authIntro: { gap: 12 },
  authIntroWide: { flex: 1, paddingRight: 12 },
  authBrand: { letterSpacing: 0.5 },
  authTitle: { fontSize: 28, lineHeight: 34, letterSpacing: -0.4, maxWidth: 520 },
  authSubtitle: { fontSize: 15, lineHeight: 22, maxWidth: 440 },
  provider: { minHeight: Size.control, borderRadius: Radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  providerLabel: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  switchLink: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  providerPressed: { opacity: 0.68 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dividerRule: { flex: 1, height: 1 },
  authPanel: { flex: 1, maxWidth: 500, borderRadius: Radius.xl, padding: 20, gap: 16, shadowOpacity: 0.09, shadowRadius: 28, shadowOffset: { width: 0, height: 12 } },
  authPanelTitle: { fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  form: { gap: 12 },
  methodChoices: { flexDirection: 'row', gap: 8 },
  altRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 2, flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg },
  altLink: { minHeight: Size.touchMin, justifyContent: 'center' },
  forgotRow: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  onboardingCard: { borderRadius: Radius.lg, padding: 18, gap: Spacing.sm },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarCopy: { flex: 1, minWidth: 0, gap: 2 },
  avatarImage: { width: '100%', height: '100%' },
  languageRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  legalLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, justifyContent: 'center' },
});
