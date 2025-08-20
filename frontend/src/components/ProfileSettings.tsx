import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../firebase/services';

interface ProfileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ isOpen, onClose }) => {
  const { state, refreshUserProfile } = useAuth();
  const [displayName, setDisplayName] = useState(
    state.userProfile?.displayName || state.user?.displayName || ''
  );
  const [showAvatar, setShowAvatar] = useState(
    state.userProfile?.showAvatar ?? false
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!state.user || !state.userProfile) return;

    try {
      setLoading(true);
      setError(null);

      const updatedProfile = {
        ...state.userProfile,
        displayName: displayName.trim() || state.user.displayName || '匿名ユーザー',
        showAvatar,
      };

      await userService.createOrUpdateUser(state.user.uid, updatedProfile);
      await refreshUserProfile(); // Refresh the user profile in context
      setSuccess(true);
      
      // Auto close after success
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Profile update error:', err);
      setError('プロフィールの更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">プロフィール設定</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            プロフィールを更新しました！
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              表示名
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="表示名を入力（空白の場合は「匿名ユーザー」になります）"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
            <p className="mt-1 text-sm text-gray-500">
              コメントや投票で表示される名前です。Googleアカウント名とは別に設定できます。
            </p>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="showAvatar"
              checked={showAvatar}
              onChange={(e) => setShowAvatar(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={loading}
            />
            <label htmlFor="showAvatar" className="ml-2 block text-sm text-gray-700">
              Googleアカウントのプロフィール画像を表示する
            </label>
          </div>
          <p className="text-sm text-gray-500">
            チェックを外すと、デフォルトアバターが使用されます。
          </p>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
            disabled={loading}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;