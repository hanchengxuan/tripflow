import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
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
      <AnimatedSplashOverlay />
      <AuthProvider>
        <SessionRouter />
      </AuthProvider>
    </ThemeProvider>
  );
}
