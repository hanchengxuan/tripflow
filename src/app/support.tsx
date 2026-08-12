import Head from 'expo-router/head';
import * as Linking from 'expo-linking';
import { StyleSheet, View } from 'react-native';

import { ActionButton, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { PublicPageFooter } from '@/components/public-page-footer';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useI18n } from '@/features/i18n/i18n-provider';

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
  const { tx } = useI18n();
  function contactSupport() {
    if (!supportEmail) return;
    const subject = encodeURIComponent(tx('TripFlow 支持请求', 'TripFlow support request'));
    void Linking.openURL(`mailto:${supportEmail}?subject=${subject}`);
  }

  return (
    <>
      <Head><title>{tx('支持与帮助｜TripFlow 旅途流', 'Support | TripFlow')}</title></Head>
      <Screen meta="TripFlow 旅途流" title={tx('支持与帮助', 'Support')} subtitle={tx('登录、行程协作和账目问题的快速处理方法。', 'Quick help for sign-in, shared trips, and expenses.')}>
        <InfoCard label={tx('常见问题', 'Common issues')} title={tx('先试试这些方法', 'Try these steps first')}>
          <View style={styles.content}>
            <HelpItem title={tx('收不到登录邮件', 'No login email')}>
              {tx('检查垃圾邮件，确认邮箱拼写正确，并等待一分钟后重试。只使用最新一封邮件中的验证码或安全链接。', 'Check spam, confirm the address, wait one minute, and retry. Only use the newest code or secure link.')}
            </HelpItem>
            <HelpItem title={tx('无法加入行程', 'Cannot join a trip')}>
              {tx('二维码和邀请码可能已过期、被撤销或达到使用上限。请让行程所有者重新生成邀请；扫码后可先注册或登录，邀请会保留到资料完成，最后仍需确认加入。相机权限被拒绝时仍可粘贴邀请码。', 'The QR code or invite may be expired, revoked, or used up. Ask the trip owner for a new invite. After scanning, register or sign in; the invite stays available through profile setup and still requires confirmation. If camera access is denied, you can paste the code.')}
            </HelpItem>
            <HelpItem title={tx('账目或余额不正确', 'An expense or balance looks wrong')}>
              {tx('核对币种、付款人和参与成员。TripFlow 以最小货币单位保存金额，均分产生的余数会按固定顺序分配。', 'Check the currency, payer, and participants. TripFlow stores exact minor units and allocates split remainders deterministically.')}
            </HelpItem>
            <HelpItem title={tx('删除账号', 'Delete an account')}>
              {tx('登录后进入“我的 → 账号管理 → 删除账号”，阅读影响说明并再次确认。删除完成后无法恢复。', 'After signing in, open Me → Account controls → Delete account. Review the impact and confirm. This cannot be undone.')}
            </HelpItem>
          </View>
        </InfoCard>

        <InfoCard label={tx('联系支持', 'Contact support')} title={supportEmail ?? tx('内测支持', 'Beta support')} accent="#1B70A6">
          <View style={styles.content}>
            {supportEmail ? (
              <>
                <ThemedText themeColor="textSecondary">
                  {tx('请说明设备型号、系统版本、发生时间和错误文字；不要发送密码、验证码或完整登录链接。', 'Include your device, OS version, time, and error text. Never send a password, verification code, or full login link.')}
                </ThemedText>
                <ActionButton onPress={contactSupport}>{tx('发送支持邮件', 'Email support')}</ActionButton>
              </>
            ) : (
              <InlineNotice>
                {tx('当前为邀请制内测，请通过原邀请渠道联系开发者。正式公开发布前，本页会公布长期支持邮箱。', 'This is an invite-only beta. Contact the developer through your original invitation channel. A permanent support email will appear here before public release.')}
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
