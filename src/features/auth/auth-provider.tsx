import type { Session } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { getAuthCapabilities, getSupabaseClient, isSupabaseConfigured, type AuthCapabilities } from '@/lib/supabase';
import { shouldResetOnboarding } from '@/features/auth/auth-session';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  onboardingComplete: boolean;
  capabilities: AuthCapabilities;
  finishOnboarding: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | undefined>(undefined);
  const [capabilities, setCapabilities] = useState<AuthCapabilities>({ google: false, phone: false });

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let mounted = true;
    const client = getSupabaseClient();
    const sessionRef = { current: null as Session | null };
    void getAuthCapabilities().then((next) => { if (mounted) setCapabilities(next); });
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      const previousUserId = sessionRef.current?.user.id ?? null;
      const nextUserId = nextSession?.user.id ?? null;
      sessionRef.current = nextSession;
      setSession(nextSession);
      if (shouldResetOnboarding(event, previousUserId, nextUserId)) setOnboardingComplete(undefined);
      setLoading(false);
    });
    client.auth.getSession().then(({ data: sessionData }) => {
      if (mounted) {
        sessionRef.current = sessionData.session;
        setSession(sessionData.session);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    let mounted = true;
    getSupabaseClient().from('profiles').select('onboarding_completed').eq('id', userId).single()
      .then(({ data, error }) => {
        if (mounted) setOnboardingComplete(!error && data.onboarding_completed);
      });
    return () => { mounted = false; };
  }, [session?.user.id]);

  const value = useMemo(
    () => ({
      session,
      loading: loading || Boolean(session && onboardingComplete === undefined),
      configured: isSupabaseConfigured,
      onboardingComplete: onboardingComplete ?? false,
      capabilities,
      finishOnboarding: () => setOnboardingComplete(true),
    }),
    [session, loading, onboardingComplete, capabilities],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
