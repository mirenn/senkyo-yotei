import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  Timestamp,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { db } from './config';
import { type Election, type Candidate, type User, type Vote, type ElectionResult } from '../types';

// Helper function to convert Firestore Timestamp to Date
const timestampToDate = (timestamp: any): Date => {
  if (timestamp && timestamp.toDate) {
    return timestamp.toDate();
  }
  return new Date(timestamp);
};

// Helper function to convert Date to Firestore Timestamp
const dateToTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date);
};

// Note: Previously used hashed user IDs, but now using raw UIDs for simplified management

// Elections Service
export const electionService = {
  // Get all elections
  async getElections(): Promise<Election[]> {
    console.log('Starting to fetch elections...');
    console.log('Database instance:', db);
    
    try {
      const electionsRef = collection(db, 'elections');
      console.log('Elections collection reference:', electionsRef);
      
      const q = query(electionsRef, orderBy('createdAt', 'desc'));
      console.log('Query created:', q);
      
      console.log('Executing getDocs...');
      const snapshot = await getDocs(q);
      console.log('Snapshot received:', snapshot);
      console.log('Number of documents:', snapshot.docs.length);
      
      const elections = snapshot.docs.map(doc => {
        console.log('Processing document:', doc.id, doc.data());
        return {
          id: doc.id,
          ...doc.data(),
          startDate: timestampToDate(doc.data().startDate),
          endDate: timestampToDate(doc.data().endDate),
          createdAt: timestampToDate(doc.data().createdAt),
          updatedAt: timestampToDate(doc.data().updatedAt),
        };
      }) as Election[];
      
      console.log('Processed elections:', elections);
      return elections;
    } catch (error) {
      console.error('Detailed error in getElections:', error);
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error?.constructor?.name);
      console.error('Error message:', (error as any)?.message);
      console.error('Error code:', (error as any)?.code);
      throw error;
    }
  },

  // Get election by ID
  async getElection(id: string): Promise<Election | null> {
    const docRef = doc(db, 'elections', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      startDate: timestampToDate(data.startDate),
      endDate: timestampToDate(data.endDate),
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    } as Election;
  },

  // Create election
  async createElection(electionData: Omit<Election, 'id'>): Promise<string> {
    const electionsRef = collection(db, 'elections');
    const docRef = await addDoc(electionsRef, {
      ...electionData,
      startDate: dateToTimestamp(electionData.startDate),
      endDate: dateToTimestamp(electionData.endDate),
      createdAt: dateToTimestamp(electionData.createdAt),
      updatedAt: dateToTimestamp(electionData.updatedAt),
      // Store the raw UID instead of hashed one for easier rule matching
      createdBy: electionData.createdBy,
    });
    
    return docRef.id;
  },

  // Update election
  async updateElection(id: string, updates: Partial<Omit<Election, 'id' | 'createdAt'>>): Promise<void> {
    const docRef = doc(db, 'elections', id);
    const updateData: any = {
      ...updates,
      updatedAt: dateToTimestamp(new Date()),
    };

    if (updates.startDate) {
      updateData.startDate = dateToTimestamp(updates.startDate);
    }
    if (updates.endDate) {
      updateData.endDate = dateToTimestamp(updates.endDate);
    }
    if (updates.createdBy) {
      // Store the raw UID instead of hashed one for easier rule matching
      updateData.createdBy = updates.createdBy;
    }

    await updateDoc(docRef, updateData);
  },

  // Delete election
  async deleteElection(id: string): Promise<void> {
    const docRef = doc(db, 'elections', id);
    await deleteDoc(docRef);
  },
};

