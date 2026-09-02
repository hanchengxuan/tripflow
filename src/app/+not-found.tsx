import Head from 'expo-router/head';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActionButton, InlineNotice } from '@/components/form-controls';
import { PublicPageFooter } from '@/components/public-page-footer';
import { Screen } from '@/components/screen';
import { Spacing } from '@/constants/theme';
import { useI18n } from '@/features/i18n/i18n-provider';

/**
 * The page that is not there.
 *
 * Expo ships an unstyled English "Unmatched Route" screen, which is where an
 * expired invite link lands — so the one page most likely to be someone's first
 * impression of the product was the one page that had never been designed. It
 * names the most likely reason and offers the way on.
 */
export default function NotFoundScreen() {
  const router = useRouter();
  const { tx } = useI18n();
  return (
    <>
      <Head><title>{tx('页面不存在｜TripFlow 旅途流', 'Page not found | TripFlow')}</title></Head>
      <Screen
        context={[tx('链接可能已过期，或者被改过', 'The link may have expired, or been edited')]}
        title={tx('这个页面不存在', 'This page does not exist')}
      >
        <InlineNotice>
          {tx('如果你是从邀请链接过来的，请向邀请你的人再要一次 —— 邀请码有有效期。',
              'If you followed an invite, ask whoever sent it for a fresh one — invite codes expire.')}
        </InlineNotice>
        <View style={styles.action}>
          <ActionButton onPress={() => router.replace('/')}>{tx('回到 TripFlow', 'Back to TripFlow')}</ActionButton>
        </View>
        <PublicPageFooter showHome={false} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  action: { paddingTop: Spacing['2xs'] },
});
