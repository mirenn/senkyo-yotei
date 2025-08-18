import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";

initializeApp();
console.log('Firebase Admin SDK initialized nagaitestaaaaaaaaaaaaaaaaaaaaaaaaa');

// Vote aggregation function (incremental)
// 投票ドキュメントの変更差分だけを使って逐次加算 / 減算する
export const aggregateVotes = onDocumentWritten(
  "votes/{userId}",
  async (event) => {
    const db = getFirestore();
    if (!event.data) return;

    const beforeVotes = event.data.before?.data();
    const afterVotes = event.data.after?.data();
    console.log('Before Votes:', beforeVotes);
    console.log('After Votes:', afterVotes);

  const beforeElections = beforeVotes?.elections || {};
  const afterElections = afterVotes?.elections || {};

    // 変更のあった electionId だけ抽出（candidateId が変わらないものは除外）
    const affected: Array<{
      electionId: string;
      beforeCandidate?: string;
      afterCandidate?: string;
      beforeDislikes: string[];
      afterDislikes: string[];
    }> = [];

    const electionIds = new Set<string>([
      ...Object.keys(beforeElections),
      ...Object.keys(afterElections),
    ]);

    electionIds.forEach((id) => {
      const b = beforeElections[id]?.candidateId;
      const a = afterElections[id]?.candidateId;
      const beforeDislikes: string[] = Array.isArray(beforeElections[id]?.dislikedCandidates) ? beforeElections[id].dislikedCandidates : [];
      const afterDislikes: string[] = Array.isArray(afterElections[id]?.dislikedCandidates) ? afterElections[id].dislikedCandidates : [];
      // 票 or 不支持差分がある場合のみ対象
      const voteChanged = b !== a;
      const dislikeChanged = beforeDislikes.length !== afterDislikes.length || beforeDislikes.some(d => !afterDislikes.includes(d)) || afterDislikes.some(d => !beforeDislikes.includes(d));
      if (voteChanged || dislikeChanged) {
        affected.push({electionId: id, beforeCandidate: b, afterCandidate: a, beforeDislikes, afterDislikes});
      }
    });

    if (affected.length === 0) {
      console.log('[aggregateVotes] 差分なし');
      return;
    }

    console.log('[aggregateVotes] 差分更新開始', affected);

    for (const change of affected) {
      const {electionId, beforeCandidate, afterCandidate, beforeDislikes, afterDislikes} = change;
      try {
        await db.runTransaction(async (tx: any) => {
          const ref = db.collection('electionResults').doc(electionId);
            const snap = await tx.get(ref);
          const data = snap.exists ? snap.data() : {
            electionId,
            totalVotes: 0,
            totalDislikeMarks: 0,
            candidates: {}, // { candidateId: { count, percentage, dislikeCount, dislikePercentage } }
          };

          // counts をベースに更新後に percentage 再計算
          const candidatesCounts: Record<string, number> = Object.fromEntries(
            Object.entries(data.candidates || {}).map(([cid, v]: any) => [cid, v.count])
          );
          const candidateDislikeCounts: Record<string, number> = Object.fromEntries(
            Object.entries(data.candidates || {}).map(([cid, v]: any) => [cid, v.dislikeCount || 0])
          );
          let totalVotes: number = data.totalVotes || 0;
          let totalDislikeMarks: number = data.totalDislikeMarks || 0;

          if (beforeCandidate && beforeCandidate !== afterCandidate) {
            // 別候補へ変更 or 削除
            if (candidatesCounts[beforeCandidate]) {
              candidatesCounts[beforeCandidate] -= 1;
              if (candidatesCounts[beforeCandidate] <= 0) delete candidatesCounts[beforeCandidate];
            }
            if (!afterCandidate) {
              // 削除（投票取り消し）
              totalVotes -= 1;
            }
          }
          if (!beforeCandidate && afterCandidate) {
            // 新規投票
            totalVotes += 1;
          }
          if (beforeCandidate && afterCandidate && beforeCandidate !== afterCandidate) {
            // 変更 (totalVotes 変わらない)
          }
          if (afterCandidate && beforeCandidate !== afterCandidate) {
            candidatesCounts[afterCandidate] = (candidatesCounts[afterCandidate] || 0) + 1;
          }

          // 不支持差分計算
          const removedDislikes = beforeDislikes.filter(d => !afterDislikes.includes(d));
            const addedDislikes = afterDislikes.filter(d => !beforeDislikes.includes(d));
          // 追加分
          for (const cid of addedDislikes) {
            candidateDislikeCounts[cid] = (candidateDislikeCounts[cid] || 0) + 1;
            totalDislikeMarks += 1;
          }
          // 削除分
          for (const cid of removedDislikes) {
            if (candidateDislikeCounts[cid]) {
              candidateDislikeCounts[cid] -= 1;
              if (candidateDislikeCounts[cid] <= 0) delete candidateDislikeCounts[cid];
              totalDislikeMarks -= 1;
            }
          }
          if (totalDislikeMarks < 0) totalDislikeMarks = 0;

          // totalVotes が負にならない安全策
          if (totalVotes < 0) totalVotes = 0;

          // percentage 再計算
          const allCandidateIds = new Set<string>([...Object.keys(candidatesCounts), ...Object.keys(candidateDislikeCounts)]);
          // 全候補を取得し、未登場の候補も0で含める
          try {
            const candidatesSnap = await db.collection('elections').doc(electionId).collection('candidates').get();
            candidatesSnap.docs.forEach(d => {
              if (!allCandidateIds.has(d.id)) {
                allCandidateIds.add(d.id);
                if (candidatesCounts[d.id] === undefined) candidatesCounts[d.id] = 0;
                if (candidateDislikeCounts[d.id] === undefined) candidateDislikeCounts[d.id] = 0;
              }
            });
          } catch (err) {
            console.error('[aggregateVotes] Failed to fetch candidates for zero-fill', err);
          }
          const candidates: Record<string, {count: number; percentage: number; dislikeCount?: number; dislikePercentage?: number}> = {};
          allCandidateIds.forEach((cid) => {
            const count = candidatesCounts[cid] || 0;
            const dislikeCount = candidateDislikeCounts[cid] || 0;

            const entry: {count: number; percentage: number; dislikeCount?: number; dislikePercentage?: number} = {
              count,
              percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 1000) / 10 : 0,
            };
            if (dislikeCount > 0) {
              entry.dislikeCount = dislikeCount;
              entry.dislikePercentage = totalDislikeMarks > 0 ? Math.round((dislikeCount / totalDislikeMarks) * 1000) / 10 : 0;
            }
            candidates[cid] = entry;
          });

          tx.set(ref, {
            electionId,
            totalVotes,
            totalDislikeMarks,
            candidates,
            lastUpdated: FieldValue.serverTimestamp(),
          });
        });
        console.log(`[aggregateVotes] 更新完了 election=${electionId}`);
      } catch (e) {
        console.error(`[aggregateVotes] 更新失敗 election=${electionId}`, e);
      }
    }
  }
);

