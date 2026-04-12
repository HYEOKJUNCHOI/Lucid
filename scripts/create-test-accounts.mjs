/**
 * create-test-accounts.mjs
 * 테스트 계정 30개 일괄 생성
 *
 * 실행:
 *   node scripts/create-test-accounts.mjs
 *
 * 생성되는 것:
 *   1. Firebase Auth 이메일/비밀번호 계정 (test1@lucid.admin / test1! ... test30@lucid.admin / test30!)
 *   2. Firestore invited_students/{email} 문서 (학원 사전등록 역할)
 *   3. Firestore users/{uid} 문서 (최초 프로필)
 */

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Firebase Admin 초기화
const sa = JSON.parse(readFileSync(new URL('./serviceAccount.json', import.meta.url)));
initializeApp({ credential: cert(sa) });
const adminAuth = getAuth();
const db = getFirestore();

// 테스트 학생 데이터
const students = [
  { name: '강민준', type: 'beginner' },
  { name: '김서연', type: 'experienced' },
  { name: '이도현', type: 'beginner' },
  { name: '박지유', type: 'major' },
  { name: '최현우', type: 'beginner' },
  { name: '정수아', type: 'experienced' },
  { name: '윤재원', type: 'beginner' },
  { name: '임하은', type: 'beginner' },
  { name: '한승민', type: 'major' },
  { name: '오예린', type: 'beginner' },
  { name: '신준혁', type: 'experienced' },
  { name: '배나연', type: 'beginner' },
  { name: '권태양', type: 'beginner' },
  { name: '류보람', type: 'major' },
  { name: '전성호', type: 'beginner' },
  { name: '남지현', type: 'experienced' },
  { name: '문시우', type: 'beginner' },
  { name: '송다인', type: 'beginner' },
  { name: '홍민서', type: 'major' },
  { name: '천유진', type: 'beginner' },
  { name: '조현진', type: 'experienced' },
  { name: '서은채', type: 'beginner' },
  { name: '노준서', type: 'beginner' },
  { name: '허소율', type: 'major' },
  { name: '유찬우', type: 'beginner' },
  { name: '안세빈', type: 'experienced' },
  { name: '백지호', type: 'beginner' },
  { name: '장하린', type: 'beginner' },
  { name: '고민찬', type: 'major' },
  { name: '마이린', type: 'beginner' },
];

async function createAccount(n, student) {
  const email    = `test${n}@lucid.admin`;
  const password = `test${n}!`;
  const { name, type } = student;

  // 1. Firebase Auth 계정 생성 (이미 있으면 스킵)
  let uid;
  try {
    const existing = await adminAuth.getUserByEmail(email).catch(() => null);
    if (existing) {
      uid = existing.uid;
      console.log(`  [스킵] ${email} 이미 존재 (uid: ${uid})`);
    } else {
      const created = await adminAuth.createUser({ email, password, displayName: name });
      uid = created.uid;
      console.log(`  [생성] ${email} → uid: ${uid}`);
    }
  } catch (e) {
    console.error(`  [에러] ${email}: ${e.message}`);
    return;
  }

  // 2. Firestore invited_students/{email} (학원 사전등록 목록)
  await db.collection('invited_students').doc(email).set({
    name,
    email,
    studentType: type,
    groupIDs: [],        // ← 관리자가 나중에 직접 배정
    phone: `010-1111-${String(n).padStart(4, '0')}`,
    createdAt: new Date().toISOString(),
    isTestAccount: true,
  }, { merge: true });

  // 3. Firestore users/{uid} (최초 프로필)
  await db.collection('users').doc(uid).set({
    uid,
    email,
    displayName: name,
    role: 'student',
    studentType: type,
    groupIDs: [],
    streak: 0,
    totalXP: 0,
    level: 1,
    beanCount: 0,
    streakFreezes: 0,
    repairCount: -1,
    attendedDates: [],
    frozenDates: [],
    isTestAccount: true,
    createdAt: new Date().toISOString(),
  }, { merge: true });

  console.log(`  [완료] ${name} (${email}) / pw: ${password} / type: ${type}`);
}

async function main() {
  console.log('=== 테스트 계정 30개 생성 시작 ===\n');
  for (let i = 0; i < students.length; i++) {
    const n = i + 1;
    process.stdout.write(`[${n}/30] ${students[i].name} 처리 중...\n`);
    await createAccount(n, students[i]);
  }
  console.log('\n=== 완료 ===');
  console.log('로그인: test1 / test1! ~ test30 / test30!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
