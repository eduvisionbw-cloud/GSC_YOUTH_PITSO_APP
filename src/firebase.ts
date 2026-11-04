import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';

export const REQUIRED_FIREBASE_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
] as const;

// Audit environment configuration for missing variables
export const missingFirebaseEnvVars: string[] = REQUIRED_FIREBASE_ENV_VARS.filter(
  (key) => !import.meta.env[key] || String(import.meta.env[key]).trim() === ''
);

export const isFirebaseConfigured = missingFirebaseEnvVars.length === 0;

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const customDatabaseId = 
    import.meta.env.VITE_FIREBASE_DATABASE_ID || 
    import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;

  if (getApps().length === 0) {
    appInstance = initializeApp(firebaseConfig);
    const firestoreSettings = {
      experimentalAutoDetectLongPolling: true,
    };
    dbInstance = customDatabaseId 
      ? initializeFirestore(appInstance, firestoreSettings, customDatabaseId)
      : initializeFirestore(appInstance, firestoreSettings);
  } else {
    appInstance = getApps()[0];
    dbInstance = customDatabaseId 
      ? getFirestore(appInstance, customDatabaseId) 
      : getFirestore(appInstance);
  }

  authInstance = getAuth(appInstance);

  // In development mode only, log the active projectId
  if (import.meta.env.DEV) {
    console.log('Firebase initialized with project:', import.meta.env.VITE_FIREBASE_PROJECT_ID);
  }
}

export const app = appInstance as FirebaseApp;
export const db = dbInstance as Firestore;
export const auth = authInstance as Auth;

/**
 * Maps Firebase Auth error codes to user-friendly messages.
 * Never exposes raw internal Firebase error traces to users.
 */
export function mapFirebaseAuthError(err: any): string {
  const code = err?.code || '';
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Google sign-in is currently unavailable. Please contact the administrator.';
    case 'auth/invalid-credential':
      return 'Sign-in failed. Please verify your credentials and try again.';
    case 'auth/user-not-found':
      return 'Administrator account not found.';
    case 'auth/wrong-password':
      return 'Incorrect credentials.';
    case 'auth/too-many-requests':
      return 'Access temporarily restricted. Please wait a few moments before trying again.';
    case 'auth/unauthorized-domain':
      return 'Unable to sign in. This web domain is not authorized for authentication.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in window was closed.';
    case 'auth/popup-blocked':
      return 'Sign-in pop-up was blocked. Redirecting to sign in...';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection.';
    default:
      if (err?.message && !err.message.includes('Firebase:') && !err.message.includes('auth/')) {
        return err.message;
      }
      return 'Authentication could not be completed. Please try again.';
  }
}

/**
 * Parse authorized admin emails from VITE_ADMIN_EMAILS (comma-separated).
 */
export function getAdminEmails(): string[] {
  const raw = import.meta.env.VITE_ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Check if the given email is on the authorized administrator whitelist.
 */
export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const adminEmails = getAdminEmails();
  // If no admin emails are configured in environment, allow primary admin fallback
  if (adminEmails.length === 0) {
    return email.toLowerCase() === 'quintonbileon@gmail.com';
  }
  return adminEmails.includes(email.toLowerCase());
}
