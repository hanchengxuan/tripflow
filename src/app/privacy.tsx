import Head from 'expo-router/head';
import { StyleSheet, View } from 'react-native';

import { InfoCard } from '@/components/info-card';
import { PublicPageFooter } from '@/components/public-page-footer';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

function PolicySection({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText themeColor="textSecondary">{children}</ThemedText>
    </View>
  );
}

export default function PrivacyScreen() {
  return (
    <>
      <Head><title>隐私政策｜TripFlow 旅途流</title></Head>
      <Screen eyebrow="TripFlow 旅途流" title="隐私政策" subtitle="生效日期：2026 年 8 月 11 日">
        <InfoCard label="概要" title="我们只处理运行旅行协作功能所需的数据">
          <View style={styles.content}>
            <ThemedText themeColor="textSecondary">
              TripFlow 是旅行协作与费用分摊工具。我们不出售个人信息，不展示广告，目前也不使用跨应用追踪或第三方广告分析服务。
            </ThemedText>
            <PolicySection title="我们收集的数据">
              账号邮箱与登录标识、你填写的显示名称，以及你主动创建或共享的行程、成员关系、邀请、地点、时间、账目和分摊信息。应用运行时还会产生必要的安全与故障日志。
            </PolicySection>
            <PolicySection title="如何使用数据">
              用于安全登录、同步共享行程、执行成员权限、计算账目与结算、提供客户支持、防止滥用，以及维护服务的可靠性和安全性。
            </PolicySection>
            <PolicySection title="共享与处理服务商">
              数据仅在你授权的同行成员范围内共享，并由 Supabase 提供身份验证和数据库服务、Vercel 提供网页托管；iOS 构建与分发可能使用 Expo/EAS 和 Apple。我们不会将数据出售给第三方。
            </PolicySection>
            <PolicySection title="保存、导出与删除">
              数据会在提供服务所需期间保存。你可以在“我的 → 账号管理”中永久删除账号：登录凭据和个人名称会被删除，你会退出所有行程；只有你一人的行程会被删除，多人共享行程会转交其他成员，共享账目与行程记录会在去标识化后保留，以维护协作和财务记录的完整性。
            </PolicySection>
            <PolicySection title="安全与你的选择">
              我们使用访问控制和 Supabase 行级安全策略限制数据访问。请不要在共享字段中上传不必要的敏感信息。你可以修改显示名称、退出登录，并通过应用内删除入口行使删除权。
            </PolicySection>
            <PolicySection title="儿童与政策变更">
              TripFlow 不面向 13 岁以下儿童。若政策发生重要变化，我们会更新本页日期，并在适当情况下于应用内提示。
            </PolicySection>
            <PolicySection title="联系我们">
              如对隐私、数据访问或删除有疑问，请访问“支持与帮助”页面。正式公开发布前会在该页面公布长期支持邮箱。
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
