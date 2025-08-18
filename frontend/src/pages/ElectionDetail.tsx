import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { electionService, candidateService, voteService, resultsService } from '../firebase/services';
import { type Election, type Candidate, type ElectionResult } from '../types';

// ネットワークリクエストが大量発生していた default-avatar.png の無限 onError ループ対策:
// 以前は onError 内で相対パス '/images/default-avatar.png' を再代入していたため、
// ブラウザ側では絶対URLに解決された src と文字列比較が常に不一致 -> 毎回再設定 -> 失敗再発火 のループになっていた。
// 対策としてネットワークアクセス不要のインライン SVG を 1 度だけ設定し、onerror を解除する。
const FALLBACK_AVATAR_DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNjQiIGN5PSI2NCIgcj0iNjQiIGZpbGw9IiNFMEYyRjQiIC8+PGNpcmNsZSBjeD0iNjQiIGN5PSI0OCIgcj0iMjQiIGZpbGw9IiNGRkYiIC8+PHBhdGggZD0iTTY0IDc2Yy0yNi4zMSAwLTQ4IDEzLjA5LTQ4IDI5LjI5VDEyOC4wMDEgMTA1LjI5QzEyOCA4OS4wOSA5MC4zMSA3NiA2NCA3NnoiIGZpbGw9IiNGRkYiIGZpbGwtb3BhY2l0eT0iMC43IiAvPjwvc3ZnPg==';

const ElectionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { state } = useAuth();
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [results, setResults] = useState<ElectionResult | null>(null);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 投票期間チェック（得票数表示用）
  const isVotingPeriod = (election: Election) => {
    const now = new Date();
    return now >= election.startDate && now <= election.endDate;
  };

  // 常に得票数を表示する（投票期間中でも結果を表示）
  const shouldShowResults = () => {
    return true; // 常に得票数を表示
  };

  // データ更新用の関数（メモ化して不要な再作成を防ぐ）
  const refreshData = useCallback(async () => {
    if (!id || refreshing) return;

    try {
      setRefreshing(true);
      const [candidatesData, resultsData] = await Promise.all([
        candidateService.getCandidates(id),
        resultsService.getElectionResults(id)
      ]);

      console.log('🔄 [REFRESH] Refreshed election data:', { 
        electionId: id,
        candidatesCount: candidatesData.length,
        candidates: candidatesData, 
        results: resultsData,
        resultsIsNull: resultsData === null,
        totalVotes: resultsData?.totalVotes,
        candidateResults: resultsData?.candidates,
        timestamp: new Date().toISOString()
      });

      setCandidates(candidatesData);
      setResults(resultsData);

      // ユーザーの投票も更新（ユーザーがログインしている場合のみ）
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
    } finally {
      setRefreshing(false);
    }
  }, [id, state.user, refreshing]);

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
            console.log('📥 [FIRESTORE] Successfully fetched from Firestore:', { 
              electionId: id,
              electionTitle: electionData.title,
              candidatesCount: candidatesData.length,
              election: electionData, 
              candidates: candidatesData, 
              results: resultsData,
              resultsIsNull: resultsData === null,
              totalVotes: resultsData?.totalVotes,
              candidateResults: resultsData?.candidates,
              timestamp: new Date().toISOString()
            });
            
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
          console.log('⚠️ [FIRESTORE] Firestore not available, using mock data:', firestoreError);
          console.log('🎭 [MOCK] Generating mock data for electionId:', id);
          
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

          console.log('🎭 [MOCK] Using mock data:', { 
            electionId: id,
            electionTitle: mockElection.title,
            candidatesCount: mockCandidates.length,
            election: mockElection, 
            candidates: mockCandidates, 
            results: mockResults,
            timestamp: new Date().toISOString()
          });

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
  }, [id]); // state.userを依存配列から除去して不要な再実行を防ぐ

  // ユーザーの投票状況だけを更新する別のuseEffect
  useEffect(() => {
    if (!id || !state.user) return;

    const fetchUserVote = async () => {
      try {
        const userVotes = await voteService.getUserVotes(state.user!.uid);
        if (userVotes?.elections[id]) {
          setUserVote(userVotes.elections[id].candidateId);
        } else {
          setUserVote(null);
        }
      } catch (err) {
        console.log('Error fetching user vote:', err);
      }
    };

    fetchUserVote();
  }, [id, state.user]);

  const handleVote = async (candidateId: string) => {
    if (!state.user || !election) {
      alert('投票するにはログインが必要です');
      return;
    }

    try {
      await voteService.submitVote(state.user.uid, election.id, candidateId);
      setUserVote(candidateId);
      // 投票後に最新の結果データを取得して表示を更新
      await refreshData();
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
      // 投票取り消し後に最新の結果データを取得して表示を更新
      await refreshData();
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
            disabled={refreshing}
            className={`px-3 py-2 text-sm rounded-md transition-colors ${
              refreshing
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            title="最新データを取得"
          >
            {refreshing ? '更新中...' : '🔄 更新'}
          </button>
        </div>
        <p className="text-gray-600 mb-4">{election.description}</p>
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <span>投票期間: {election.startDate.toLocaleDateString()} - {election.endDate.toLocaleDateString()}</span>
          <span>総投票数: {results?.totalVotes || 0}票</span>
          {election && (
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              isVotingPeriod(election) 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {isVotingPeriod(election) ? '投票受付中' : '投票終了'}
            </span>
          )}
        </div>
      </div>

  {/* 個別候補ボタン内で取消可能にするため、専用の投票取消ボックスは削除 */}

      {/* Candidates List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">候補者一覧</h2>
          <div className="text-sm text-gray-600">
            ※ 投票期間中でもリアルタイムで得票数を表示しています
          </div>
        </div>
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
                    src={candidate.imageUrl || FALLBACK_AVATAR_DATA_URI}
                    alt={candidate.name}
                    className="w-16 h-16 rounded-full object-cover bg-gray-300"
                    onError={(e) => {
                      const img = e.currentTarget;
                      // 2回目以降発火させない
                      img.onerror = null;
                      img.src = FALLBACK_AVATAR_DATA_URI;
                    }}
                  />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{candidate.name}</h3>
                    <p className="text-gray-600 mt-2">{candidate.description}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  {/* 常に得票数を表示（投票期間中でも表示） */}
                  {candidateResult && shouldShowResults() && (
                    <div className="mb-3">
                      <div className="text-2xl font-bold text-gray-900">
                        {candidateResult.count}票
                      </div>
                      <div className="text-lg text-gray-600">
                        ({candidateResult.percentage}%)
                      </div>
                    </div>
                  )}
                  {(!candidateResult || !shouldShowResults()) && (
                    <div className="mb-3">
                      <div className="text-2xl font-bold text-gray-500">
                        0票
                      </div>
                      <div className="text-lg text-gray-500">
                        (0%)
                      </div>
                    </div>
                  )}
                  
                  {state.user ? (
                    <button
                      onClick={() => (isUserVote ? handleCancelVote() : handleVote(candidate.id))}
                      className={`px-6 py-2 rounded-md font-medium transition-colors ${
                        isUserVote
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                      }`}
                      title={isUserVote ? 'クリックでこの投票を取り消します' : 'この候補者に投票します'}
                    >
                      {isUserVote ? '投票済み' : 'この候補者に投票'}
                    </button>
                  ) : (
                    <p className="text-sm text-gray-500">投票するにはログインが必要です</p>
                  )}
                </div>
              </div>
              
              {/* Progress Bar - 常に表示（得票データがない場合は0%で表示） */}
              <div className="mt-4">
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${candidateResult?.percentage || 0}%` }}
                  ></div>
                </div>
              </div>
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
