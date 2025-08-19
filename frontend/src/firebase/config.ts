import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

console.log('Firebase config:', {
  apiKey: firebaseConfig.apiKey ? '***' : 'missing',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId ? '***' : 'missing'
});

const app = initializeApp(firebaseConfig);
console.log('Firebase app initialized:', app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// Google認証の設定を追加
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
export const db = getFirestore(app);

// Connect to emulators if in development mode
const useFirestoreEmulator = import.meta.env.VITE_USE_FIRESTORE_EMULATOR === 'true';
const useAuthEmulator = import.meta.env.VITE_USE_AUTH_EMULATOR === 'true';
const isDevelopment = import.meta.env.DEV;
let emulatorsConnected = false;

console.log('Environment variables:', {
  VITE_USE_FIRESTORE_EMULATOR: import.meta.env.VITE_USE_FIRESTORE_EMULATOR,
  VITE_USE_AUTH_EMULATOR: import.meta.env.VITE_USE_AUTH_EMULATOR,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
  useFirestoreEmulator: useFirestoreEmulator,
  useAuthEmulator: useAuthEmulator,
  isDevelopment: isDevelopment
});

// Only connect to emulators in development mode AND if explicitly enabled
if ((useFirestoreEmulator || useAuthEmulator) && isDevelopment && !emulatorsConnected) {
  console.log('Connecting to Firebase Emulators...');
  try {
    if (useAuthEmulator) {
      console.log('Connecting to Auth Emulator...');
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    } else {
      console.log('Using production Firebase Auth - Real Google Authentication enabled');
    }
    
    if (useFirestoreEmulator) {
      console.log('Connecting to Firestore Emulator...');
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    } else {
      console.log('Using production Firestore');
    }
    
    emulatorsConnected = true;
    console.log('Emulator connections completed');
  } catch (error: any) {
    if (error?.message?.includes('already') || error?.code === 'auth/emulator-config-failed') {
      console.log('Emulators already connected or connection failed (likely already connected)');
      emulatorsConnected = true;
    } else {
      console.warn('Failed to connect to emulators:', error);
    }
  }
} else {
  console.log('Using production Firebase services');
}

console.log('Firestore instance created:', db);
console.log('Auth instance created:', auth);

export default app;
