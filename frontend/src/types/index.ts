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
  userId: string;
  elections: {
    [electionId: string]: {
      candidateId: string;
      createdAt: Date;
      updatedAt: Date;
    // ユーザーが「投票したくない」とマークした候補者ID一覧（複数可）
    dislikedCandidates?: string[];
    };
  };
}

export interface ElectionResult {
  electionId: string;
  totalVotes: number;
  // 不支持マーク総数（全候補合計）
  totalDislikeMarks?: number;
  candidates: {
    [candidateId: string]: {
      count: number;
      percentage: number;
    // 「投票したくない」マーク数
    dislikeCount?: number;
    // 全不支持マークに対する割合（totalDislikeMarks が存在する場合）
    dislikePercentage?: number;
    };
  };
  lastUpdated: Date;
}
