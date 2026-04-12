import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('./serviceAccount.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const UID = 'R99ReefTUSR9hTdzmNEdhvUc5vQ2';

await db.collection('users').doc(UID).update({
  streak:          7,
  lastRoutineDate: '2026-04-11',
});

console.log('✅ streak 7로 업데이트 완료 (4/5~4/11)');
process.exit(0);
