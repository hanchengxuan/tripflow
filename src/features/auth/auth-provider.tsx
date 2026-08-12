import type { Session } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  onboardingComplete: boolean;
  finishOnboarding: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const client = getSupabaseClient();
    let mounted = true;
    client.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setOnboardingComplete(undefined);
      setLoading(false);
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
      finishOnboarding: () => setOnboardingComplete(true),
    }),
    [session, loading, onboardingComplete],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
