import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Link, type Href } from 'expo-router';

import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { tripRoleLabels } from '@/constants/options';
import { deleteAccount, signOut } from '@/features/auth/auth-service';
import { useAuth } from '@/features/auth/auth-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { toUserMessage } from '@/lib/user-error';

export default function ProfileScreen() {
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
      setNotice({ tone: 'info', text: '个人资料已更新。' });
    } catch (caught) {
      setNotice({ tone: 'error', text: toUserMessage(caught, '无法保存个人资料，请稍后重试。') });
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
      setNotice({ tone: 'error', text: toUserMessage(caught, '退出登录失败，请稍后重试。') });
      setBusyAction(undefined);
    }
  }

  async function removeAccount() {
    setBusyAction('delete');
    setNotice(undefined);
    try {
      await deleteAccount();
    } catch (caught) {
      setNotice({ tone: 'error', text: toUserMessage(caught, '删除账号失败，请稍后重试。') });
      setBusyAction(undefined);
    }
  }

  return (
    <Screen eyebrow="我的" title={profile?.displayName ?? '个人资料'} subtitle="管理你的显示名称与账号信息。">
      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}
      <InfoCard label="个人资料" title="编辑显示名称">
        <View style={styles.form}>
          <FormField
            label="显示名称"
            value={displayName}
            onChangeText={setDraftName}
            placeholder="例如：小李"
            maxLength={80}
          />
          <ActionButton
            busy={busyAction === 'save'}
            disabled={!displayName.trim() || displayName.trim() === profile?.displayName}
            onPress={() => void save()}>
            保存资料
          </ActionButton>
        </View>
      </InfoCard>

      <InfoCard label="账号" title="登录信息" accent="#4B67D1">
        <View style={styles.details}>
          <View style={styles.row}>
            <ThemedText themeColor="textSecondary">邮箱</ThemedText>
            <ThemedText>{session?.user.email ?? '未提供'}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText themeColor="textSecondary">当前行程</ThemedText>
            <ThemedText>{activeTrip?.name ?? '尚未选择'}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText themeColor="textSecondary">当前权限</ThemedText>
            <ThemedText>{membership ? tripRoleLabels[membership.role] : '暂无'}</ThemedText>
          </View>
          <View style={styles.row}>
            <ThemedText themeColor="textSecondary">界面语言</ThemedText>
            <ThemedText>简体中文</ThemedText>
          </View>
        </View>
      </InfoCard>

      <ActionButton tone="danger" busy={busyAction === 'signout'} onPress={() => void logout()}>
        退出登录
      </ActionButton>

      <InfoCard label="隐私与数据" title="账号管理" accent="#B4413E">
        <View style={styles.form}>
          <ThemedText themeColor="textSecondary">
            你可以查看隐私政策、获取支持，或永久删除 TripFlow 账号。
          </ThemedText>
          <View style={styles.linkRow}>
            <Link href={'/privacy' as Href} asChild><ThemedText type="linkPrimary">隐私政策</ThemedText></Link>
            <Link href={'/support' as Href} asChild><ThemedText type="linkPrimary">支持与帮助</ThemedText></Link>
          </View>
          {confirmingDeletion ? (
            <View style={styles.dangerZone}>
              <ThemedText type="smallBold">确认永久删除账号？</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                登录凭据和个人名称会被删除，你会退出所有行程。只有你一人的行程会被删除；多人行程会转交其他成员，共享账目与行程记录会匿名保留。此操作无法撤销。
              </ThemedText>
              <ActionButton tone="danger" busy={busyAction === 'delete'} onPress={() => void removeAccount()}>
                确认永久删除
              </ActionButton>
              <ActionButton tone="secondary" disabled={busyAction === 'delete'} onPress={() => setConfirmingDeletion(false)}>
                取消
              </ActionButton>
            </View>
          ) : (
            <ActionButton tone="danger" onPress={() => setConfirmingDeletion(true)}>
              删除账号
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
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  dangerZone: { gap: 12, borderRadius: 12, padding: 14, backgroundColor: '#F7D9D7' },
});
