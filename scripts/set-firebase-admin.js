/**
 * One-off admin tool: grants/revokes the `admin` custom claim on a Firebase
 * Auth user, and lists who currently has it. The Realtime Database rules use
 * this claim to allow full read/write/delete access (community moderation,
 * support, etc.). The Firebase Console does NOT show custom claims anywhere
 * in its UI — this script is the only way to see who has admin.
 *
 * Setup (only needed once):
 *   1. Firebase Console -> Project Settings -> Service accounts
 *      -> "Generate new private key" -> save as scripts/serviceAccountKey.json
 *      (this file must NEVER be committed — it's a full admin credential)
 *   2. npm install firebase-admin --no-save
 *
 * Usage:
 *   node scripts/set-firebase-admin.js <uid>            # grant admin
 *   node scripts/set-firebase-admin.js <uid> --revoke    # remove admin
 *   node scripts/set-firebase-admin.js --list            # list all admins
 *
 * Find your uid in Firebase Console -> Authentication -> Users, or from
 * localStorage.getItem('uid') in the browser console while logged in.
 *
 * The client must refresh its ID token to see a newly granted claim
 * (call user.getIdToken(true) or simply log out and back in).
 */
const admin = require('firebase-admin');
const path = require('path');

const args = process.argv.slice(2);
const list = args.includes('--list');
const revoke = args.includes('--revoke');
const uid = args.find((a) => !a.startsWith('--'));

if (!list && !uid) {
  console.error('Usage: node scripts/set-firebase-admin.js <uid> [--revoke]');
  console.error('   or: node scripts/set-firebase-admin.js --list');
  process.exit(1);
}

const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function listAdmins() {
  const admins = [];
  let pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    for (const user of page.users) {
      if (user.customClaims?.admin === true) {
        admins.push({ uid: user.uid, email: user.email || '(no email — anonymous)' });
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);

  if (admins.length === 0) {
    console.log('No users currently have the admin claim.');
  } else {
    console.log(`${admins.length} admin(s):`);
    admins.forEach((a) => console.log(`  ${a.uid}  ${a.email}`));
  }
}

async function run() {
  if (list) {
    await listAdmins();
    return;
  }

  await admin.auth().setCustomUserClaims(uid, revoke ? null : { admin: true });
  console.log(`${revoke ? 'Revoked' : 'Granted'} admin claim for uid: ${uid}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
