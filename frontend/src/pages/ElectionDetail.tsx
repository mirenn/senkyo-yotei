import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { electionService, candidateService, voteService, resultsService } from '../firebase/services';
import { type Election, type Candidate, type ElectionResult } from '../types';

const ElectionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { state } = useAuth();
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [results, setResults] = useState<ElectionResult | null>(null);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // データ更新用の関数
  const refreshData = async () => {
    if (!id) return;

    try {
      const [candidatesData, resultsData] = await Promise.all([
        candidateService.getCandidates(id),
        resultsService.getElectionResults(id)
      ]);

      setCandidates(candidatesData);
      setResults(resultsData);

      // ユーザーの投票も更新
      if (state.user) {
        const userVotes = await voteService.getUserVotes(state.user.uid);
        if (userVotes?.elections[id]) {
          setUserVote(userVotes.elections[id].candidateId);
        } else {
          setUserVote(null);
        }
      }
    } catch (err) {
      console.log('Error refreshing data:', err);
    }
  };

  useEffect(() => {
    if (!id) return;

    const fetchElectionData = async () => {
      try {
        setLoading(true);
        setError(null);

        try {
          // Try to fetch from Firestore
          const [electionData, candidatesData, resultsData] = await Promise.all([
            electionService.getElection(id),
            candidateService.getCandidates(id),
            resultsService.getElectionResults(id)
          ]);

          if (electionData) {
            setElection(electionData);
            setCandidates(candidatesData);
            setResults(resultsData);

            // Fetch user's vote if authenticated
            if (state.user) {
              const userVotes = await voteService.getUserVotes(state.user.uid);
              if (userVotes?.elections[id]) {
                setUserVote(userVotes.elections[id].candidateId);
              }
            }
          } else {
            throw new Error('Election not found in Firestore');
          }
        } catch (firestoreError) {
          console.log('Firestore not available, using mock data:', firestoreError);
          
          // Fall back to mock data
          const mockElection: Election = {
            id: id,
            title: '市長選挙 2024',
            description: '市の未来を決める重要な選挙です。各候補者の政策をよく検討してご投票ください。',
            startDate: new Date('2024-09-01'),
            endDate: new Date('2024-09-15'),
            createdBy: 'user1',
            createdAt: new Date('2024-08-01'),
            updatedAt: new Date('2024-08-01'),
          };

          const mockCandidates: Candidate[] = [
            {
              id: 'candidate1',
              electionId: id,
              name: '田中太郎',
              description: '経済活性化と教育改革を推進します',
              imageUrl: '/images/candidate1.jpg',
              createdAt: new Date('2024-08-01'),
            },
            {
              id: 'candidate2',
              electionId: id,
              name: '佐藤花子',
              description: '福祉の充実と環境保護に取り組みます',
              imageUrl: '/images/candidate2.jpg',
              createdAt: new Date('2024-08-01'),
            },
            {
              id: 'candidate3',
              electionId: id,
              name: '鈴木次郎',
              description: 'インフラ整備と地域振興を重視します',
              imageUrl: '/images/candidate3.jpg',
              createdAt: new Date('2024-08-01'),
            },
          ];

          const mockResults: ElectionResult = {
            electionId: id,
            totalVotes: 1250,
            candidates: {
              candidate1: { count: 520, percentage: 41.6 },
              candidate2: { count: 430, percentage: 34.4 },
              candidate3: { count: 300, percentage: 24.0 },
            },
            lastUpdated: new Date(),
          };

          setElection(mockElection);
          setCandidates(mockCandidates);
          setResults(mockResults);
          
          if (state.user) {
            setUserVote('candidate1'); // Mock user vote
          }
        }

      } catch (err) {
        setError('選挙データの取得に失敗しました');
        console.error('Error fetching election data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchElectionData();
  }, [id, state.user]);

  const handleVote = async (candidateId: string) => {
    if (!state.user || !election) {
      alert('投票するにはログインが必要です');
      return;
    }

    try {
      await voteService.submitVote(state.user.uid, election.id, candidateId);
      setUserVote(candidateId);
      // データを更新
      refreshData();
      alert('投票が完了しました！');
    } catch (err) {
      console.log('Firestore not available, using mock behavior:', err);
      // Mock behavior
      setUserVote(candidateId);
      alert('投票が完了しました！（デモモード）');
    }
  };

  const handleCancelVote = async () => {
    if (!state.user || !userVote || !election) return;

    try {
      await voteService.cancelVote(state.user.uid, election.id);
      setUserVote(null);
      // データを更新
      refreshData();
      alert('投票を取り消しました');
    } catch (err) {
      console.log('Firestore not available, using mock behavior:', err);
      // Mock behavior
      setUserVote(null);
      alert('投票を取り消しました（デモモード）');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !election) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error || '選挙が見つかりません'}</p>
        <Link to="/elections" className="text-blue-600 hover:underline">
          選挙一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Election Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">{election.title}</h1>
          <button
            onClick={refreshData}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            title="最新データを取得"
          >
            🔄 更新
          </button>
        </div>
        <p className="text-gray-600 mb-4">{election.description}</p>
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <span>投票期間: {election.startDate.toLocaleDateString()} - {election.endDate.toLocaleDateString()}</span>
          <span>総投票数: {results?.totalVotes || 0}票</span>
        </div>
      </div>

      {/* User's Current Vote */}
      {userVote && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-800 font-medium">
                現在の投票先: {candidates.find(c => c.id === userVote)?.name}
              </p>
              <p className="text-blue-600 text-sm">投票は自由に変更・取り消しできます</p>
            </div>
            <button
              onClick={handleCancelVote}
              className="px-4 py-2 text-sm border border-blue-300 rounded-md text-blue-700 hover:bg-blue-100"
            >
              投票を取り消す
            </button>
          </div>
        </div>
      )}

      {/* Candidates List */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">候補者一覧</h2>
        {candidates.map((candidate) => {
          const candidateResult = results?.candidates[candidate.id];
          const isUserVote = userVote === candidate.id;
          
          return (
            <div
              key={candidate.id}
              className={`bg-white rounded-lg shadow p-6 border-2 ${
                isUserVote ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <img
                    src={candidate.imageUrl}
                    alt={candidate.name}
                    className="w-16 h-16 rounded-full object-cover bg-gray-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/default-avatar.png';
                    }}
                  />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{candidate.name}</h3>
                    <p className="text-gray-600 mt-2">{candidate.description}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  {candidateResult && (
                    <div className="mb-3">
                      <div className="text-2xl font-bold text-gray-900">
                        {candidateResult.count}票
                      </div>
                      <div className="text-lg text-gray-600">
                        ({candidateResult.percentage}%)
                      </div>
                    </div>
                  )}
                  
                  {state.user ? (
                    <button
                      onClick={() => handleVote(candidate.id)}
                      disabled={isUserVote}
                      className={`px-6 py-2 rounded-md font-medium ${
                        isUserVote
                          ? 'bg-blue-600 text-white cursor-default'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                      }`}
                    >
                      {isUserVote ? '投票済み' : 'この候補者に投票'}
                    </button>
                  ) : (
                    <p className="text-sm text-gray-500">投票するにはログインが必要です</p>
                  )}
                </div>
              </div>
              
              {/* Progress Bar */}
              {candidateResult && (
                <div className="mt-4">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${candidateResult.percentage}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Back Button */}
      <div className="mt-8">
        <Link
          to="/elections"
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          ← 選挙一覧に戻る
        </Link>
      </div>
    </div>
  );
};

export default ElectionDetail;
