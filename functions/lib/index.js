"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldElections = exports.createUserProfile = exports.aggregateVotes = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
(0, app_1.initializeApp)();
console.log('Firebase Admin SDK initialized nagaitestaaaaaaaaaaaaaaaaaaaaaaaaa');
// Vote aggregation function (incremental)
// 投票ドキュメントの変更差分だけを使って逐次加算 / 減算する
exports.aggregateVotes = (0, firestore_1.onDocumentWritten)("votes/{userId}", async (event) => {
    var _a, _b;
    const db = (0, firestore_2.getFirestore)();
    if (!event.data)
        return;
    const beforeVotes = (_a = event.data.before) === null || _a === void 0 ? void 0 : _a.data();
    const afterVotes = (_b = event.data.after) === null || _b === void 0 ? void 0 : _b.data();
    console.log('Before Votes:', beforeVotes);
    console.log('After Votes:', afterVotes);
    const beforeElections = (beforeVotes === null || beforeVotes === void 0 ? void 0 : beforeVotes.elections) || {};
    const afterElections = (afterVotes === null || afterVotes === void 0 ? void 0 : afterVotes.elections) || {};
    // 変更のあった electionId だけ抽出（candidateId が変わらないものは除外）
    const affected = [];
    const electionIds = new Set([
        ...Object.keys(beforeElections),
        ...Object.keys(afterElections),
    ]);
    electionIds.forEach((id) => {
        var _a, _b;
        const b = (_a = beforeElections[id]) === null || _a === void 0 ? void 0 : _a.candidateId;
        const a = (_b = afterElections[id]) === null || _b === void 0 ? void 0 : _b.candidateId;
        if (b !== a) {
            affected.push({ electionId: id, beforeCandidate: b, afterCandidate: a });
        }
    });
    if (affected.length === 0) {
        console.log('[aggregateVotes] 差分なし');
        return;
    }
    console.log('[aggregateVotes] 差分更新開始', affected);
    for (const change of affected) {
        const { electionId, beforeCandidate, afterCandidate } = change;
        try {
            await db.runTransaction(async (tx) => {
                const ref = db.collection('electionResults').doc(electionId);
                const snap = await tx.get(ref);
                const data = snap.exists ? snap.data() : {
                    electionId,
                    totalVotes: 0,
                    candidates: {}, // { candidateId: { count, percentage } }
                };
                // counts をベースに更新後に percentage 再計算
                const candidatesCounts = Object.fromEntries(Object.entries(data.candidates || {}).map(([cid, v]) => [cid, v.count]));
                let totalVotes = data.totalVotes || 0;
                if (beforeCandidate && beforeCandidate !== afterCandidate) {
                    // 別候補へ変更 or 削除
                    if (candidatesCounts[beforeCandidate]) {
                        candidatesCounts[beforeCandidate] -= 1;
                        if (candidatesCounts[beforeCandidate] <= 0)
                            delete candidatesCounts[beforeCandidate];
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
                // totalVotes が負にならない安全策
                if (totalVotes < 0)
                    totalVotes = 0;
                // percentage 再計算
                const candidates = {};
                Object.entries(candidatesCounts).forEach(([cid, count]) => {
                    candidates[cid] = {
                        count,
                        percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 1000) / 10 : 0,
                    };
                });
                tx.set(ref, {
                    electionId,
                    totalVotes,
                    candidates,
                    lastUpdated: firestore_2.FieldValue.serverTimestamp(),
                });
            });
            console.log(`[aggregateVotes] 更新完了 election=${electionId}`);
        }
        catch (e) {
            console.error(`[aggregateVotes] 更新失敗 election=${electionId}`, e);
        }
    }
});
// User profile creation function
exports.createUserProfile = (0, firestore_1.onDocumentWritten)("users/{userId}", async (event) => {
    var _a, _b;
    if (!((_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after) === null || _b === void 0 ? void 0 : _b.exists)) {
        return;
    }
    const userId = event.params.userId;
    const db = (0, firestore_2.getFirestore)();
    // Initialize empty votes document for new user
    const votesRef = db.collection("votes").doc(userId);
    const votesDoc = await votesRef.get();
    if (!votesDoc.exists) {
        await votesRef.set({
            elections: {},
        });
        console.log(`Created votes document for user: ${userId}`);
    }
});
// Election cleanup function (optional)
// This function can be called manually or scheduled to clean up old elections
exports.cleanupOldElections = (0, firestore_1.onDocumentWritten)("elections/{electionId}", async (event) => {
    var _a, _b;
    if (!((_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after) === null || _b === void 0 ? void 0 : _b.exists)) {
        // Election was deleted, clean up related data
        const electionId = event.params.electionId;
        const db = (0, firestore_2.getFirestore)();
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
        }
        catch (error) {
            console.error(`Error cleaning up election ${electionId}:`, error);
        }
    }
});
//# sourceMappingURL=index.js.map