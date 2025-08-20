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
  // Get all elections (with optional filtering by admin status)
  async getElections(includeInactive: boolean = false): Promise<Election[]> {
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
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          status: data.status || 'active', // Default to active if status not set
          startDate: timestampToDate(data.startDate),
          endDate: timestampToDate(data.endDate),
          createdAt: timestampToDate(data.createdAt),
          updatedAt: timestampToDate(data.updatedAt),
        };
      }) as Election[];
      
      // Filter out inactive elections unless explicitly requested (for admins)
      const filteredElections = includeInactive ? elections : elections.filter(election => election.status === 'active');
      
      console.log('Processed elections:', filteredElections);
      return filteredElections;
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
      status: data.status || 'active', // Default to active if status not set
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
  // Get candidates for an election (with optional filtering by status)
  async getCandidates(electionId: string, includeInactive: boolean = false): Promise<Candidate[]> {
    const candidatesRef = collection(db, 'elections', electionId, 'candidates');
    const q = query(candidatesRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    
    const candidates = snapshot.docs.map(doc => ({
      id: doc.id,
      electionId,
      ...doc.data(),
      status: doc.data().status || 'active', // Default to active if status not set
      createdAt: timestampToDate(doc.data().createdAt),
    })) as Candidate[];

    // Filter out inactive candidates unless explicitly requested (for admins)
    return includeInactive ? candidates : candidates.filter(candidate => candidate.status === 'active');
  },

  // Create candidate
  async createCandidate(electionId: string, candidateData: Omit<Candidate, 'id' | 'electionId'>): Promise<string> {
    const candidatesRef = collection(db, 'elections', electionId, 'candidates');
    const docRef = await addDoc(candidatesRef, {
      ...candidateData,
      status: candidateData.status || 'active', // Default to active
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
        status: candidateData.status || 'active', // Default to active
        createdAt: dateToTimestamp(new Date()),
      });
    });
    
    await batch.commit();
  },

  // Update candidate status (activate/deactivate)
  async updateCandidateStatus(electionId: string, candidateId: string, status: 'active' | 'inactive'): Promise<void> {
    const candidateRef = doc(db, 'elections', electionId, 'candidates', candidateId);
    await updateDoc(candidateRef, {
      status,
      updatedAt: dateToTimestamp(new Date()),
    });
  },

  // Update all candidates for an election (for editing) - now with status management
  async updateElectionCandidates(electionId: string, candidates: Candidate[]): Promise<void> {
    const batch = writeBatch(db);
    
    // First, get existing candidates to see which ones to deactivate instead of delete
    const existingCandidatesRef = collection(db, 'elections', electionId, 'candidates');
    const existingSnapshot = await getDocs(existingCandidatesRef);
    const existingIds = new Set(existingSnapshot.docs.map(doc => doc.id));
    
    // Track which candidates we're keeping/updating
    const updatedIds = new Set<string>();
    
    candidates.forEach((candidate) => {
      if (candidate.id.startsWith('temp_')) {
        // New candidate - create it
        const candidateRef = doc(collection(db, 'elections', electionId, 'candidates'));
        batch.set(candidateRef, {
          name: candidate.name,
          description: candidate.description,
          imageUrl: candidate.imageUrl,
          status: candidate.status || 'active', // Default to active
          createdAt: dateToTimestamp(new Date()),
        });
      } else {
        // Existing candidate - update it
        const candidateRef = doc(db, 'elections', electionId, 'candidates', candidate.id);
        batch.set(candidateRef, {
          name: candidate.name,
          description: candidate.description,
          imageUrl: candidate.imageUrl,
          status: candidate.status || 'active', // Preserve or set status
          createdAt: dateToTimestamp(candidate.createdAt),
          updatedAt: dateToTimestamp(new Date()),
        }, { merge: true });
        updatedIds.add(candidate.id);
      }
    });
    
    // Mark candidates as inactive instead of deleting them to preserve voting history
    existingIds.forEach(id => {
      if (!updatedIds.has(id)) {
        const candidateRef = doc(db, 'elections', electionId, 'candidates', id);
        batch.update(candidateRef, {
          status: 'inactive',
          updatedAt: dateToTimestamp(new Date()),
        });
      }
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
    
    // Set isAdmin to true by default as per requirement
    const userDataWithAdmin = {
      ...userData,
      isAdmin: userData.isAdmin !== undefined ? userData.isAdmin : true, // Default to admin
    };
    
    // Use setDoc instead of updateDoc to handle both create and update cases
    await setDoc(userRef, {
      ...userDataWithAdmin,
      createdAt: dateToTimestamp(userDataWithAdmin.createdAt),
      lastLogin: dateToTimestamp(userDataWithAdmin.lastLogin),
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
      // 投票対象候補は不支持配列から除外
      const cleanedDislikes = (prev?.dislikedCandidates || []).filter((id: string) => id !== candidateId);
      elections[electionId] = {
        candidateId,
        createdAt: prev?.createdAt ?? dateToTimestamp(now),
        updatedAt: dateToTimestamp(now),
        // 投票済候補は不支持にできない仕様
        dislikedCandidates: cleanedDislikes,
      };
      // 仕様どおりの形を保証: { elections: { <electionId>: {...} } }
      tx.set(voteRef, { elections });
    });

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
        // 投票は削除するが、不支持リストは維持したい場合は candidateId のみ削除し配列残す
        const disliked = elections[electionId].dislikedCandidates || [];
        if (disliked.length > 0) {
          elections[electionId] = {
            dislikedCandidates: disliked,
            createdAt: elections[electionId].createdAt ?? dateToTimestamp(new Date()),
            updatedAt: dateToTimestamp(new Date()),
          };
        } else {
          delete elections[electionId];
        }
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
            dislikedCandidates: Array.isArray(voteData.dislikedCandidates) ? voteData.dislikedCandidates : undefined,
          };
        }
      });
    }

    return {
      userId: uid,
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
        return cachedResults;
      }
      console.log('❌ [getElectionResults] No cached results found in Firestore, returning empty structure');
      return {
        electionId,
        totalVotes: 0,
        candidates: {},
        lastUpdated: new Date(),
      };
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

  // manualAggregateVotes および saveElectionResults は Cloud Functions 集計移行により削除
};

// 不支持候補操作用サービス (再追加)
export const dislikeService = {
  async toggleDislike(uid: string, electionId: string, candidateId: string): Promise<void> {
    const voteRef = doc(db, 'votes', uid);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(voteRef);
      let elections: Record<string, any> = {};
      if (snap.exists()) {
        const data = snap.data();
        if (data && typeof data.elections === 'object') {
          elections = { ...data.elections };
        }
      }
      const now = new Date();
      const current = elections[electionId] || {
        createdAt: dateToTimestamp(now),
      };
      if (current.candidateId === candidateId) {
        return; // 投票済み候補は不支持不可
      }
      const list: string[] = Array.isArray(current.dislikedCandidates) ? [...current.dislikedCandidates] : [];
      const idx = list.indexOf(candidateId);
      if (idx >= 0) list.splice(idx, 1); else list.push(candidateId);
      elections[electionId] = {
        ...current,
        candidateId: current.candidateId,
        dislikedCandidates: list,
        updatedAt: dateToTimestamp(now),
      };
      tx.set(voteRef, { elections });
    });
  }
};
