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
export const db = getFirestore(app);

// Connect to emulators if in development mode
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
let emulatorsConnected = false;

if (useEmulator && !emulatorsConnected) {
  console.log('Using Firebase Emulators');
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    emulatorsConnected = true;
    console.log('Connected to Firebase Emulators');
  } catch (error: any) {
    if (error?.message?.includes('already') || error?.code === 'auth/emulator-config-failed') {
      console.log('Emulators already connected or connection failed (likely already connected)');
      emulatorsConnected = true;
    } else {
      console.warn('Failed to connect to emulators:', error);
    }
  }
} else if (!useEmulator) {
  console.log('Using production Firebase');
}

console.log('Firestore instance created:', db);
console.log('Auth instance created:', auth);

export default app;
