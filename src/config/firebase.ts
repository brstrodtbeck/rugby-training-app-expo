/**
 * Firebase JS SDK initialization for Auth (anonymous + email) and Firestore (backup).
 * Optional: if extra.firebase is not set in app.json, backup features no-op.
 *
 * To enable: Firebase Console → Project settings → General → add a Web app →
 * copy the config (apiKey, authDomain, projectId, etc.) into app.json under expo.extra.firebase.
 * Enable Anonymous Auth, Email/Password Auth, and Firestore in the Firebase Console.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  linkWithCredential,
  EmailAuthProvider,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import Constants from 'expo-constants';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

function getFirebaseConfig(): FirebaseConfig | null {
  const extra = Constants.expoConfig?.extra as { firebase?: FirebaseConfig } | undefined;
  const config = extra?.firebase ?? null;
  if (!config?.apiKey || !config?.projectId || !config?.appId) {
    return null;
  }
  return config;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

function initFirebase(): boolean {
  if (getApps().length > 0) {
    app = getApp() as FirebaseApp;
    auth = getAuth(app);
    firestore = getFirestore(app);
    return true;
  }
  const config = getFirebaseConfig();
  if (!config) return false;
  try {
    app = initializeApp(config);
    auth = getAuth(app);
    firestore = getFirestore(app);
    return true;
  } catch {
    return false;
  }
}

export function isFirebaseConfigured(): boolean {
  if (app !== null) return true;
  return initFirebase();
}

export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured()) return null;
  return auth;
}

export function getFirebaseFirestore(): Firestore | null {
  if (!isFirebaseConfigured()) return null;
  return firestore;
}

/**
 * Ensure user is signed in anonymously. Resolves with uid or null if not configured/fails.
 */
export async function ensureAnonymousAuth(): Promise<string | null> {
  const a = getFirebaseAuth();
  if (!a) return null;
  try {
    let user = a.currentUser;
    if (!user) {
      const cred = await signInAnonymously(a);
      user = cred.user;
    }
    return user?.uid ?? null;
  } catch {
    return null;
  }
}

/**
 * UID to use for cloud backup/restore: current user if signed in, otherwise anonymous.
 */
export async function getBackupUserId(): Promise<string | null> {
  const a = getFirebaseAuth();
  if (!a) return null;
  if (a.currentUser) return a.currentUser.uid;
  return ensureAnonymousAuth();
}

export function getCurrentUser(): User | null {
  return getFirebaseAuth()?.currentUser ?? null;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ uid: string } | { error: string }> {
  const a = getFirebaseAuth();
  if (!a) return { error: 'Firebase not configured' };
  try {
    const cred = await signInWithEmailAndPassword(a, email, password);
    return { uid: cred.user.uid };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: message };
  }
}

/**
 * Sign up with email. If user is currently anonymous, links that account (keeps same uid and backup).
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ uid: string } | { error: string }> {
  const a = getFirebaseAuth();
  if (!a) return { error: 'Firebase not configured' };
  try {
    const user = a.currentUser;
    if (user?.isAnonymous) {
      const credential = EmailAuthProvider.credential(email, password);
      await linkWithCredential(user, credential);
      return { uid: user.uid };
    }
    const cred = await createUserWithEmailAndPassword(a, email, password);
    return { uid: cred.user.uid };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: message };
  }
}

export async function signOutUser(): Promise<{ ok: boolean; error?: string }> {
  const a = getFirebaseAuth();
  if (!a) return { ok: true };
  try {
    await firebaseSignOut(a);
    return { ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}