// Candidates Service
export const candidateService = {
  // Get candidates for an election
  async getCandidates(electionId: string): Promise<Candidate[]> {
    const candidatesRef = collection(db, 'elections', electionId, 'candidates');
    const q = query(candidatesRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      electionId,
      ...doc.data(),
      createdAt: timestampToDate(doc.data().createdAt),
    })) as Candidate[];
  },

  // Create candidate
  async createCandidate(electionId: string, candidateData: Omit<Candidate, 'id' | 'electionId'>): Promise<string> {
    const candidatesRef = collection(db, 'elections', electionId, 'candidates');
    const docRef = await addDoc(candidatesRef, {
      ...candidateData,
      createdAt: dateToTimestamp(candidateData.createdAt),
    });
    
    return docRef.id;
  },

  // Create multiple candidates in batch
  async createCandidates(electionId: string, candidates: Omit<Candidate, 'id' | 'electionId'>[]): Promise<void> {
    const batch = writeBatch(db);
    
    candidates.forEach((candidateData) => {
      const candidateRef = doc(collection(db, 'elections', electionId, 'candidates'));
      batch.set(candidateRef, {
        ...candidateData,
        createdAt: dateToTimestamp(new Date()),
      });
    });
    
    await batch.commit();
  },
};

// User Service
export const userService = {
  // Create or update user profile
  async createOrUpdateUser(uid: string, userData: Omit<User, 'id'>): Promise<void> {
    // Use raw UID instead of hashed ID for easier rule matching
    const userRef = doc(db, 'users', uid);
    
    // Use setDoc instead of updateDoc to handle both create and update cases
    await setDoc(userRef, {
      ...userData,
      createdAt: dateToTimestamp(userData.createdAt),
      lastLogin: dateToTimestamp(userData.lastLogin),
    }, { merge: true });
  },

  // Get user profile
  async getUser(uid: string): Promise<User | null> {
    // Use raw UID instead of hashed ID for easier rule matching
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return null;
    }

    const data = userSnap.data();
    return {
      id: uid,
      ...data,
      createdAt: timestampToDate(data.createdAt),
      lastLogin: timestampToDate(data.lastLogin),
    } as User;
  },
};

// Vote Service
export const voteService = {
  // Submit or update vote
  async submitVote(uid: string, electionId: string, candidateId: string): Promise<void> {
    const voteRef = doc(db, 'votes', uid);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(voteRef);
      const now = new Date();
      let elections: Record<string, any> = {};
      if (snap.exists()) {
        const data = snap.data();
        if (data && typeof data.elections === 'object') {
          elections = { ...data.elections }; // clone
        }
      }
      const prev = elections[electionId];
      elections[electionId] = {
        candidateId,
        createdAt: prev?.createdAt ?? dateToTimestamp(now),
        updatedAt: dateToTimestamp(now),
      };
      // 仕様どおりの形を保証: { elections: { <electionId>: {...} } }
      tx.set(voteRef, { elections });
    });

    try {
      const updatedResults = await resultsService.manualAggregateVotes(electionId, uid);
      console.log('[submitVote] Updated election results after vote:', updatedResults);
    } catch (error) {
      console.log('[submitVote] Error updating election results cache:', error);
    }
  },

  // Cancel vote
  async cancelVote(uid: string, electionId: string): Promise<void> {
    const voteRef = doc(db, 'votes', uid);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(voteRef);
      if (!snap.exists()) return; // 何もしない
      const data = snap.data();
      let elections: Record<string, any> = {};
      if (data && typeof data.elections === 'object') {
        elections = { ...data.elections };
      }
      if (elections[electionId]) {
        delete elections[electionId];
      }
      // 空でも明示的に elections: {} を保持し仕様形維持
      tx.set(voteRef, { elections });
    });

    try {
      const currentResults = await resultsService.getElectionResults(electionId);
      console.log('[cancelVote] Refreshed election results after vote cancellation:', currentResults);
    } catch (error) {
      console.log('[cancelVote] Error refreshing election results cache:', error);
    }
  },

  // Get user's votes
  async getUserVotes(uid: string): Promise<Vote | null> {
    // Use raw UID instead of hashed ID for easier rule matching
    const voteRef = doc(db, 'votes', uid);
    const voteSnap = await getDoc(voteRef);
    
    if (!voteSnap.exists()) {
      return null;
    }

    const data = voteSnap.data();
    const elections: Vote['elections'] = {};
    
    if (data.elections) {
      Object.entries(data.elections).forEach(([electionId, voteData]: [string, any]) => {
        if (voteData) {
          elections[electionId] = {
            candidateId: voteData.candidateId,
            createdAt: timestampToDate(voteData.createdAt),
            updatedAt: timestampToDate(voteData.updatedAt),
          };
        }
      });
    }
    
    return {
      userId: uid, // Using raw UID for simplified management
      elections,
    };
  },
};

