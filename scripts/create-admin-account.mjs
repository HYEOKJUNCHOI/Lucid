/**
 * create-admin-account.mjs
 * 관리자 계정 생성: admin@lucid.admin / admin
 *
 * 실행:
 *   node scripts/create-admin-account.mjs
 */

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const sa = JSON.parse(readFileSync(new URL('./serviceAccount.json', import.meta.url)));
initializeApp({ credential: cert(sa) });
const adminAuth = getAuth();
const db = getFirestore();

async function main() {
  const email    = 'admin@lucid.admin';
  const password = 'admin1';
  const name     = '관리자';

  // 1. Firebase Auth 계정
  let uid;
  const existing = await adminAuth.getUserByEmail(email).catch(() => null);
  if (existing) {
    uid = existing.uid;
    console.log(`[스킵] ${email} 이미 존재 (uid: ${uid})`);
  } else {
    const created = await adminAuth.createUser({ email, password, displayName: name });
    uid = created.uid;
    console.log(`[생성] ${email} → uid: ${uid}`);
  }

  // 2. Firestore users/{uid}
  await db.collection('users').doc(uid).set({
    uid,
    email,
    displayName: name,
    role: 'admin',
    groupIDs: [],
    streak: 0,
    totalXP: 0,
    level: 1,
    beanCount: 0,
    createdAt: new Date().toISOString(),
    isAdminAccount: true,
  }, { merge: true });

  console.log(`[완료] 관리자 계정 준비됨`);
  console.log(`  로그인: admin / admin`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
