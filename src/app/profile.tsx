import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ConfirmSheet } from '@/components/confirm-sheet';
import { ChoiceChip, InlineNotice } from '@/components/form-controls';
import { PasswordSheet } from '@/components/password-sheet';
import { ProfileEditSheet, type AvatarDraft } from '@/components/profile-edit-sheet';
import { Screen } from '@/components/screen';
import { SettingsDivider, SettingsGroup, SettingsRow } from '@/components/settings-list';
import { SignInMethodsSheet } from '@/components/sign-in-methods-sheet';
import { ThemedText } from '@/components/themed-text';
import { tripRoleLabels, tripRoleLabelsEn } from '@/constants/options';
import { Spacing } from '@/constants/theme';
import { beginEmailLink, beginPhoneLink, changePassword, deleteAccount, linkGoogleIdentity, setInitialPassword, signOut, verifyEmailLink, verifyPhoneLink } from '@/features/auth/auth-service';
import { useAuth } from '@/features/auth/auth-provider';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/user-error';

type Panel = 'profile' | 'signIn' | 'password' | 'delete' | 'signout';

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { locale, setLocale, tx } = useI18n();
  const { capabilities, session } = useAuth();
  const { profile, activeTrip, members, currentUserId, saveProfile } = useMvp();
  const [panel, setPanel] = useState<Panel>();
  const [draftName, setDraftName] = useState('');
  const [avatarDraft, setAvatarDraft] = useState<AvatarDraft>();
  const [busyAction, setBusyAction] = useState<'save' | 'signout' | 'delete'>();
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string }>();
  const [panelError, setPanelError] = useState<string>();

  const membership = members.find(({ userId }) => userId === currentUserId);
  const roleLabel = membership
    ? (locale === 'zh-CN' ? tripRoleLabels[membership.role] : tripRoleLabelsEn[membership.role])
    : undefined;
  const shownName = profile?.displayName || tx('旅行者', 'Traveller');
  const avatarSource = avatarDraft?.uri ?? profile?.avatarUrl;
  const initials = shownName.trim().slice(0, 2).toUpperCase();
  const hasChanges = Boolean(avatarDraft || (draftName.trim() && draftName.trim() !== profile?.displayName));
  const googleLinked = Boolean(session?.user.identities?.some(({ provider }) => provider === 'google'));
  // A provider-only account has no password to re-authenticate against.
  const hasPassword = session?.user.identities?.some(({ provider }) => provider === 'email') ?? false;
  const linkedMethods = [
    session?.user.email ? tx('邮箱', 'Email') : undefined,
    session?.user.phone ? tx('手机号', 'Phone') : undefined,
    googleLinked ? 'Google' : undefined,
  ].filter(Boolean);

  function openPanel(next: Panel) {
    setNotice(undefined);
    setPanelError(undefined);
    if (next === 'profile') {
      setDraftName(profile?.displayName ?? '');
      setAvatarDraft(undefined);
    }
    setPanel(next);
  }

  function closePanel() {
    setPanel(undefined);
    setPanelError(undefined);
    setAvatarDraft(undefined);
    setDraftName('');
  }

  async function chooseAvatar() {
    setBusyAction('save');
    setPanelError(undefined);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPanelError(tx('请允许访问照片后再选择头像。', 'Allow photo access to choose an avatar.'));
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
    } catch (caught) {
      setPanelError(toUserMessage(caught, tx('无法打开照片，请稍后重试。', 'Could not open your photos. Please try again.')));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function save() {
    setBusyAction('save');
    setPanelError(undefined);
    try {
      await saveProfile({ displayName: draftName, avatar: avatarDraft });
      closePanel();
      setNotice({ tone: 'info', text: tx('个人资料已更新。', 'Profile updated.') });
    } catch (caught) {
      setPanelError(toUserMessage(caught, tx('无法保存个人资料，请稍后重试。', 'Could not save your profile. Please try again.')));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function beginLink(mode: 'email' | 'phone', value: string) {
    setBusyAction('save');
    setPanelError(undefined);
    try {
      return mode === 'email' ? await beginEmailLink(value) : await beginPhoneLink(value);
    } catch (caught) {
      setPanelError(toUserMessage(caught, tx('无法发送验证码，请检查后重试。', 'Could not send a code. Check the value and try again.')));
      return undefined;
    } finally {
      setBusyAction(undefined);
    }
  }

  async function confirmLink(mode: 'email' | 'phone', value: string, token: string) {
    setBusyAction('save');
    setPanelError(undefined);
    try {
      if (mode === 'email') await verifyEmailLink(value, token);
      else await verifyPhoneLink(value, token);
      closePanel();
      setNotice({ tone: 'info', text: tx('新的登录方式已绑定到当前账号。', 'The new sign-in method is linked to this account.') });
      return true;
    } catch (caught) {
      setPanelError(toUserMessage(caught, tx('验证码无效或已过期。', 'The code is invalid or expired.')));
      return false;
    } finally {
      setBusyAction(undefined);
    }
  }

  async function linkGoogle() {
    setBusyAction('save');
    setPanelError(undefined);
    try {
      await linkGoogleIdentity();
    } catch (caught) {
      setPanelError(toUserMessage(caught, tx('Google 绑定尚未配置或暂时不可用。', 'Google linking is not configured or temporarily unavailable.')));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function submitPassword({ current, next, confirm }: { current: string; next: string; confirm: string }) {
    setBusyAction('save');
    setPanelError(undefined);
    try {
      if (next !== confirm) {
        throw new Error(tx('两次输入的新密码不一致。', 'The new passwords do not match.'));
      }
      if (hasPassword) await changePassword(current, next);
      else await setInitialPassword(next);
      closePanel();
      setNotice({ tone: 'info', text: tx('密码已更新，下次登录请使用新密码。', 'Password updated. Use the new one next time you sign in.') });
      return true;
    } catch (caught) {
      setPanelError(toUserMessage(caught, tx('无法更新密码，请稍后重试。', 'Could not update the password. Please try again.')));
      return false;
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
      setPanelError(toUserMessage(caught, tx('退出登录失败，请稍后重试。', 'Could not sign out. Please try again.')));
      setBusyAction(undefined);
    }
  }

  async function removeAccount() {
    setBusyAction('delete');
    setPanelError(undefined);
    try {
      await deleteAccount();
    } catch (caught) {
      setPanelError(toUserMessage(caught, tx('删除账号失败，请稍后重试。', 'Could not delete the account. Please try again.')));
      setBusyAction(undefined);
    }
  }

  const context = [activeTrip?.name, roleLabel].filter((value): value is string => Boolean(value));

  return (
    <Screen context={context.length > 0 ? context : [tx('还没有选择行程', 'No trip selected')]} title={tx('我的', 'Me')}>
      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}

      <SettingsGroup>
        <SettingsRow
          label={shownName}
          subtitle={session?.user.email ?? tx('未提供邮箱', 'No email provided')}
          accessibilityLabel={tx('编辑个人资料', 'Edit profile')}
          leading={
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <ThemedText style={[styles.initials, { color: theme.accentOnSoft }]}>{initials}</ThemedText>
              )}
            </View>
          }
          onPress={() => openPanel('profile')}
        />
      </SettingsGroup>

      <SettingsGroup label={tx('偏好', 'Preferences')}>
        <SettingsRow
          label={tx('界面语言', 'App language')}
          control={
            <View style={styles.languageChoices}>
              <ChoiceChip role="radio" selected={locale === 'zh-CN'} onPress={() => setLocale('zh-CN')}>中文</ChoiceChip>
              <ChoiceChip role="radio" selected={locale === 'en'} onPress={() => setLocale('en')}>EN</ChoiceChip>
            </View>
          }
        />
        <SettingsDivider />
        <SettingsRow label={tx('当前行程', 'Current trip')} value={activeTrip?.name ?? tx('尚未选择', 'None selected')} />
        <SettingsDivider />
        <SettingsRow label={tx('当前权限', 'Trip role')} value={roleLabel ?? tx('暂无', 'None')} />
      </SettingsGroup>

      <SettingsGroup label={tx('账号与安全', 'Account and security')}>
        <SettingsRow
          label={tx('登录方式', 'Sign-in methods')}
          value={linkedMethods.length > 0 ? linkedMethods.join(' · ') : tx('未绑定', 'None linked')}
          onPress={() => openPanel('signIn')}
        />
        <SettingsDivider />
        <SettingsRow
          label={tx('密码', 'Password')}
          value={hasPassword ? tx('已设置', 'Set') : tx('未设置', 'Not set')}
          onPress={() => openPanel('password')}
        />
        <SettingsDivider />
        <SettingsRow label={tx('隐私政策', 'Privacy policy')} onPress={() => router.push('/privacy' as Href)} />
        <SettingsDivider />
        <SettingsRow label={tx('支持与帮助', 'Support and help')} onPress={() => router.push('/support' as Href)} />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          label={busyAction === 'signout' ? tx('正在退出…', 'Signing out…') : tx('退出登录', 'Sign out')}
          busy={busyAction === 'signout'}
          chevron={false}
          onPress={() => openPanel('signout')}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow label={tx('删除账号', 'Delete account')} labelColor="danger" onPress={() => openPanel('delete')} />
      </SettingsGroup>

      <ProfileEditSheet
        avatarSource={avatarSource}
        busy={busyAction === 'save'}
        draftAvatar={avatarDraft}
        draftName={draftName}
        error={panelError}
        hasChanges={hasChanges}
        initials={initials}
        onChangeName={setDraftName}
        onChooseAvatar={() => void chooseAvatar()}
        onDismiss={closePanel}
        onSave={() => void save()}
        tx={tx}
        visible={panel === 'profile'}
      />

      <SignInMethodsSheet
        busy={busyAction === 'save'}
        canLinkGoogle={capabilities.google}
        canLinkPhone={capabilities.phone}
        email={session?.user.email}
        error={panelError}
        googleLinked={googleLinked}
        onBeginLink={beginLink}
        onConfirmLink={confirmLink}
        onDismiss={closePanel}
        onLinkGoogle={() => void linkGoogle()}
        phone={session?.user.phone}
        tx={tx}
        visible={panel === 'signIn'}
      />

      <PasswordSheet
        busy={busyAction === 'save'}
        error={panelError}
        hasPassword={hasPassword}
        onDismiss={closePanel}
        onSubmit={submitPassword}
        tx={tx}
        visible={panel === 'password'}
      />

      <ConfirmSheet
        busy={busyAction === 'signout'}
        confirmLabel={tx('退出登录', 'Sign out')}
        consequence={tx('你可以稍后重新登录，行程和账本记录会保留。', 'Your trips and ledger will remain available when you sign in again.')}
        error={panelError}
        onConfirm={() => void logout()}
        onDismiss={closePanel}
        title={tx('退出当前账号？', 'Sign out of this account?')}
        tone="primary"
        visible={panel === 'signout'}
      />

      <ConfirmSheet
        busy={busyAction === 'delete'}
        confirmLabel={tx('确认永久删除', 'Delete permanently')}
        consequence={tx('你会退出所有行程，且此操作无法撤销。多人行程的共享记录会匿名保留。',
                        'You will leave every trip and this cannot be undone. Shared records remain anonymized.')}
        error={panelError}
        onConfirm={() => void removeAccount()}
        onDismiss={closePanel}
        title={tx('永久删除账号？', 'Permanently delete your account?')}
        visible={panel === 'delete'}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  initials: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  languageChoices: { flexDirection: 'row', gap: Spacing.xs },
});
