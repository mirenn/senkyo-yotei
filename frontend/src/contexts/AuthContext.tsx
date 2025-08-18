import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { type User as FirebaseUser, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import { userService } from '../firebase/services';
import { type User } from '../types';

interface AuthState {
  user: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  error: string | null;
}

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: FirebaseUser | null }
  | { type: 'SET_USER_PROFILE'; payload: User | null }
  | { type: 'SET_ERROR'; payload: string | null };

const initialState: AuthState = {
  user: null,
  userProfile: null,
  loading: true,
  error: null,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload, loading: false };
    case 'SET_USER_PROFILE':
      return { ...state, userProfile: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    default:
      return state;
  }
};

interface AuthContextType {
  state: AuthState;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user);
      dispatch({ type: 'SET_USER', payload: user });
      
      if (user) {
        console.log('User is authenticated:', {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        });
        
        try {
          console.log('Attempting to fetch user profile from Firestore...');
          // Try to fetch or create user profile in Firestore
          let userProfile = await userService.getUser(user.uid);
          console.log('Fetched user profile:', userProfile);
          
          if (!userProfile) {
            console.log('User profile not found, creating new one...');
            // Create new user profile
            const newUserData = {
              email: user.email || '',
              name: user.displayName || '',
              avatarUrl: user.photoURL || '',
              createdAt: new Date(),
              lastLogin: new Date(),
            };
            
            console.log('Creating user profile with data:', newUserData);
            await userService.createOrUpdateUser(user.uid, newUserData);
            console.log('User profile created successfully');
            
            userProfile = {
              id: user.uid,
              ...newUserData,
            };
          } else {
            console.log('Updating existing user profile with last login...');
            // Update last login
            const updateData = {
              ...userProfile,
              lastLogin: new Date(),
            };
            await userService.createOrUpdateUser(user.uid, updateData);
            userProfile.lastLogin = new Date();
            console.log('User profile updated successfully');
          }
          
          dispatch({ type: 'SET_USER_PROFILE', payload: userProfile });
          console.log('User profile set in context:', userProfile);
        } catch (error: any) {
          console.error('Error handling user profile:', error);
          console.error('Error type:', typeof error);
          console.error('Error code:', error?.code);
          console.error('Error message:', error?.message);
          console.error('Error stack:', error?.stack);
          
          console.log('Firestore not available for user profile, using mock data');
          // Create a mock user profile when Firestore is not available
          const mockUserProfile: User = {
            id: user.uid,
            email: user.email || '',
            name: user.displayName || '',
            avatarUrl: user.photoURL || '',
            createdAt: new Date(),
            lastLogin: new Date(),
          };
          dispatch({ type: 'SET_USER_PROFILE', payload: mockUserProfile });
          console.log('Mock user profile set:', mockUserProfile);
        }
      } else {
        console.log('User is not authenticated, clearing profile');
        dispatch({ type: 'SET_USER_PROFILE', payload: null });
      }
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      dispatch({ type: 'SET_USER_PROFILE', payload: null });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
    }
  };

  const value = {
    state,
    signInWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
