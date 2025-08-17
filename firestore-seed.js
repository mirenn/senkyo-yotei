// Firebase Emulator用の初期データ
const admin = require('firebase-admin');

// Emulator用の設定
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
  projectId: 'senkyo-yotei'
});

const db = admin.firestore();

async function seedData() {
  console.log('Seeding Firestore with initial data...');

  // サンプル選挙データ
  const elections = [
    {
      title: '市長選挙 2024',
      description: '市長選挙の投票予定を登録してください',
      startDate: admin.firestore.Timestamp.fromDate(new Date('2024-09-01')),
      endDate: admin.firestore.Timestamp.fromDate(new Date('2024-09-15')),
      createdBy: 'user1',
      createdAt: admin.firestore.Timestamp.fromDate(new Date('2024-08-01')),
      updatedAt: admin.firestore.Timestamp.fromDate(new Date('2024-08-01')),
    },
    {
      title: '県知事選挙 2024',
      description: '県知事選挙の投票予定を登録してください',
      startDate: admin.firestore.Timestamp.fromDate(new Date('2024-10-01')),
      endDate: admin.firestore.Timestamp.fromDate(new Date('2024-10-15')),
      createdBy: 'user2',
      createdAt: admin.firestore.Timestamp.fromDate(new Date('2024-08-10')),
      updatedAt: admin.firestore.Timestamp.fromDate(new Date('2024-08-10')),
    },
  ];

  // 選挙データを追加
  for (let i = 0; i < elections.length; i++) {
    const docRef = db.collection('elections').doc(`election${i + 1}`);
    await docRef.set(elections[i]);
    console.log(`Election ${i + 1} added`);

    // 候補者データも追加
    const candidates = [
      {
        name: `候補者A (選挙${i + 1})`,
        party: '無所属',
        description: `候補者Aの説明 (選挙${i + 1})`,
        createdAt: admin.firestore.Timestamp.now(),
      },
      {
        name: `候補者B (選挙${i + 1})`,
        party: 'テスト党',
        description: `候補者Bの説明 (選挙${i + 1})`,
        createdAt: admin.firestore.Timestamp.now(),
      },
    ];

    for (let j = 0; j < candidates.length; j++) {
      const candidateRef = docRef.collection('candidates').doc(`candidate${j + 1}`);
      await candidateRef.set(candidates[j]);
      console.log(`  Candidate ${j + 1} added to election ${i + 1}`);
    }
  }

  console.log('Data seeding completed!');
}

seedData().catch(console.error);
