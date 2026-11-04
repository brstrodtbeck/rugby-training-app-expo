/**
 * Cloud backup and restore for AsyncStorage.
 * Uses Firebase Anonymous Auth + Firestore. No-op if Firebase is not configured.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getBackupUserId, getFirebaseFirestore } from '../config/firebase';
import { collectStorageKeys } from '../utils/exportUserData';

const BACKUP_THROTTLE_MINUTES = 10;
const LAST_BACKUP_TIME_KEY = 'cloudBackup:lastBackupAt';
const LAST_RESTORED_TIME_KEY = 'cloudBackup:lastRestoredAt';
const BACKUP_DOC_PATH = 'backup/latest';

const EXTRA_KEYS = [
  'selectedTheme',
  'onboardingComplete',
  'soundAlertsEnabled',
];

const APP_VERSION = '1.0.5';

export interface BackupMetadata {
  backedUpAt: string;
  appVersion: string;
  storageKeyCount: number;
}

export interface BackupDoc {
  storage: Record<string, unknown>;
  backedUpAt: string;
  appVersion: string;
}

async function buildBackupPayload(): Promise<Record<string, unknown>> {
  const fromExport = await collectStorageKeys();
  const extraPairs = await AsyncStorage.multiGet(EXTRA_KEYS);
  const result = { ...fromExport };
  for (const [key, value] of extraPairs) {
    if (value != null) {
      try {
        result[key] = JSON.parse(value) as unknown;
      } catch {
        result[key] = value;
      }
    }
  }
  return result;
}

function getThrottleCutoff(): number {
  return Date.now() - BACKUP_THROTTLE_MINUTES * 60 * 1000;
}

/**
 * Upload current AsyncStorage (progression + extra keys) to Firestore.
 * Throttled by LAST_BACKUP_TIME_KEY. Non-blocking; safe to call fire-and-forget.
 */
export async function backupToCloudIfNeeded(): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const db = getFirebaseFirestore();
  if (!db) return { ok: true, skipped: true };

  try {
    const lastStr = await AsyncStorage.getItem(LAST_BACKUP_TIME_KEY);
    const lastAt = lastStr ? parseInt(lastStr, 10) : 0;
    if (lastAt > getThrottleCutoff()) {
      return { ok: true, skipped: true };
    }

    const uid = await getBackupUserId();
    if (!uid) return { ok: false, error: 'Not signed in' };

    const storage = await buildBackupPayload();
    const backedUpAt = new Date().toISOString();
    const payload: BackupDoc = {
      storage,
      backedUpAt,
      appVersion: APP_VERSION,
    };

    const ref = doc(db, 'users', uid, BACKUP_DOC_PATH);
    await setDoc(ref, payload);

    await AsyncStorage.setItem(LAST_BACKUP_TIME_KEY, String(Date.now()));
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

/**
 * Force backup now (ignores throttle). Use for "Back up now" button.
 */
export async function backupToCloudNow(): Promise<{ ok: boolean; error?: string }> {
  const db = getFirebaseFirestore();
  if (!db) return { ok: false, error: 'Cloud backup not configured' };

  try {
    const uid = await getBackupUserId();
    if (!uid) return { ok: false, error: 'Could not sign in' };

    const storage = await buildBackupPayload();
    const backedUpAt = new Date().toISOString();
    const payload: BackupDoc = { storage, backedUpAt, appVersion: APP_VERSION };

    const ref = doc(db, 'users', uid, BACKUP_DOC_PATH);
    await setDoc(ref, payload);

    await AsyncStorage.setItem(LAST_BACKUP_TIME_KEY, String(Date.now()));
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

/**
 * Restore from Firestore into AsyncStorage. Overwrites local data for backed-up keys.
 */
export async function restoreFromCloud(): Promise<{ ok: boolean; backedUpAt?: string; error?: string }> {
  const db = getFirebaseFirestore();
  if (!db) return { ok: false, error: 'Cloud backup not configured' };

  try {
    const uid = await getBackupUserId();
    if (!uid) return { ok: false, error: 'Could not sign in' };

    const ref = doc(db, 'users', uid, BACKUP_DOC_PATH);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { ok: false, error: 'No backup found' };
    }

    const data = snap.data() as BackupDoc;
    const storage = data.storage ?? {};
    const backedUpAt = data.backedUpAt ?? '';

    const writes: [string, string][] = [];
    for (const [key, value] of Object.entries(storage)) {
      if (value === undefined || value === null) continue;
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      writes.push([key, str]);
    }

    if (writes.length > 0) {
      await AsyncStorage.multiSet(writes);
    }

    await AsyncStorage.setItem(LAST_RESTORED_TIME_KEY, backedUpAt);
    return { ok: true, backedUpAt };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

/**
 * Get last backup timestamp for UI. Prefer local success time; optionally show cloud backedUpAt.
 */
export async function getLastBackupTime(): Promise<string | null> {
  const db = getFirebaseFirestore();
  if (!db) return null;

  try {
    const uid = await getBackupUserId();
    if (!uid) return null;

    const ref = doc(db, 'users', uid, BACKUP_DOC_PATH);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const data = snap.data() as BackupDoc;
    return data.backedUpAt ?? null;
  } catch {
    return null;
  }
}

/**
 * Get last backup time from local cache (fast, no network).
 */
export async function getLastBackupTimeLocal(): Promise<string | null> {
  const lastAt = await AsyncStorage.getItem(LAST_BACKUP_TIME_KEY);
  if (!lastAt) return null;
  const ms = parseInt(lastAt, 10);
  if (isNaN(ms)) return null;
  return new Date(ms).toISOString();
}
