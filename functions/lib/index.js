"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldElections = exports.createUserProfile = exports.aggregateVotes = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
(0, app_1.initializeApp)();
// Vote aggregation function
// This function triggers whenever a vote document is updated
exports.aggregateVotes = (0, firestore_1.onDocumentWritten)("votes/{userId}", async (event) => {
    var _a, _b;
    const db = (0, firestore_2.getFirestore)();
    if (!event.data) {
        console.log("No data associated with the event");
        return;
    }
    const beforeData = (_a = event.data.before) === null || _a === void 0 ? void 0 : _a.data();
    const afterData = (_b = event.data.after) === null || _b === void 0 ? void 0 : _b.data();
    // Get all elections that were affected
    const electionsToUpdate = new Set();
    // Check for changes in elections
    if (beforeData === null || beforeData === void 0 ? void 0 : beforeData.elections) {
        Object.keys(beforeData.elections).forEach((electionId) => {
            electionsToUpdate.add(electionId);
        });
    }
    if (afterData === null || afterData === void 0 ? void 0 : afterData.elections) {
        Object.keys(afterData.elections).forEach((electionId) => {
            electionsToUpdate.add(electionId);
        });
    }
    // Update aggregation for each affected election
    for (const electionId of electionsToUpdate) {
        try {
            await updateElectionResults(db, electionId);
            console.log(`Updated results for election: ${electionId}`);
        }
        catch (error) {
            console.error(`Error updating results for election ${electionId}:`, error);
        }
    }
});
// Helper function to recalculate election results
async function updateElectionResults(db, electionId) {
    // Get all votes for this election
    const votesSnapshot = await db.collection("votes").get();
    const candidateCounts = {};
    let totalVotes = 0;
    // Count votes for each candidate
    votesSnapshot.forEach((doc) => {
        const voteData = doc.data();
        if (voteData.elections && voteData.elections[electionId]) {
            const candidateId = voteData.elections[electionId].candidateId;
            candidateCounts[candidateId] = (candidateCounts[candidateId] || 0) + 1;
            totalVotes++;
        }
    });
    // Calculate percentages
    const candidates = {};
    Object.entries(candidateCounts).forEach(([candidateId, count]) => {
        candidates[candidateId] = {
            count: count,
            percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 1000) / 10 : 0,
        };
    });
    // Update the results document
    const resultRef = db.collection("electionResults").doc(electionId);
    await resultRef.set({
        electionId,
        totalVotes,
        candidates,
        lastUpdated: new Date(),
    });
}
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