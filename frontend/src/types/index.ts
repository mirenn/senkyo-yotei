export interface Election {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Candidate {
  id: string;
  electionId: string;
  name: string;
  description: string;
  imageUrl: string;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  createdAt: Date;
  lastLogin: Date;
}

export interface Vote {
  hashedUserId: string;
  elections: {
    [electionId: string]: {
      candidateId: string;
      createdAt: Date;
      updatedAt: Date;
    };
  };
}

export interface ElectionResult {
  electionId: string;
  totalVotes: number;
  candidates: {
    [candidateId: string]: {
      count: number;
      percentage: number;
    };
  };
  lastUpdated: Date;
}
