/**
 * Export Firestore user backups for analysis (e.g. progression accuracy, 1RM trends).
 *
 * Prerequisites:
 *   1. Firebase project with Firestore and backup/latest docs under users/{uid}.
 *   2. Service account key: create one in Firebase Console → Project settings → Service accounts.
 *   3. Install: npm install firebase-admin (or add as devDependency).
 *   4. Set GOOGLE_APPLICATION_CREDENTIALS to the path to the JSON key file, or pass --key path.
 *
 * Usage:
 *   node scripts/export-firestore-backups.js [--key path/to/serviceAccountKey.json] [--out backups.json]
 *
 * Output: JSON array of { uid, backedUpAt, appVersion, storage } (one per user with a backup).
 * Use for offline analysis; keep outputs anonymized (uid is not PII but treat as sensitive).
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function getKeyPath() {
  const idx = process.argv.indexOf('--key');
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS || null;
}

function getOutPath() {
  const idx = process.argv.indexOf('--out');
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return path.join(__dirname, 'firestore-backups-export.json');
}

async function main() {
  const keyPath = getKeyPath();
  if (!keyPath) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS or pass --key path/to/serviceAccountKey.json');
    process.exit(1);
  }

  if (!admin.apps.length) {
    const keyPathResolved = path.resolve(keyPath);
    const key = JSON.parse(fs.readFileSync(keyPathResolved, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(key) });
  }

  const db = admin.firestore();
  const usersSnap = await db.collection('users').get();
  const results = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const backupRef = userDoc.ref.collection('backup').doc('latest');
    const backupSnap = await backupRef.get();
    if (!backupSnap.exists) continue;

    const data = backupSnap.data();
    results.push({
      uid,
      backedUpAt: data.backedUpAt ?? null,
      appVersion: data.appVersion ?? null,
      storage: data.storage ?? {},
    });
  }

  const outPath = getOutPath();
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Exported ${results.length} backup(s) to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
