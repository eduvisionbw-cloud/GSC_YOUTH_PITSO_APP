import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseAppletConfig from '../firebase-applet-config.json';

export const REQUIRED_FIREBASE_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
] as const;

// Resolve Firebase configuration with fallback to firebase-applet-config.json
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain || '',
  databaseURL: (firebaseAppletConfig as any).databaseURL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId || '',
  measurementId: firebaseAppletConfig.measurementId || '',
};

const rawDatabaseId = 
  import.meta.env.VITE_FIREBASE_DATABASE_ID || 
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
  firebaseAppletConfig.firestoreDatabaseId;

const customDatabaseId = 
  rawDatabaseId && rawDatabaseId !== '(default)'
    ? rawDatabaseId
    : undefined;

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Audit missing configuration if any
export const missingFirebaseEnvVars: string[] = isFirebaseConfigured
  ? []
  : REQUIRED_FIREBASE_ENV_VARS.filter(
      (key) => !import.meta.env[key] || String(import.meta.env[key]).trim() === ''
    );

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

if (isFirebaseConfigured) {
  if (getApps().length === 0) {
    appInstance = initializeApp(firebaseConfig);
    const firestoreSettings = {
      experimentalForceLongPolling: true,
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

  if (import.meta.env.DEV) {
    console.log('Firebase initialized with project:', firebaseConfig.projectId);
  }

  // Validate connection to Firestore on initial boot
  if (dbInstance) {
    getDocFromServer(doc(dbInstance, 'test', 'connection')).catch((error) => {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn('Firestore offline / check connection:', error.message);
      }
    });
  }
}

export const app = appInstance as FirebaseApp;
export const db = dbInstance as Firestore;
export const auth = authInstance as Auth;

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;
export type OperationType = (typeof OperationType)[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: authInstance?.currentUser?.uid,
      email: authInstance?.currentUser?.email,
      emailVerified: authInstance?.currentUser?.emailVerified,
      isAnonymous: authInstance?.currentUser?.isAnonymous,
      tenantId: authInstance?.currentUser?.tenantId,
      providerInfo: authInstance?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
  const normalized = email.trim().toLowerCase();
  const defaultAdmins = ['gsetlamelo@gmail.com', 'quintonbileon@gmail.com'];
  if (defaultAdmins.includes(normalized)) {
    return true;
  }
  const adminEmails = getAdminEmails();
  return adminEmails.includes(normalized);
}
