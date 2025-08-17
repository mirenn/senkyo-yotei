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
  writeBatch
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

// User ID hashing (simplified - in production use proper crypto)
export const hashUserId = (uid: string): string => {
  // TODO: Implement proper hashing with salt
  return btoa(uid).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
};

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
    // Use raw UID instead of hashed ID for easier rule matching
    const voteRef = doc(db, 'votes', uid);
    
    const voteData = {
      [`elections.${electionId}`]: {
        candidateId,
        createdAt: dateToTimestamp(new Date()),
        updatedAt: dateToTimestamp(new Date()),
      }
    };
    
    await setDoc(voteRef, voteData, { merge: true });
  },

  // Cancel vote
  async cancelVote(uid: string, electionId: string): Promise<void> {
    // Use raw UID instead of hashed ID for easier rule matching
    const voteRef = doc(db, 'votes', uid);
    
    const voteData = {
      [`elections.${electionId}`]: null
    };
    
    await setDoc(voteRef, voteData, { merge: true });
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
      hashedUserId: uid, // Keep the field name but use raw UID
      elections,
    };
  },
};

// Election Results Service
export const resultsService = {
  // Get election results
  async getElectionResults(electionId: string): Promise<ElectionResult | null> {
    const resultRef = doc(db, 'electionResults', electionId);
    const resultSnap = await getDoc(resultRef);
    
    if (!resultSnap.exists()) {
      return null;
    }

    const data = resultSnap.data();
    return {
      electionId,
      ...data,
      lastUpdated: timestampToDate(data.lastUpdated),
    } as ElectionResult;
  },
};
