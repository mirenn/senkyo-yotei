import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot,
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
    const electionsRef = collection(db, 'elections');
    const q = query(electionsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startDate: timestampToDate(doc.data().startDate),
      endDate: timestampToDate(doc.data().endDate),
      createdAt: timestampToDate(doc.data().createdAt),
      updatedAt: timestampToDate(doc.data().updatedAt),
    })) as Election[];
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
      createdBy: hashUserId(electionData.createdBy),
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
      updateData.createdBy = hashUserId(updates.createdBy);
    }

    await updateDoc(docRef, updateData);
  },

  // Delete election
  async deleteElection(id: string): Promise<void> {
    const docRef = doc(db, 'elections', id);
    await deleteDoc(docRef);
  },

  // Listen to elections changes
  onElectionsChange(callback: (elections: Election[]) => void) {
    const electionsRef = collection(db, 'elections');
    const q = query(electionsRef, orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const elections = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: timestampToDate(doc.data().startDate),
        endDate: timestampToDate(doc.data().endDate),
        createdAt: timestampToDate(doc.data().createdAt),
        updatedAt: timestampToDate(doc.data().updatedAt),
      })) as Election[];
      
      callback(elections);
    });
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

  // Listen to candidates changes
  onCandidatesChange(electionId: string, callback: (candidates: Candidate[]) => void) {
    const candidatesRef = collection(db, 'elections', electionId, 'candidates');
    const q = query(candidatesRef, orderBy('createdAt', 'asc'));
    
    return onSnapshot(q, (snapshot) => {
      const candidates = snapshot.docs.map(doc => ({
        id: doc.id,
        electionId,
        ...doc.data(),
        createdAt: timestampToDate(doc.data().createdAt),
      })) as Candidate[];
      
      callback(candidates);
    });
  },
};

// User Service
export const userService = {
  // Create or update user profile
  async createOrUpdateUser(uid: string, userData: Omit<User, 'id'>): Promise<void> {
    const hashedUserId = hashUserId(uid);
    const userRef = doc(db, 'users', hashedUserId);
    
    await updateDoc(userRef, {
      ...userData,
      createdAt: dateToTimestamp(userData.createdAt),
      lastLogin: dateToTimestamp(userData.lastLogin),
    });
  },

  // Get user profile
  async getUser(uid: string): Promise<User | null> {
    const hashedUserId = hashUserId(uid);
    const userRef = doc(db, 'users', hashedUserId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return null;
    }

    const data = userSnap.data();
    return {
      id: hashedUserId,
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
    const hashedUserId = hashUserId(uid);
    const voteRef = doc(db, 'votes', hashedUserId);
    
    const voteData = {
      [`elections.${electionId}`]: {
        candidateId,
        createdAt: dateToTimestamp(new Date()),
        updatedAt: dateToTimestamp(new Date()),
      }
    };
    
    await updateDoc(voteRef, voteData);
  },

  // Cancel vote
  async cancelVote(uid: string, electionId: string): Promise<void> {
    const hashedUserId = hashUserId(uid);
    const voteRef = doc(db, 'votes', hashedUserId);
    
    const voteData = {
      [`elections.${electionId}`]: null
    };
    
    await updateDoc(voteRef, voteData);
  },

  // Get user's votes
  async getUserVotes(uid: string): Promise<Vote | null> {
    const hashedUserId = hashUserId(uid);
    const voteRef = doc(db, 'votes', hashedUserId);
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
      hashedUserId,
      elections,
    };
  },

  // Listen to user's votes changes
  onUserVotesChange(uid: string, callback: (votes: Vote | null) => void) {
    const hashedUserId = hashUserId(uid);
    const voteRef = doc(db, 'votes', hashedUserId);
    
    return onSnapshot(voteRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      const data = snapshot.data();
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
      
      callback({
        hashedUserId,
        elections,
      });
    });
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

  // Listen to election results changes
  onElectionResultsChange(electionId: string, callback: (results: ElectionResult | null) => void) {
    const resultRef = doc(db, 'electionResults', electionId);
    
    return onSnapshot(resultRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      const data = snapshot.data();
      callback({
        electionId,
        ...data,
        lastUpdated: timestampToDate(data.lastUpdated),
      } as ElectionResult);
    });
  },
};
