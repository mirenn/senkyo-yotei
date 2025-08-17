import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { state, signInWithGoogle, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="text-xl font-bold text-blue-600">
                  選挙予定プラットフォーム
                </Link>
              </div>
              <div className="ml-10 flex items-center space-x-4">
                <Link 
                  to="/elections" 
                  className="text-gray-900 hover:text-blue-600 px-3 py-2 text-sm font-medium"
                >
                  選挙一覧
                </Link>
                {state.user && (
                  <Link 
                    to="/create-election" 
                    className="text-gray-900 hover:text-blue-600 px-3 py-2 text-sm font-medium"
                  >
                    選挙作成
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center">
              {state.user ? (
                <div className="flex items-center space-x-4">
                  <img
                    className="h-8 w-8 rounded-full"
                    src={state.user.photoURL || '/default-avatar.png'}
                    alt={state.user.displayName || 'User'}
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {state.user.displayName}
                  </span>
                  <button
                    onClick={logout}
                    className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                  >
                    ログアウト
                  </button>
                </div>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Googleでログイン
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
