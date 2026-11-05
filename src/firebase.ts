import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';
import firebaseAppletConfig from '../firebase-applet-config.json';

export const CANONICAL_DATABASE_ID =
  firebaseAppletConfig.firestoreDatabaseId ||
  'ai-studio-gscyouthpitsoapp-cfe0bcb3-77b5-4a4d-b94d-15922db060db';

function getValidConfigValue(envVal: string | undefined, fallbackVal: string): string {
  if (!envVal || envVal.includes('your_') || envVal.trim() === '') {
    return fallbackVal;
  }
  return envVal.trim();
}

function getValidDatabaseId(envVal: string | undefined): string {
  if (
    !envVal ||
    envVal.trim() === '' ||
    envVal.trim().toLowerCase() === 'default' ||
    envVal.trim().toLowerCase() === '(default)' ||
    envVal.trim() === 'undefined' ||
    envVal.includes('your_')
  ) {
    return CANONICAL_DATABASE_ID;
  }
  return envVal.trim();
}

const firebaseConfig = {
  apiKey: getValidConfigValue(import.meta.env.VITE_FIREBASE_API_KEY, firebaseAppletConfig.apiKey),
  authDomain: getValidConfigValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, firebaseAppletConfig.authDomain),
  projectId: getValidConfigValue(import.meta.env.VITE_FIREBASE_PROJECT_ID, firebaseAppletConfig.projectId),
  storageBucket: getValidConfigValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, firebaseAppletConfig.storageBucket),
  messagingSenderId: getValidConfigValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, firebaseAppletConfig.messagingSenderId),
  appId: getValidConfigValue(import.meta.env.VITE_FIREBASE_APP_ID, firebaseAppletConfig.appId),
};

const customDatabaseId = getValidDatabaseId(
  import.meta.env.VITE_FIREBASE_DATABASE_ID || import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID
);

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'your_project_id'
);

let appInstance: FirebaseApp;
let dbInstance: Firestore;
let authInstance: Auth;

if (getApps().length === 0) {
  appInstance = initializeApp(firebaseConfig);
  const settings = { experimentalForceLongPolling: true };
  dbInstance = initializeFirestore(appInstance, settings, customDatabaseId);
} else {
  appInstance = getApps()[0];
  dbInstance = getFirestore(appInstance, customDatabaseId);
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
