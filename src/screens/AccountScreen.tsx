import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { THEME } from '../theme/colors';
import {
  getFirebaseAuth,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  isFirebaseConfigured,
} from '../config/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { backupToCloudNow, getLastBackupTime } from '../storage/cloudBackup';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

export default function AccountScreen({ navigation }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    getLastBackupTime().then(setLastBackup);
  }, [user?.uid]);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Enter email and password');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await signInWithEmail(email.trim(), password);
    setLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setEmail('');
    setPassword('');
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      setError('Enter email and password');
      return;
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await signUpWithEmail(email.trim(), password);
    setLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setEmail('');
    setPassword('');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'Your data will stay backed up. On this device you can still use the app; backup will use a temporary account until you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await signOutUser();
            setLoading(false);
          },
        },
      ]
    );
  };

  const handleBackupNow = async () => {
    setLoading(true);
    setError(null);
    const result = await backupToCloudNow();
    setLoading(false);
    if (result.ok) {
      const t = await getLastBackupTime();
      setLastBackup(t ?? null);
    } else {
      setError(result.error ?? 'Backup failed');
    }
  };

  if (!authReady) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: THEME.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isFirebaseConfigured()) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: THEME.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.paragraph}>
            Cloud backup and sign-in are not configured. Add Firebase (Email/Password and Anonymous auth) and set
            expo.extra.firebase in app.json to enable account and backup.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const isSignedIn = user && !user.isAnonymous;
  const displayEmail = user?.email ?? null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: THEME.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isSignedIn ? (
            <View style={styles.card}>
              <Text style={styles.title}>Account</Text>
              <Text style={styles.paragraph}>Signed in as {displayEmail}</Text>
              <Text style={styles.hint}>
                Your data backs up to this account. On a new device, sign in here and use Help → Restore from
                backup.
              </Text>
              {lastBackup != null && (
                <Text style={styles.lastBackup}>Last backup: {new Date(lastBackup).toLocaleString()}</Text>
              )}
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={handleBackupNow}
                disabled={loading}
              >
                <Text style={styles.buttonTextSecondary}>Back up now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => navigation.navigate('Help')}
                disabled={loading}
              >
                <Text style={styles.buttonTextSecondary}>Restore from backup (Help)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonOut]} onPress={handleSignOut} disabled={loading}>
                <Text style={styles.buttonTextOut}>Sign out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.title}>Sign in</Text>
              <Text style={styles.paragraph}>
                Sign in to back up your data and restore it on any device. Create an account to keep your progress
                when you get a new phone.
              </Text>
              {error != null && <Text style={styles.errorText}>{error}</Text>}
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={THEME.textSecondary}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setError(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={THEME.textSecondary}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError(null);
                }}
                secureTextEntry
                editable={!loading}
              />
              {mode === 'signin' ? (
                <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Sign in</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Create account</Text>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.switchMode}
                onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                disabled={loading}
              >
                <Text style={styles.switchModeText}>
                  {mode === 'signin' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 24,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    color: THEME.textSecondary,
    marginBottom: 16,
    lineHeight: 22,
  },
  hint: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  lastBackup: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.primaryFaded,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: THEME.textPrimary,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: THEME.error,
    marginBottom: 12,
  },
  button: {
    backgroundColor: THEME.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textOnPrimary ?? '#fff',
  },
  buttonSecondary: {
    backgroundColor: THEME.primaryFaded,
    marginTop: 8,
  },
  buttonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.primary,
  },
  buttonOut: {
    backgroundColor: 'transparent',
    marginTop: 16,
    borderWidth: 1,
    borderColor: THEME.textSecondary,
  },
  buttonTextOut: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  switchMode: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  switchModeText: {
    fontSize: 14,
    color: THEME.primary,
    fontWeight: '500',
  },
});