// Election Results Service
export const resultsService = {
  // Get election results with fallback to cached or mock data
  async getElectionResults(electionId: string): Promise<ElectionResult | null> {
    console.log('🔍 [getElectionResults] Starting to fetch results for electionId:', electionId);
    try {
      // First try to get pre-calculated results
      const resultRef = doc(db, 'electionResults', electionId);
      console.log('📖 [getElectionResults] Reading from electionResults collection, docId:', electionId);
      const resultSnap = await getDoc(resultRef);
      
      if (resultSnap.exists()) {
        console.log('✅ [getElectionResults] Found cached results in Firestore');
        const data = resultSnap.data();
        const cachedResults = {
          electionId,
          ...data,
          lastUpdated: timestampToDate(data.lastUpdated),
        } as ElectionResult;
        
        // Check if cached results are recent (within 1 minute)
        const now = new Date();
        const timeDiff = now.getTime() - cachedResults.lastUpdated.getTime();
        console.log('⏰ [getElectionResults] Cached results age:', timeDiff / 1000, 'seconds');
        if (timeDiff < 60000) { // 1 minute
          console.log('🎯 [getElectionResults] Using cached results (fresh within 1 minute)');
          return cachedResults;
        }
        console.log('⏳ [getElectionResults] Cached results too old, will perform manual aggregation');
      } else {
        console.log('❌ [getElectionResults] No cached results found in Firestore');
      }

      // If no recent cached results exist, perform manual aggregation
      console.log('🔄 [getElectionResults] No recent cached results found, performing manual aggregation...');
      const aggregatedResults = await this.manualAggregateVotes(electionId);
      console.log('📊 [getElectionResults] Manual aggregation complete:', aggregatedResults);
      return aggregatedResults;
    } catch (error) {
      console.error('❌ [getElectionResults] Error fetching election results:', error);
      console.log('🆘 [getElectionResults] Falling back to empty results');
      // Fallback to empty results
      return {
        electionId,
        totalVotes: 0,
        candidates: {},
        lastUpdated: new Date()
      };
    }
  },

  // Get mock election results for development/demo purposes
  getMockElectionResults(electionId: string): ElectionResult {
    // Generate consistent mock data based on electionId
    const seed = electionId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const random = (seed: number) => ((seed * 9301 + 49297) % 233280) / 233280;
    
    const totalVotes = Math.floor(random(seed) * 1000) + 500; // 500-1500 votes
    const candidates = {
      candidate1: {
        count: Math.floor(totalVotes * (0.35 + random(seed + 1) * 0.2)), // 35-55%
        percentage: 0
      },
      candidate2: {
        count: 0,
        percentage: 0
      },
      candidate3: {
        count: 0,
        percentage: 0
      }
    };

    // Calculate candidate2 and candidate3 votes
    const remaining = totalVotes - candidates.candidate1.count;
    candidates.candidate2.count = Math.floor(remaining * (0.4 + random(seed + 2) * 0.3)); // Variable split
    candidates.candidate3.count = remaining - candidates.candidate2.count;

    // Calculate percentages
    Object.keys(candidates).forEach(candidateId => {
      const candidate = candidates[candidateId as keyof typeof candidates];
      candidate.percentage = Math.round((candidate.count / totalVotes) * 1000) / 10;
    });

    return {
      electionId,
      totalVotes,
      candidates,
      lastUpdated: new Date(),
    };
  },

  // Manual aggregation function for development (when Cloud Functions are not available)
  // ⚠️ SECURITY WARNING: This is a temporary workaround - MUST BE REPLACED WITH CLOUD FUNCTIONS
  async manualAggregateVotes(electionId: string, userId?: string): Promise<ElectionResult | null> {
    try {
      console.log('🔧 [manualAggregateVotes] Starting manual aggregation:', { electionId, userId });
      
      // ⚠️ TEMPORARY WORKAROUND: Since we can't read all votes due to security rules,
      // we'll create a simplified aggregation based on available data
      
      // Get candidates for this election
      console.log('👥 [manualAggregateVotes] Fetching candidates...');
      const candidates = await candidateService.getCandidates(electionId);
      console.log('👥 [manualAggregateVotes] Found candidates:', candidates.length, candidates.map(c => ({ id: c.id, name: c.name })));
      
      // Check if user has voted (if userId provided)
      let userVotedCandidateId: string | null = null;
      if (userId) {
        try {
          console.log('🗳️ [manualAggregateVotes] Checking user vote for userId:', userId);
          const userVote = await voteService.getUserVotes(userId);
          userVotedCandidateId = userVote?.elections[electionId]?.candidateId || null;
          console.log('🗳️ [manualAggregateVotes] User voted for candidateId:', userVotedCandidateId);
        } catch (error) {
          console.log('⚠️ [manualAggregateVotes] Could not get user vote:', error);
        }
      }
      
      // Create results structure - we can't get real aggregation without Cloud Functions
      const results: {[candidateId: string]: {count: number; percentage: number}} = {};
      let totalVotes = 0;
      
      candidates.forEach(candidate => {
        // For now, show 1 vote for the candidate the user voted for, 0 for others
        const count = candidate.id === userVotedCandidateId ? 1 : 0;
        results[candidate.id] = {
          count,
          percentage: 0 // Will calculate after totalVotes is determined
        };
        totalVotes += count;
      });
      
      // Calculate percentages
      candidates.forEach(candidate => {
        if (totalVotes > 0) {
          results[candidate.id].percentage = Math.round((results[candidate.id].count / totalVotes) * 1000) / 10;
        }
      });
      
      const finalResults: ElectionResult = {
        electionId,
        totalVotes,
        candidates: results,
        lastUpdated: new Date()
      };
      
      console.log('📊 [manualAggregateVotes] Manual aggregation results (user votes only):', finalResults);
      
      // Save results to Firestore
      console.log('💾 [manualAggregateVotes] Saving results to Firestore...');
      await this.saveElectionResults(finalResults);
      console.log('✅ [manualAggregateVotes] Results saved successfully');
      
      return finalResults;
    } catch (error) {
      console.error('❌ [manualAggregateVotes] Error in manual aggregation:', error);
      // Return empty results
      console.log('🆘 [manualAggregateVotes] Falling back to empty results');
      const candidates = await candidateService.getCandidates(electionId).catch(() => []);
      const results: {[candidateId: string]: {count: number; percentage: number}} = {};
      
      candidates.forEach(candidate => {
        results[candidate.id] = { count: 0, percentage: 0 };
      });
      
      const emptyResults = {
        electionId,
        totalVotes: 0,
        candidates: results,
        lastUpdated: new Date()
      };
      
      console.log('🆘 [manualAggregateVotes] Empty results created:', emptyResults);
      return emptyResults;
    }
  },

  // Save calculated results to Firestore (optional caching)
  async saveElectionResults(result: ElectionResult): Promise<void> {
    try {
      console.log('💾 [saveElectionResults] Saving to electionResults collection, docId:', result.electionId);
      const resultRef = doc(db, 'electionResults', result.electionId);
      const dataToSave = {
        ...result,
        lastUpdated: dateToTimestamp(result.lastUpdated),
      };
      console.log('💾 [saveElectionResults] Data to save:', dataToSave);
      await setDoc(resultRef, dataToSave);
      console.log('✅ [saveElectionResults] Successfully saved election results to Firestore:', result);
    } catch (error) {
      console.error('❌ [saveElectionResults] Error saving election results:', error);
    }
  },
};
