import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { electionService, userService } from '../firebase/services';
import { type Election } from '../types';

const Elections = () => {
  const { state } = useAuth();
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    const fetchElections = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load user profile if authenticated
        let isAdmin = false;
        if (state.user) {
          const userProfileData = await userService.getUser(state.user.uid);
          setUserProfile(userProfileData);
          isAdmin = userProfileData?.isAdmin || false;
        }
        
        // Try to fetch from Firestore
        const electionsData = await electionService.getElections(isAdmin && showInactive);
        
        if (electionsData.length === 0) {
          // If no data in Firestore, use mock data
          const mockElections: Election[] = [
            {
              id: '1',
              title: '市長選挙 2024',
              description: '市長選挙の投票予定を登録してください',
              startDate: new Date('2024-09-01'),
              endDate: new Date('2024-09-15'),
              createdBy: 'user1',
              createdAt: new Date('2024-08-01'),
              updatedAt: new Date('2024-08-01'),
              status: 'active',
            },
            {
              id: '2',
              title: '県知事選挙 2024',
              description: '県知事選挙の投票予定を登録してください',
              startDate: new Date('2024-10-01'),
              endDate: new Date('2024-10-15'),
              createdBy: 'user2',
              createdAt: new Date('2024-08-10'),
              updatedAt: new Date('2024-08-10'),
              status: 'active',
            },
          ];
          setElections(mockElections);
        } else {
          setElections(electionsData);
        }
      } catch (err) {
        console.error('Error fetching elections:', err);
        setError('選挙データの取得に失敗しました');
        
        // Fall back to mock data on error
        const mockElections: Election[] = [
          {
            id: '1',
            title: '市長選挙 2024',
            description: '市長選挙の投票予定を登録してください',
            startDate: new Date('2024-09-01'),
            endDate: new Date('2024-09-15'),
            createdBy: 'user1',
            createdAt: new Date('2024-08-01'),
            updatedAt: new Date('2024-08-01'),
            status: 'active',
          },
          {
            id: '2',
            title: '県知事選挙 2024',
            description: '県知事選挙の投票予定を登録してください',
            startDate: new Date('2024-10-01'),
            endDate: new Date('2024-10-15'),
            createdBy: 'user2',
            createdAt: new Date('2024-08-10'),
            updatedAt: new Date('2024-08-10'),
            status: 'active',
          },
        ];
        setElections(mockElections);
      } finally {
        setLoading(false);
      }
    };

    fetchElections();
  }, [state.user, showInactive]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">選挙一覧</h1>
        <div className="flex space-x-3">
          {userProfile?.isAdmin && (
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md ${
                showInactive
                  ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              {showInactive ? '🟢 有効のみ表示' : '🔴 無効も表示'}
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            title="最新データを取得"
          >
            🔄 更新
          </button>
          <Link
            to="/create-election"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            新しい選挙を作成
          </Link>
        </div>
      </div>

      {elections.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">現在、選挙が登録されていません。</p>
          <Link
            to="/create-election"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            最初の選挙を作成
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {elections.map((election) => (
            <div
              key={election.id}
              className={`bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow ${
                election.status === 'inactive' ? 'opacity-60 border-2 border-red-200' : ''
              }`}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-medium text-gray-900">
                    {election.title}
                  </h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    election.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {election.status === 'active' ? '有効' : '無効'}
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  {election.description}
                </p>
                <div className="text-xs text-gray-500 mb-4">
                  <p>開始: {election.startDate.toLocaleDateString('ja-JP')}</p>
                  <p>終了: {election.endDate.toLocaleDateString('ja-JP')}</p>
                </div>
                <div className="flex space-x-2">
                  <Link
                    to={`/elections/${election.id}`}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    詳細を見る
                  </Link>
                  {(election.createdBy === state.user?.uid || userProfile?.isAdmin) && (
                    <Link
                      to={`/elections/${election.id}/edit`}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      編集
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Elections;
