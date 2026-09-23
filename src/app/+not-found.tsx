import Head from 'expo-router/head';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { InlineNotice } from '@/components/form-controls';
import { PublicPageFooter } from '@/components/public-page-footer';
import { Screen } from '@/components/screen';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/features/i18n/i18n-provider';

export default function NotFoundScreen() {
  const theme = useTheme();
  const { tx } = useI18n();
  return (
    <>
      <Head><title>{tx('页面不存在｜TripFlow 旅途流', 'Page not found | TripFlow')}</title></Head>
      <Screen
        context={[tx('请检查链接是否完整、正确', 'Check that the link is complete and correct')]}
        title={tx('这个页面不存在', 'This page does not exist')}
      >
        <InlineNotice>
          {tx('如果你是从邀请链接过来的，请向邀请你的人再要一次 —— 邀请码有有效期。',
              'If you followed an invite, ask whoever sent it for a fresh one — invite codes expire.')}
        </InlineNotice>
        <View style={styles.action}>
          <Link href="/" target="_self" style={[styles.home, { backgroundColor: theme.accent, color: theme.textOnAccent }]}>{tx('回到 TripFlow', 'Back to TripFlow')}</Link>
        </View>
        <PublicPageFooter showHome={false} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  home: { minHeight: Size.control, padding: Spacing.md, borderRadius: Radius.sm, textAlign: 'center', fontSize: 16, lineHeight: 24 },
  action: { paddingTop: Spacing['2xs'] },
});
