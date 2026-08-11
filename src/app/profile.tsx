import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link, type Href } from 'expo-router';

import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { tripRoleLabels, tripRoleLabelsEn } from '@/constants/options';
import { useI18n } from '@/features/i18n/i18n-provider';
import { deleteAccount, signOut } from '@/features/auth/auth-service';
import { useAuth } from '@/features/auth/auth-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { toUserMessage } from '@/lib/user-error';

export default function ProfileScreen() {
  const { locale, setLocale, tx } = useI18n();
  const { session } = useAuth();
  const { profile, activeTrip, members, currentUserId, saveProfile } = useMvp();
  const [draftName, setDraftName] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'save' | 'signout' | 'delete'>();
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string }>();
  const displayName = draftName ?? profile?.displayName ?? '';
  const membership = members.find(({ userId }) => userId === currentUserId);

  async function save() {
    setBusyAction('save');
    setNotice(undefined);
    try {
      await saveProfile(displayName);
      setDraftName(null);
      setNotice({ tone: 'info', text: tx('个人资料已更新。', 'Profile updated.') });
    } catch (caught) {
      setNotice({ tone: 'error', text: toUserMessage(caught, tx('无法保存个人资料，请稍后重试。', 'Could not save your profile. Please try again.')) });
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
    <Screen meta={tx('我的', 'Me')} title={profile?.displayName ?? tx('个人资料', 'Profile')} subtitle={tx('管理显示名称、语言与账号信息。', 'Manage your display name, language, and account.') }>
      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}
      <InfoCard label={tx('个人资料', 'Profile')} title={tx('编辑显示名称', 'Edit display name')}>
        <View style={styles.form}>
          <FormField
            label={tx('显示名称', 'Display name')}
            value={displayName}
            onChangeText={setDraftName}
            placeholder={tx('例如：小李', 'For example: Liam')}
            maxLength={80}
          />
          <ActionButton
            busy={busyAction === 'save'}
            disabled={!displayName.trim() || displayName.trim() === profile?.displayName}
            onPress={() => void save()}>
            {tx('保存资料', 'Save profile')}
          </ActionButton>
        </View>
      </InfoCard>

      <InfoCard label={tx('偏好设置', 'Preferences')} title={tx('语言与账号', 'Language and account')} accent="#1B70A6">
        <View style={styles.languageBlock}>
          <ThemedText type="smallBold">{tx('界面语言', 'App language')}</ThemedText>
          <View style={styles.linkRow}>
            <ChoiceChip selected={locale === 'zh-CN'} onPress={() => setLocale('zh-CN')}>简体中文</ChoiceChip>
            <ChoiceChip selected={locale === 'en'} onPress={() => setLocale('en')}>English</ChoiceChip>
          </View>
        </View>
        <View style={styles.details}>
          <View style={styles.row}>
            <ThemedText themeColor="textSecondary">{tx('邮箱', 'Email')}</ThemedText>
            <ThemedText>{session?.user.email ?? tx('未提供', 'Not provided')}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText themeColor="textSecondary">{tx('当前行程', 'Current trip')}</ThemedText>
            <ThemedText>{activeTrip?.name ?? tx('尚未选择', 'None selected')}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText themeColor="textSecondary">{tx('当前权限', 'Trip role')}</ThemedText>
            <ThemedText>{membership ? (locale === 'zh-CN' ? tripRoleLabels[membership.role] : tripRoleLabelsEn[membership.role]) : tx('暂无', 'None')}</ThemedText>
          </View>
        </View>
      </InfoCard>

      <ActionButton tone="danger" busy={busyAction === 'signout'} onPress={() => void logout()}>
        {tx('退出登录', 'Sign out')}
      </ActionButton>

      <InfoCard label={tx('隐私与数据', 'Privacy and data')} title={tx('账号管理', 'Account controls')} accent="#B4413E">
        <View style={styles.form}>
          <ThemedText themeColor="textSecondary">
            {tx('你可以查看隐私政策、获取支持，或永久删除 TripFlow 账号。', 'Review the privacy policy, get support, or permanently delete your TripFlow account.')}
          </ThemedText>
          <View style={styles.linkRow}>
            <Link href={'/privacy' as Href} asChild><ThemedText type="linkPrimary">{tx('隐私政策', 'Privacy')}</ThemedText></Link>
            <Link href={'/support' as Href} asChild><ThemedText type="linkPrimary">{tx('支持与帮助', 'Support')}</ThemedText></Link>
          </View>
          {confirmingDeletion ? (
            <View style={styles.dangerZone}>
              <ThemedText type="smallBold">{tx('确认永久删除账号？', 'Permanently delete your account?')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {tx('登录凭据和个人名称会被删除，你会退出所有行程。只有你一人的行程会被删除；多人行程会转交其他成员，共享账目与行程记录会匿名保留。此操作无法撤销。', 'Your sign-in and name will be deleted and you will leave every trip. Solo trips are deleted; shared trips transfer to another member and retain anonymized records. This cannot be undone.')}
              </ThemedText>
              <ActionButton tone="danger" busy={busyAction === 'delete'} onPress={() => void removeAccount()}>
                {tx('确认永久删除', 'Delete permanently')}
              </ActionButton>
              <ActionButton tone="secondary" disabled={busyAction === 'delete'} onPress={() => setConfirmingDeletion(false)}>
                {tx('取消', 'Cancel')}
              </ActionButton>
            </View>
          ) : (
            <ActionButton tone="danger" onPress={() => setConfirmingDeletion(true)}>
              {tx('删除账号', 'Delete account')}
            </ActionButton>
          )}
        </View>
      </InfoCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  details: { gap: 12 },
  languageBlock: { gap: 8, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  dangerZone: { gap: 12, borderRadius: 12, padding: 14, backgroundColor: '#F7D9D7' },
});
