import Head from 'expo-router/head';
import * as Linking from 'expo-linking';
import { StyleSheet, View } from 'react-native';

import { ActionButton, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { PublicPageFooter } from '@/components/public-page-footer';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim();

function HelpItem({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.item}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText themeColor="textSecondary">{children}</ThemedText>
    </View>
  );
}

export default function SupportScreen() {
  function contactSupport() {
    if (!supportEmail) return;
    const subject = encodeURIComponent('TripFlow 支持请求');
    void Linking.openURL(`mailto:${supportEmail}?subject=${subject}`);
  }

  return (
    <>
      <Head><title>支持与帮助｜TripFlow 旅途流</title></Head>
      <Screen eyebrow="TripFlow 旅途流" title="支持与帮助" subtitle="登录、行程协作和账目问题的快速处理方法。">
        <InfoCard label="常见问题" title="先试试这些方法">
          <View style={styles.content}>
            <HelpItem title="收不到登录邮件">
              检查垃圾邮件，确认邮箱拼写正确，并等待一分钟后重试。只使用最新一封邮件中的验证码或安全链接。
            </HelpItem>
            <HelpItem title="无法加入行程">
              邀请码可能已过期、被撤销或达到使用上限。请让行程所有者重新生成邀请。
            </HelpItem>
            <HelpItem title="账目或余额不正确">
              核对币种、付款人和参与成员。TripFlow 以最小货币单位保存金额，均分产生的余数会按固定顺序分配。
            </HelpItem>
            <HelpItem title="删除账号">
              登录后进入“我的 → 账号管理 → 删除账号”，阅读影响说明并再次确认。删除完成后无法恢复。
            </HelpItem>
          </View>
        </InfoCard>

        <InfoCard label="联系支持" title={supportEmail ?? '内测支持'} accent="#4B67D1">
          <View style={styles.content}>
            {supportEmail ? (
              <>
                <ThemedText themeColor="textSecondary">
                  请说明设备型号、系统版本、发生时间和错误文字；不要发送密码、验证码或完整登录链接。
                </ThemedText>
                <ActionButton onPress={contactSupport}>发送支持邮件</ActionButton>
              </>
            ) : (
              <InlineNotice>
                当前为邀请制内测，请通过原邀请渠道联系开发者。正式公开发布前，本页会公布长期支持邮箱。
              </InlineNotice>
            )}
          </View>
        </InfoCard>
        <PublicPageFooter />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18 },
  item: { gap: 5 },
});
