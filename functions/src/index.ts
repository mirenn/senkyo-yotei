import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

initializeApp();

// Vote aggregation function
// This function triggers whenever a vote document is updated
export const aggregateVotes = onDocumentWritten(
  "votes/{userId}",
  async (event) => {
    const db = getFirestore();
    
    if (!event.data) {
      console.log("No data associated with the event");
      return;
    }

    const beforeData = event.data.before?.data();
    const afterData = event.data.after?.data();

    // Get all elections that were affected
    const electionsToUpdate = new Set<string>();
    
    // Check for changes in elections
    if (beforeData?.elections) {
      Object.keys(beforeData.elections).forEach((electionId) => {
        electionsToUpdate.add(electionId);
      });
    }
    
    if (afterData?.elections) {
      Object.keys(afterData.elections).forEach((electionId) => {
        electionsToUpdate.add(electionId);
      });
    }

    // Update aggregation for each affected election
    for (const electionId of electionsToUpdate) {
      try {
        await updateElectionResults(db, electionId);
        console.log(`Updated results for election: ${electionId}`);
      } catch (error) {
        console.error(`Error updating results for election ${electionId}:`, error);
      }
    }
  }
);

// Helper function to recalculate election results
async function updateElectionResults(db: any, electionId: string) {
  // Get all votes for this election
  const votesSnapshot = await db.collection("votes").get();
  
  const candidateCounts: {[candidateId: string]: number} = {};
  let totalVotes = 0;

  // Count votes for each candidate
  votesSnapshot.forEach((doc: any) => {
    const voteData = doc.data();
    if (voteData.elections && voteData.elections[electionId]) {
      const candidateId = voteData.elections[electionId].candidateId;
      candidateCounts[candidateId] = (candidateCounts[candidateId] || 0) + 1;
      totalVotes++;
    }
  });

  // Calculate percentages
  const candidates: {[candidateId: string]: {count: number; percentage: number}} = {};
  
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
