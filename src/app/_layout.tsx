import { DarkTheme, DefaultTheme, Slot, ThemeProvider, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { AuthLoadingScreen, AuthScreen } from '@/features/auth/auth-screen';
import { MvpProvider } from '@/features/mvp/mvp-provider';

SplashScreen.preventAutoHideAsync();

function SessionRouter() {
  const { configured, loading, session } = useAuth();
  const pathname = usePathname();

  if (pathname === '/privacy' || pathname === '/support') return <Slot />;

  if (!configured || loading) return <AuthLoadingScreen configured={configured} />;
  if (!session) return <AuthScreen />;

  return (
    <MvpProvider>
      <AppTabs />
    </MvpProvider>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Head>
        <title>TripFlow 旅途流</title>
        <meta content="TripFlow 让同行者共享行程、协作安排并清晰分摊旅行支出。" name="description" />
        <meta content="#0879c9" name="theme-color" />
      </Head>
      <AnimatedSplashOverlay />
      <AuthProvider>
        <SessionRouter />
      </AuthProvider>
    </ThemeProvider>
  );
}
