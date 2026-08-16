import { DarkTheme, DefaultTheme, Slot, ThemeProvider, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import AppTabs from '@/components/app-tabs';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { AuthScreen, OnboardingScreen, SessionLoadingScreen } from '@/features/auth/auth-screen';
import { ResetPasswordScreen } from '@/features/auth/reset-password-screen';
import { LanguageProvider, useI18n } from '@/features/i18n/i18n-provider';
import { MvpProvider } from '@/features/mvp/mvp-provider';

SplashScreen.preventAutoHideAsync();

function SessionRouter() {
  const { configured, loading, onboardingComplete, recovering, session } = useAuth();
  const pathname = usePathname();

  if (pathname === '/privacy' || pathname === '/support') return <Slot />;
  if (pathname === '/reset-password' && !loading) return <Slot />;

  if (!configured || loading) return <SessionLoadingScreen configured={configured} />;
  // A recovery link can land anywhere: an admin-sent recovery email carries no
  // redirectTo and arrives on the Site URL. Route on the event, not the path,
  // or the recovery session is swept into the product with no way to set a
  // password.
  if (recovering && session) return <ResetPasswordScreen />;
  if (!session) return <AuthScreen />;
  if (!onboardingComplete) return <OnboardingScreen />;

  return (
    <MvpProvider>
      <AppTabs />
    </MvpProvider>
  );
}

function LocalizedHead() {
  const { tx } = useI18n();
  return (
    <Head>
      <title>TripFlow 旅途流</title>
      <meta content={tx('TripFlow 让同行者共享行程、协作安排并清晰分摊旅行支出。', 'TripFlow keeps shared trips, places, and group expenses in one clear plan.')} name="description" />
      <meta content={Colors.light.background} name="theme-color" />
    </Head>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <LanguageProvider>
          <LocalizedHead />
          <AnimatedSplashOverlay />
          <AuthProvider>
            <SessionRouter />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
