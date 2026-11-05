import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';
import firebaseAppletConfig from '../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId || '',
};

const customDatabaseId = 
  import.meta.env.VITE_FIREBASE_DATABASE_ID || 
  firebaseAppletConfig.firestoreDatabaseId;

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let appInstance: FirebaseApp;
let dbInstance: Firestore;
let authInstance: Auth;

if (getApps().length === 0) {
  appInstance = initializeApp(firebaseConfig);
  const settings = { experimentalForceLongPolling: true };
  dbInstance = customDatabaseId && customDatabaseId !== '(default)'
    ? initializeFirestore(appInstance, settings, customDatabaseId)
    : initializeFirestore(appInstance, settings);
} else {
  appInstance = getApps()[0];
  dbInstance = customDatabaseId && customDatabaseId !== '(default)'
    ? getFirestore(appInstance, customDatabaseId)
    : getFirestore(appInstance);
}

authInstance = getAuth(appInstance);

export const app = appInstance;
export const db = dbInstance;
export const auth = authInstance;

export function mapFirebaseAuthError(err: any): string {
  const code = err?.code || '';
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Access temporarily restricted. Please try again later.';
    case 'auth/popup-blocked':
      return 'Sign-in pop-up was blocked. Redirecting...';
    case 'auth/popup-closed-by-user':
      return 'Sign-in window was closed.';
    default:
      return err?.message || 'Authentication failed. Please try again.';
  }
}