// User profile creation function
export const createUserProfile = onDocumentWritten(
  "users/{userId}",
  async (event) => {
    if (!event.data?.after?.exists) {
      return;
    }

    const userId = event.params.userId;
    
    const db = getFirestore();
    
    // Initialize empty votes document for new user
    const votesRef = db.collection("votes").doc(userId);
    const votesDoc = await votesRef.get();
    
    if (!votesDoc.exists) {
      await votesRef.set({
        elections: {},
      });
      console.log(`Created votes document for user: ${userId}`);
    }
  }
);

// Election cleanup function (optional)
// This function can be called manually or scheduled to clean up old elections
export const cleanupOldElections = onDocumentWritten(
  "elections/{electionId}",
  async (event) => {
    if (!event.data?.after?.exists) {
      // Election was deleted, clean up related data
      const electionId = event.params.electionId;
      const db = getFirestore();
      
      try {
        // Delete candidates subcollection
        const candidatesSnapshot = await db
          .collection(`elections/${electionId}/candidates`)
          .get();
        
        const batch = db.batch();
        candidatesSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        
        // Delete election results
        const resultRef = db.collection("electionResults").doc(electionId);
        batch.delete(resultRef);
        
        await batch.commit();
        
        console.log(`Cleaned up data for deleted election: ${electionId}`);
      } catch (error) {
        console.error(`Error cleaning up election ${electionId}:`, error);
      }
    }
  }
);
