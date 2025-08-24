import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { electionService, candidateService, voteService, resultsService, dislikeService, userService, commentService } from '../firebase/services';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { type Election, type Candidate, type ElectionResult, type Comment, type User } from '../types';

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
  const [userDislikes, setUserDislikes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  // Helper functions for privacy-aware display
  const getDisplayName = () => {
    if (state.userProfile?.displayName) {
      return state.userProfile.displayName;
    }
    return '匿名ユーザー';
  };

  const getAvatarUrl = () => {
    if (state.userProfile?.showAvatar && state.user?.photoURL) {
      return state.user.photoURL;
    }
    return FALLBACK_AVATAR_DATA_URI; // Always use fallback when privacy mode is on
  };

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
        candidateService.getCandidates(id, userProfile?.isAdmin), // Include inactive candidates only for admins
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
          setUserDislikes(userVotes.elections[id].dislikedCandidates || []);
        } else {
          setUserVote(null);
          setUserDislikes([]);
        }
      }
    } catch (err) {
      console.log('Error refreshing data:', err);
    } finally {
      setRefreshing(false);
    }
  }, [id, state.user, refreshing, userProfile?.isAdmin]);

  // コメント読み込み用の関数
  const loadComments = useCallback(async () => {
    if (!id) return;
    
    try {
      const commentsData = await commentService.getComments(id);
      setComments(commentsData);
    } catch (err) {
      console.log('Error loading comments:', err);
    }
  }, [id]);

  // コメント作成の関数
  const handleCreateComment = async () => {
    if (!id || !state.user || !commentContent.trim()) return;

    try {
      setCommentLoading(true);
      await commentService.createComment(id, {
        userId: state.user.uid,
        userName: getDisplayName(), // Use privacy-aware display name
        userAvatarUrl: state.userProfile?.showAvatar ? (state.user.photoURL || undefined) : undefined, // Only include avatar if user opted in
        content: commentContent.trim(),
      });
      
      setCommentContent('');
      await loadComments(); // コメントを再読み込み
    } catch (err) {
      console.error('Error creating comment:', err);
      setError('コメントの投稿に失敗しました');
    } finally {
      setCommentLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    const fetchElectionData = async () => {
      try {
        setLoading(true);
        setError(null);

        try {
          // First fetch user profile if authenticated to determine admin status
          let userProfileData = null;
          if (state.user) {
            userProfileData = await userService.getUser(state.user.uid);
            setUserProfile(userProfileData);
          }
          
          // Then fetch other data with proper admin status
          const [electionData, candidatesData, resultsData] = await Promise.all([
            electionService.getElection(id),
            candidateService.getCandidates(id, userProfileData?.isAdmin), // Include inactive candidates only for admins
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
                setUserDislikes(userVotes.elections[id].dislikedCandidates || []);
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
            status: 'active',
          };

          const mockCandidates: Candidate[] = [
            {
              id: 'candidate1',
              electionId: id,
              name: '田中太郎',
              description: '経済活性化と教育改革を推進します',
              imageUrl: '/images/candidate1.jpg',
              createdAt: new Date('2024-08-01'),
              status: 'active',
            },
            {
              id: 'candidate2',
              electionId: id,
              name: '佐藤花子',
              description: '福祉の充実と環境保護に取り組みます',
              imageUrl: '/images/candidate2.jpg',
              createdAt: new Date('2024-08-01'),
              status: 'active',
            },
            {
              id: 'candidate3',
              electionId: id,
              name: '鈴木次郎',
              description: 'インフラ整備と地域振興を重視します',
              imageUrl: '/images/candidate3.jpg',
              createdAt: new Date('2024-08-01'),
              status: 'active',
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
            setUserDislikes([]);
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

  // コメントの読み込み
  useEffect(() => {
    if (!id) return;
    loadComments();
  }, [id, loadComments]);

  // electionResults のリアルタイム購読（初回生成含む）
  useEffect(() => {
    if (!id) return;
    const ref = doc(db, 'electionResults', id);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = snap.data();
        setResults({
          electionId: id,
          ...data,
          lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate() : new Date()
        } as ElectionResult);
      }
    });
    return () => unsub();
  }, [id]);

  // ユーザーの投票状況だけを更新する別のuseEffect
  useEffect(() => {
    if (!id || !state.user) return;

    const fetchUserVote = async () => {
      try {
        const userVotes = await voteService.getUserVotes(state.user!.uid);
        if (userVotes?.elections[id]) {
          setUserVote(userVotes.elections[id].candidateId);
          setUserDislikes(userVotes.elections[id].dislikedCandidates || []);
        } else {
          setUserVote(null);
          setUserDislikes([]);
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

  const toggleDislike = async (candidateId: string) => {
    if (!state.user || !election) {
      alert('操作するにはログインが必要です');
      return;
    }
    try {
      await dislikeService.toggleDislike(state.user.uid, election.id, candidateId);
      // ローカル更新
      setUserDislikes(prev => prev.includes(candidateId) ? prev.filter(id => id !== candidateId) : [...prev, candidateId]);
    } catch (e) {
      console.log('Firestore not available, mock dislike toggle', e);
      setUserDislikes(prev => prev.includes(candidateId) ? prev.filter(id => id !== candidateId) : [...prev, candidateId]);
    }
  };

  // Admin functions
  const handleToggleElectionStatus = async () => {
    if (!election || !userProfile?.isAdmin) return;

    setAdminActionLoading(true);
    try {
      const newStatus = election.status === 'active' ? 'inactive' : 'active';
      await electionService.updateElection(election.id, { status: newStatus });
      
      setElection(prev => prev ? { ...prev, status: newStatus } : null);
      alert(`選挙を${newStatus === 'active' ? '有効' : '無効'}にしました`);
    } catch (error) {
      console.error('Error toggling election status:', error);
      alert('ステータスの変更に失敗しました');
    } finally {
      setAdminActionLoading(false);
    }
  };

  // Check if user can edit this election (creator or admin)
  const canEdit = election && state.user && (election.createdBy === state.user.uid || userProfile?.isAdmin);

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
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span>投票期間: {election.startDate.toLocaleDateString()} - {election.endDate.toLocaleDateString()}</span>
          <span>総投票数: {results?.totalVotes || 0}票</span>
          <span>不支持マーク総数: {results?.totalDislikeMarks ?? 0}</span>
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

      {/* Admin Controls */}
      {canEdit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {userProfile?.isAdmin ? '管理者操作' : '作成者操作'}
          </h2>
          <div className="flex flex-wrap gap-4">
            <Link
              to={`/elections/${election.id}/edit`}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              ✏️ 選挙を編集
            </Link>
            
            {userProfile?.isAdmin && (
              <button
                onClick={handleToggleElectionStatus}
                disabled={adminActionLoading}
                className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 ${
                  election.status === 'active'
                    ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                    : 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                } disabled:opacity-50`}
              >
                {adminActionLoading ? '処理中...' : 
                 election.status === 'active' ? '🚫 選挙を無効化' : '✅ 選挙を有効化'}
              </button>
            )}
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              election.status === 'active' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              ステータス: {election.status === 'active' ? '有効' : '無効'}
            </span>
            {userProfile?.isAdmin && (
              <span className="ml-4 text-blue-600">管理者権限で表示中</span>
            )}
          </div>
        </div>
      )}

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
          const isDisliked = userDislikes.includes(candidate.id);
          
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
                    <div className="flex items-center space-x-3">
                      <h3 className="text-xl font-bold text-gray-900">{candidate.name}</h3>
                      {candidate.status === 'inactive' && (
                        <span className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded-full">
                          非アクティブ
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mt-2">{candidate.description}</p>
                  </div>
                </div>
                
                <div className="text-right space-y-2">
                  {/* 常に得票数を表示（投票期間中でも表示） */}
                  {candidateResult && shouldShowResults() && (
                    <div className="mb-3">
                      <div className="text-2xl font-bold text-gray-900">
                        {candidateResult.count}票
                      </div>
                      <div className="text-lg text-gray-600">
                        ({candidateResult.percentage}%)
                      </div>
                      {candidateResult.dislikeCount !== undefined && (
                        <div className="text-sm text-red-600 mt-1">
                          不支持 {candidateResult.dislikeCount}件{candidateResult.dislikePercentage !== undefined && ` (${candidateResult.dislikePercentage}%)`}
                        </div>
                      )}
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
                    <div className="flex flex-col items-end gap-2">
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
                      <label className="flex items-center text-xs text-red-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isDisliked}
                          onChange={() => toggleDislike(candidate.id)}
                          disabled={isUserVote}
                          className={`mr-1 h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500 ${isUserVote ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <span title={isUserVote ? '投票済み候補は不支持にできません' : ''}>この候補者には投票したくない</span>
                      </label>
                    </div>
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

      {/* Comments Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">コメント</h2>
        
        {/* Comment Form */}
        {state.user ? (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <div className="flex items-start space-x-4">
              <img
                src={getAvatarUrl()}
                alt={getDisplayName()}
                className="w-10 h-10 rounded-full"
                onError={(e) => {
                  if (e.currentTarget.src !== FALLBACK_AVATAR_DATA_URI) {
                    e.currentTarget.src = FALLBACK_AVATAR_DATA_URI;
                    e.currentTarget.onerror = null;
                  }
                }}
              />
              <div className="flex-1">
                <textarea
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder="この選挙についてコメントを書く..."
                  className="w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  disabled={commentLoading}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleCreateComment}
                    disabled={commentLoading || !commentContent.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {commentLoading ? 'コメント投稿中...' : 'コメントする'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8 bg-gray-50 rounded-lg p-6 text-center">
            <p className="text-gray-600">コメントを投稿するにはログインが必要です</p>
          </div>
        )}

        {/* Comments List */}
        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              まだコメントがありません
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start space-x-4">
                  <img
                    src={comment.userAvatarUrl || FALLBACK_AVATAR_DATA_URI}
                    alt={comment.userName}
                    className="w-10 h-10 rounded-full"
                    onError={(e) => {
                      if (e.currentTarget.src !== FALLBACK_AVATAR_DATA_URI) {
                        e.currentTarget.src = FALLBACK_AVATAR_DATA_URI;
                        e.currentTarget.onerror = null;
                      }
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium text-gray-900">{comment.userName}</h4>
                      <span className="text-sm text-gray-500">
                        {comment.createdAt.toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
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
