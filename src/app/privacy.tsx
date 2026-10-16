import Head from 'expo-router/head';
import { StyleSheet, View } from 'react-native';

import { InfoCard } from '@/components/info-card';
import { PublicPageFooter } from '@/components/public-page-footer';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useI18n } from '@/features/i18n/i18n-provider';

function PolicySection({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText themeColor="textSecondary">{children}</ThemedText>
    </View>
  );
}

export default function PrivacyScreen() {
  const { tx } = useI18n();
  return (
    <>
      <Head><title>{tx('隐私政策｜TripFlow 旅途流', 'Privacy | TripFlow')}</title></Head>
      <Screen context={[tx('生效日期：2026 年 10 月 16 日', 'Effective October 16, 2026'), 'TripFlow 旅途流']} title={tx('隐私政策', 'Privacy policy')}>
        <InfoCard label={tx('概要', 'Summary')} title={tx('我们只处理运行旅行协作功能所需的数据', 'We only process data needed to run shared trip features')}>
          <View style={styles.content}>
            <ThemedText themeColor="textSecondary">
              {tx('TripFlow 是旅行协作与费用分摊工具。我们不出售个人信息，不展示广告，目前也不使用跨应用追踪或第三方广告分析服务。', 'TripFlow is a shared travel and expense tool. We do not sell personal information, show ads, use cross-app tracking, or currently use third-party advertising analytics.')}
            </ThemedText>
            <PolicySection title={tx('我们收集的数据', 'Data we collect')}>
              {tx('账号邮箱与登录标识、你填写的显示名称，以及你主动创建或共享的行程、成员关系、邀请、地点、时间、账目、分摊、小票照片，以及用于 AI 记账或智能调整行程的语音。应用运行时还会产生必要的安全与故障日志。', 'We process your account email and login identifier, display name, and the trips, memberships, invitations, places, times, expenses, splits, receipt photos, and voice you submit for AI expense parsing or smart itinerary edits. The service also creates necessary security and error logs.')}
            </PolicySection>
            <PolicySection title={tx('如何使用数据', 'How we use data')}>
              {tx('用于安全登录、同步共享行程、执行成员权限、计算账目与结算、提供客户支持、防止滥用，以及维护服务的可靠性和安全性。', 'We use it for secure sign-in, trip synchronization, member permissions, expense and settlement calculations, support, abuse prevention, reliability, and security.')}
            </PolicySection>
            <PolicySection title={tx('共享与处理服务商', 'Sharing and processors')}>
              {tx('数据仅在你授权的同行成员范围内共享；小票照片保存在私有存储中，仅向有权查看对应支出的成员提供限时访问。Supabase 提供身份验证、数据库和文件存储服务，Vercel 提供网页托管；自动获取汇率时，Frankfurter 只会收到所选的两个币种代码，不会收到账目内容或个人信息；iOS 构建与分发可能使用 Expo/EAS 和 Apple。使用 AI 记账解析时，Google Gemini 会临时处理你主动输入的文字、录音或小票照片、行程币种及相关成员显示名称和内部标识，只用于生成可编辑草稿，不会自动保存账目；使用行程助手时，Google Gemini 会临时处理你发送的消息，以及你有权查看的行程安排、成员显示名称和近期账目，只用于生成回答和修改建议，任何修改都需要你确认后才会保存；使用智能行程调整时，你主动录制的语音会经 Supabase Edge Function 发送给 Google Gemini，仅用于生成可编辑的修改预览，行程不会自动修改。TripFlow 不会持久化原始录音。我们不会将数据出售给第三方。', 'Data is shared only with travellers you authorize. Receipt photos stay in private storage and are available through time-limited access only to members allowed to view the related expense. Supabase provides authentication, database, and file storage; when fetching an exchange rate, Frankfurter receives only the selected currency codes, not expense content or personal information; Vercel hosts the web app; Expo/EAS and Apple may build and distribute iOS releases. When you use AI expense parsing, Google Gemini temporarily processes the text, recording, or receipt photo, trip currency, relevant display names, and internal identifiers only to create an editable draft. When you use the trip assistant, Google Gemini temporarily processes your messages and the plans, member display names, and recent expenses you can already see, only to answer and suggest changes; nothing is saved until you confirm. It does not save expenses automatically, and TripFlow does not persist the original recording. When you use smart itinerary edits, your recording is sent through a Supabase Edge Function to Google Gemini only to create an editable change preview; your trip is not changed automatically. TripFlow does not persist the original recording. We do not sell data.')}
            </PolicySection>
            <PolicySection title={tx('订单导入', 'Booking imports')}>
              {tx('只有在你选择文件并点击“发送并识别”后，机票或酒店 PDF／图片才会经 Supabase Edge Function 发送给 Google Gemini，用于提取可编辑的订单草稿。确认前，TripFlow 不会持久化原件，也不会修改行程。确认加入后，订单原件保存在 Supabase 私有存储中，仅上传者可通过限时链接查看；确认的名称、地点和安排时间会按行程权限与同行成员共享。不会自动创建账目。你可以单独删除原件并保留安排，删除账号时应用会清理私有订单文件。', 'Only after you choose a file and select Send and recognize is a flight or hotel PDF / image sent through a Supabase Edge Function to Google Gemini to extract an editable booking draft. Before confirmation, TripFlow does not persist the original or change the itinerary. After confirmation, originals are stored privately in Supabase and accessible only to the uploader through time-limited links; confirmed titles, places and times are shared under trip permissions. No expense is created automatically. You can delete originals while keeping plans; account deletion clears private booking files.')}
            </PolicySection>
            <PolicySection title={tx('保存、导出与删除', 'Retention and deletion')}>
              {tx('数据会在提供服务所需期间保存。你可以在“我的 → 账号管理”中永久删除账号：登录凭据和个人名称会被删除，你会退出所有行程；只有你一人的行程会被删除，多人共享行程会转交其他成员，共享账目与行程记录会在去标识化后保留，以维护协作和财务记录的完整性。', 'We retain data while needed to provide the service. You can permanently delete your account under Me → Account controls. Your login and name are removed and you leave all trips. Solo trips are deleted; shared trips transfer to another member and keep anonymized collaborative and financial records.')}
            </PolicySection>
            <PolicySection title={tx('安全与你的选择', 'Security and your choices')}>
              {tx('我们使用访问控制和 Supabase 行级安全策略限制数据访问。请不要在共享字段中上传不必要的敏感信息。你可以修改显示名称、退出登录，并通过应用内删除入口行使删除权。', 'Access controls and Supabase row-level security restrict data access. Do not enter unnecessary sensitive information in shared fields. You can edit your name, sign out, and use the in-app deletion control.')}
            </PolicySection>
            <PolicySection title={tx('儿童与政策变更', 'Children and changes')}>
              {tx('TripFlow 不面向 13 岁以下儿童。若政策发生重要变化，我们会更新本页日期，并在适当情况下于应用内提示。', 'TripFlow is not directed to children under 13. We will update the date here and provide an in-app notice when appropriate for material changes.')}
            </PolicySection>
            <PolicySection title={tx('联系我们', 'Contact us')}>
              {tx('如对隐私、数据访问或删除有疑问，请访问“支持与帮助”页面。正式公开发布前会在该页面公布长期支持邮箱。', 'For questions about privacy, access, or deletion, visit Support. A permanent support email will be published there before public release.')}
            </PolicySection>
          </View>
        </InfoCard>
        <PublicPageFooter />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18 },
  section: { gap: 5 },
});
