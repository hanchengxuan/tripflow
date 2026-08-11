import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { sendEmailOtp, verifyEmailOtp } from '@/features/auth/auth-service';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function sendCode() {
    setBusy(true);
    setError(undefined);
    try {
      const normalized = await sendEmailOtp(email);
      setEmail(normalized);
      setStep('verify');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send the login email.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError(undefined);
    try {
      await verifyEmailOtp(email, token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not verify the code.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      eyebrow="TripFlow private beta"
      title="Your group trip, in one place"
      subtitle="Sign in without a password. New travelers can join from an invite code.">
      <InfoCard label={step === 'email' ? 'SIGN IN' : 'CHECK YOUR EMAIL'} title={step === 'email' ? 'Continue with email' : email}>
        <View style={styles.form}>
          {step === 'email' ? (
            <>
              <FormField
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
              />
              <ActionButton busy={busy} onPress={sendCode}>Send login email</ActionButton>
            </>
          ) : (
            <>
              <ThemedText themeColor="textSecondary">
                Enter the six-digit code if the email contains one. If it contains a secure sign-in link, open that link on this device.
              </ThemedText>
              <FormField
                label="Six-digit code"
                value={token}
                onChangeText={setToken}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
              />
              <ActionButton busy={busy} onPress={verifyCode}>Verify code</ActionButton>
              <ActionButton tone="secondary" disabled={busy} onPress={() => setStep('email')}>Use another email</ActionButton>
            </>
          )}
          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        </View>
      </InfoCard>
    </Screen>
  );
}

export function AuthLoadingScreen({ configured }: { configured: boolean }) {
  return (
    <Screen
      eyebrow="TripFlow"
      title={configured ? 'Restoring your trip' : 'Configuration required'}
      subtitle={configured ? 'Checking your secure session…' : 'Add the Supabase public URL and publishable key to start the app.'}>
      {!configured ? (
        <InlineNotice tone="error">
          Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
        </InlineNotice>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { gap: 12 } });
