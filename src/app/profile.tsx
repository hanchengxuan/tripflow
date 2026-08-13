import { useState } from 'react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Link, type Href } from 'expo-router';
import { LayoutAnimation, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { OtpCodeInput } from '@/components/otp-code-input';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { tripRoleLabels, tripRoleLabelsEn } from '@/constants/options';
import { beginEmailLink, beginPhoneLink, deleteAccount, linkGoogleIdentity, signOut, verifyEmailLink, verifyPhoneLink } from '@/features/auth/auth-service';
import { useAuth } from '@/features/auth/auth-provider';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/user-error';

type AvatarDraft = { uri: string; mimeType?: string | null };

export default function ProfileScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const { locale, setLocale, tx } = useI18n();
  const { capabilities, session } = useAuth();
  const { profile, activeTrip, members, currentUserId, saveProfile } = useMvp();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [avatarDraft, setAvatarDraft] = useState<AvatarDraft>();
  const [busyAction, setBusyAction] = useState<'save' | 'signout' | 'delete'>();
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string }>();
  const [linkMode, setLinkMode] = useState<'email' | 'phone'>();
  const [linkValue, setLinkValue] = useState('');
  const [linkToken, setLinkToken] = useState('');
  const [linkCodeSent, setLinkCodeSent] = useState(false);
  const [showSignInMethods, setShowSignInMethods] = useState(false);
  const membership = members.find(({ userId }) => userId === currentUserId);
  const shownName = profile?.displayName || tx('旅行者', 'Traveller');
  const avatarSource = avatarDraft?.uri ?? profile?.avatarUrl;
  const initials = shownName.trim().slice(0, 2).toUpperCase();
  const hasChanges = Boolean(
    avatarDraft || (draftName.trim() && draftName.trim() !== profile?.displayName),
  );
  const googleLinked = session?.user.identities?.some(({ provider }) => provider === 'google');

  async function startLink() {
    if (!linkMode) return;
    setBusyAction('save');
    setNotice(undefined);
    try {
      const normalized = linkMode === 'email' ? await beginEmailLink(linkValue) : await beginPhoneLink(linkValue);
      setLinkValue(normalized);
      setLinkToken('');
      setLinkCodeSent(true);
    } catch (caught) {
      setNotice({ tone: 'error', text: toUserMessage(caught, tx('无法发送验证码，请检查后重试。', 'Could not send a code. Check the value and try again.')) });
    } finally {
      setBusyAction(undefined);
    }
  }

  async function confirmLink() {
    if (!linkMode) return;
    setBusyAction('save');
    setNotice(undefined);
    try {
      if (linkMode === 'email') await verifyEmailLink(linkValue, linkToken);
      else await verifyPhoneLink(linkValue, linkToken);
      setNotice({ tone: 'info', text: tx('新的登录方式已绑定到当前账号。', 'The new sign-in method is linked to this account.') });
      setLinkMode(undefined);
      setLinkCodeSent(false);
      setLinkValue('');
      setLinkToken('');
    } catch (caught) {
      setNotice({ tone: 'error', text: toUserMessage(caught, tx('验证码无效或已过期。', 'The code is invalid or expired.')) });
    } finally {
      setBusyAction(undefined);
    }
  }

  async function linkGoogle() {
    setBusyAction('save');
    setNotice(undefined);
    try {
      await linkGoogleIdentity();
    } catch (caught) {
      setNotice({ tone: 'error', text: toUserMessage(caught, tx('Google 绑定尚未配置或暂时不可用。', 'Google linking is not configured or temporarily unavailable.')) });
      setBusyAction(undefined);
    }
  }

  function beginEditing() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDraftName(profile?.displayName ?? '');
    setAvatarDraft(undefined);
    setEditing(true);
    setNotice(undefined);
  }

  function cancelEditing() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditing(false);
    setAvatarDraft(undefined);
    setDraftName('');
  }

  async function chooseAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice({
        tone: 'error',
        text: tx('请允许访问照片后再选择头像。', 'Allow photo access to choose an avatar.'),
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarDraft({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType });
    }
  }

  async function save() {
    setBusyAction('save');
    setNotice(undefined);
    try {
      await saveProfile({ displayName: draftName, avatar: avatarDraft });
      setEditing(false);
      setAvatarDraft(undefined);
      setNotice({ tone: 'info', text: tx('个人资料已更新。', 'Profile updated.') });
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: toUserMessage(caught, tx('无法保存个人资料，请稍后重试。', 'Could not save your profile. Please try again.')),
      });
    } finally {
      setBusyAction(undefined);
    }
  }

  async function logout() {
    setBusyAction('signout');
    setNotice(undefined);
    try {
      await signOut();
    } catch (caught) {
      setNotice({ tone: 'error', text: toUserMessage(caught, tx('退出登录失败，请稍后重试。', 'Could not sign out. Please try again.')) });
      setBusyAction(undefined);
    }
  }

  async function removeAccount() {
    setBusyAction('delete');
    setNotice(undefined);
    try {
      await deleteAccount();
    } catch (caught) {
      setNotice({ tone: 'error', text: toUserMessage(caught, tx('删除账号失败，请稍后重试。', 'Could not delete the account. Please try again.')) });
      setBusyAction(undefined);
    }
  }

  return (
    <Screen title={tx('我的', 'Me')} subtitle={tx('资料 · 偏好 · 安全', 'Profile · preferences · security')}>
      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}

      <View style={[styles.identity, compact && styles.identityCompact]}>
        <Pressable
          accessibilityLabel={tx('更换头像', 'Change avatar')}
          accessibilityRole="button"
          disabled={!editing}
          onPress={() => void chooseAvatar()}
          style={[styles.avatar, { backgroundColor: theme.backgroundSelected }] }>
          {avatarSource ? (
            <Image source={{ uri: avatarSource }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <ThemedText style={styles.initials}>{initials}</ThemedText>
          )}
          {editing ? (
            <View style={styles.avatarEditBadge}>
              <ThemedText type="smallBold" style={styles.avatarEditText}>{tx('更换', 'Edit')}</ThemedText>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.identityCopy}>
          <ThemedText type="subtitle" style={styles.profileName}>{shownName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {session?.user.email ?? tx('未提供邮箱', 'No email provided')}
          </ThemedText>
        </View>
        {!editing ? (
          <Pressable accessibilityRole="button" onPress={beginEditing} style={[styles.editButton, { backgroundColor: theme.backgroundSelected }] }>
            <ThemedText type="smallBold">{tx('编辑资料', 'Edit')}</ThemedText>
          </Pressable>
        ) : null}
      </View>

      {editing ? (
        <View style={[styles.editor, { backgroundColor: theme.backgroundElement }] }>
          <FormField
            label={tx('显示名称', 'Display name')}
            value={draftName}
            onChangeText={setDraftName}
            placeholder={tx('例如：小李', 'For example: Liam')}
            maxLength={80}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {tx('头像支持 JPG、PNG 或 WebP，最大 5 MB。', 'Use a JPG, PNG, or WebP image up to 5 MB.')}
          </ThemedText>
          <View style={[styles.editorActions, compact && styles.editorActionsCompact]}>
            <View style={styles.actionGrow}>
              <ActionButton tone="secondary" disabled={busyAction === 'save'} onPress={cancelEditing}>{tx('取消', 'Cancel')}</ActionButton>
            </View>
            <View style={styles.actionGrow}>
              <ActionButton busy={busyAction === 'save'} disabled={!draftName.trim() || !hasChanges} onPress={() => void save()}>{tx('保存更改', 'Save changes')}</ActionButton>
            </View>
          </View>
          {!hasChanges ? <ThemedText type="small" themeColor="textSecondary">{tx('修改名称或头像后即可保存。', 'Change your name or avatar to save.')}</ThemedText> : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">{tx('偏好设置', 'Preferences')}</ThemedText>
        <View style={[styles.settingRow, compact && styles.settingRowCompact]}>
          <View style={styles.settingCopy}>
            <ThemedText>{tx('界面语言', 'App language')}</ThemedText>
          </View>
          <View style={styles.languageChoices}>
            <ChoiceChip role="radio" selected={locale === 'zh-CN'} onPress={() => setLocale('zh-CN')}>中文</ChoiceChip>
            <ChoiceChip role="radio" selected={locale === 'en'} onPress={() => setLocale('en')}>EN</ChoiceChip>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
        <SettingValue label={tx('当前行程', 'Current trip')} value={activeTrip?.name ?? tx('尚未选择', 'None selected')} />
        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
        <SettingValue
          label={tx('当前权限', 'Trip role')}
          value={membership ? (locale === 'zh-CN' ? tripRoleLabels[membership.role] : tripRoleLabelsEn[membership.role]) : tx('暂无', 'None')}
        />
      </View>

      <View style={styles.section}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showSignInMethods }}
          onPress={() => setShowSignInMethods((current) => !current)}
          style={({ pressed }) => [styles.sectionDisclosure, pressed && styles.pressed]}>
          <View style={styles.settingCopy}><ThemedText type="smallBold" themeColor="textSecondary">{tx('登录方式', 'Sign-in methods')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{session?.user.email ?? tx('查看绑定方式', 'Manage linked accounts')}</ThemedText></View>
          <Chevron color={theme.textSecondary} direction={showSignInMethods ? 'down' : 'right'} />
        </Pressable>
        {showSignInMethods ? <View style={styles.disclosureBody}>
        <SettingValue label={tx('邮箱', 'Email')} value={session?.user.email ?? tx('未绑定', 'Not linked')} />
        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
        <SettingValue label={tx('手机号', 'Phone')} value={session?.user.phone ?? tx('未绑定', 'Not linked')} />
        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
        <SettingValue label="Google" value={googleLinked ? tx('已绑定', 'Linked') : tx('未绑定', 'Not linked')} />
        <View style={styles.loginActions}>
          {!session?.user.email ? <ActionButton tone="secondary" onPress={() => { setLinkMode('email'); setLinkCodeSent(false); setLinkValue(''); }}>{tx('添加邮箱', 'Add email')}</ActionButton> : null}
          {capabilities.phone && !session?.user.phone ? <ActionButton tone="secondary" onPress={() => { setLinkMode('phone'); setLinkCodeSent(false); setLinkValue(''); }}>{tx('添加手机号', 'Add phone')}</ActionButton> : null}
          {capabilities.google && !googleLinked ? <ActionButton tone="secondary" busy={busyAction === 'save'} onPress={() => void linkGoogle()}>{tx('绑定 Google', 'Link Google')}</ActionButton> : null}
        </View>
        {linkMode ? (
          <View style={[styles.linkEditor, { backgroundColor: theme.backgroundElement }]}>
            {!linkCodeSent ? <FormField label={linkMode === 'email' ? tx('邮箱', 'Email') : tx('手机号（含国家区号）', 'Phone with country code')} value={linkValue} onChangeText={setLinkValue} autoCapitalize="none" keyboardType={linkMode === 'email' ? 'email-address' : 'phone-pad'} placeholder={linkMode === 'email' ? 'you@example.com' : '+61412345678'} /> : <><ThemedText type="small" themeColor="textSecondary">{tx(`验证码已发送至 ${linkValue}`, `Code sent to ${linkValue}`)}</ThemedText><OtpCodeInput value={linkToken} onChangeText={setLinkToken} /></>}
            {linkCodeSent ? <ActionButton busy={busyAction === 'save'} disabled={!/^\d{8}$/.test(linkToken)} onPress={() => void confirmLink()}>{tx('验证并绑定', 'Verify and link')}</ActionButton> : <ActionButton busy={busyAction === 'save'} disabled={!linkValue.trim()} onPress={() => void startLink()}>{tx('发送验证码', 'Send code')}</ActionButton>}
            <ActionButton tone="secondary" disabled={busyAction === 'save'} onPress={() => { setLinkMode(undefined); setLinkCodeSent(false); }}>{tx('取消', 'Cancel')}</ActionButton>
          </View>
        ) : null}
        </View> : null}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">{tx('账号与安全', 'Account and security')}</ThemedText>
        <View style={styles.linkList}>
          <Link href={'/privacy' as Href} asChild><Pressable style={styles.linkRow}><ThemedText>{tx('隐私政策', 'Privacy policy')}</ThemedText><ThemedText type="smallBold" themeColor="textSecondary">{tx('查看', 'Open')}</ThemedText></Pressable></Link>
          <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
          <Link href={'/support' as Href} asChild><Pressable style={styles.linkRow}><ThemedText>{tx('支持与帮助', 'Support and help')}</ThemedText><ThemedText type="smallBold" themeColor="textSecondary">{tx('查看', 'Open')}</ThemedText></Pressable></Link>
          <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
          <Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.linkRow}>
            <ThemedText>{busyAction === 'signout' ? tx('正在退出…', 'Signing out…') : tx('退出登录', 'Sign out')}</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.dangerSection}>
        {confirmingDeletion ? (
          <View style={[styles.deleteConfirmation, { backgroundColor: theme.backgroundElement }] }>
            <ThemedText type="smallBold">{tx('确认永久删除账号？', 'Permanently delete your account?')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {tx('你会退出所有行程，且此操作无法撤销。多人行程的共享记录会匿名保留。', 'You will leave every trip and this cannot be undone. Shared records remain anonymized.')}
            </ThemedText>
            <ActionButton tone="danger" busy={busyAction === 'delete'} onPress={() => void removeAccount()}>{tx('确认永久删除', 'Delete permanently')}</ActionButton>
            <ActionButton tone="secondary" disabled={busyAction === 'delete'} onPress={() => setConfirmingDeletion(false)}>{tx('取消', 'Cancel')}</ActionButton>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setConfirmingDeletion(true)}>
            <ThemedText type="smallBold" style={styles.dangerText}>{tx('删除账号', 'Delete account')}</ThemedText>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

function SettingValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.valueRow}>
      <ThemedText>{label}</ThemedText>
      <ThemedText type="smallBold" numberOfLines={1} style={styles.valueText}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8 },
  identityCompact: { flexWrap: 'wrap', alignItems: 'flex-start' },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  initials: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: '#087F6A' },
  avatarEditBadge: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 28, backgroundColor: 'rgba(12,25,36,0.72)', alignItems: 'center', justifyContent: 'center' },
  avatarEditText: { color: '#FFFFFF' },
  identityCopy: { flex: 1, minWidth: 0, gap: 2 },
  profileName: { fontSize: 28, lineHeight: 36 },
  editButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  editor: { borderRadius: 16, padding: 18, gap: 12, shadowColor: '#17324D', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 7 } },
  editorActions: { flexDirection: 'row', gap: 10 },
  editorActionsCompact: { flexDirection: 'column' },
  actionGrow: { flex: 1 },
  section: { gap: 14, paddingTop: 18 },
  sectionDisclosure: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  disclosureBody: { gap: 14 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  settingRowCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  settingCopy: { flex: 1, gap: 2 },
  languageChoices: { flexDirection: 'row', gap: 8 },
  divider: { height: StyleSheet.hairlineWidth },
  valueRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  valueText: { flexShrink: 1, textAlign: 'right' },
  linkList: { gap: 0 },
  loginActions: { gap: 8 },
  linkEditor: { borderRadius: 16, padding: 16, gap: 12 },
  linkRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  dangerSection: { paddingTop: 10, paddingBottom: 16 },
  deleteConfirmation: { borderRadius: 16, padding: 18, gap: 12 },
  dangerText: { color: '#B4413E', paddingVertical: 14 },
  pressed: { opacity: 0.68 },
});
