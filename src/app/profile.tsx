import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { tripRoleLabels } from '@/constants/options';
import { signOut } from '@/features/auth/auth-service';
import { useAuth } from '@/features/auth/auth-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { toUserMessage } from '@/lib/user-error';

export default function ProfileScreen() {
  const { session } = useAuth();
  const { profile, activeTrip, members, currentUserId, saveProfile } = useMvp();
  const [draftName, setDraftName] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'save' | 'signout'>();
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  details: { gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
});
