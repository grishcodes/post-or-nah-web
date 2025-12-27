// Import the functions you need from the SDKs you need
// Firebase initialization and auth helpers
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, Auth, User } from "firebase/auth";

// Your web app's Firebase configuration (read from Vite env)
// Add these to your .env:
// VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
// VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID,
// VITE_FIREBASE_APP_ID, VITE_FIREBASE_MEASUREMENT_ID
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
} as const;

// Validate Firebase config
const requiredFirebaseKeys = ['apiKey', 'authDomain', 'projectId'] as const;
const missingKeys = requiredFirebaseKeys.filter(
  key => !firebaseConfig[key]
);

if (missingKeys.length > 0) {
  console.error('❌ Missing Firebase config keys:', missingKeys.join(', '));
  console.error('Please set environment variables starting with VITE_FIREBASE_');
}

// Initialize Firebase
let app: FirebaseApp;
let analytics: Analytics;
try {
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase initialized successfully');
  
  // Initialize analytics (but don't fail if it doesn't work)
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn('⚠️ Analytics not available (might be blocked by privacy settings)');
    analytics = {} as Analytics;
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  throw error;
}

// Auth exports
const auth: Auth = getAuth(app);

// Configure auth to work better with privacy-restricted environments
auth.settings.appVerificationDisabledForTesting = false;

const provider: GoogleAuthProvider = new GoogleAuthProvider();

/**
 * Launches Google Sign-In using popup (preferred) or redirect as fallback.
 * Popup is used as the primary method to avoid sessionStorage issues in privacy-partitioned environments.
 * Errors are caught and logged; caller can handle the thrown error.
 * 
 * Handles Safari private browsing mode, privacy-restricted regions, and mobile browsers.
 */
async function signInWithGoogle(): Promise<User> {
  try {
    let result;
    
    // Try popup first for all devices (most reliable, avoids sessionStorage issues)
    try {
      result = await signInWithPopup(auth, provider);
    } catch (popupError: any) {
      // If popup is blocked on mobile, fall back to redirect
      if ((popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') && isMobile()) {
        console.log('Popup blocked on mobile, attempting redirect...');
        // Store a marker that we're attempting redirect
        try {
          localStorage.setItem('auth_redirect_attempt', Date.now().toString());
        } catch (e) {
          console.warn('localStorage not available');
        }
        
        await signInWithRedirect(auth, provider);
        // signInWithRedirect will redirect the page, this won't return
        return null as unknown as User;
      }
      throw popupError;
    }
    
    // This gives you a Google Access Token. You can use it to access the Google API.
    // const credential = GoogleAuthProvider.credentialFromResult(result);
    // const token = credential.accessToken;
    if (!result?.user) {
      throw new Error('Sign-in failed: No user returned');
    }
    return result.user;
  } catch (error: any) {
    // Provide user-friendly error messages
    let userMessage = 'Google sign-in failed. Please try again.';
    
    if (error.code === 'auth/popup-blocked') {
      userMessage = 'Sign-in popup was blocked. Please check your browser settings.';
    } else if (error.code === 'auth/popup-closed-by-user') {
      userMessage = 'Sign-in was cancelled. Please try again.';
    } else if (error.code === 'auth/network-request-failed') {
      userMessage = 'Network error. Please check your internet connection and try again.';
    } else if (error.message?.includes('missing initial state')) {
      userMessage = 'Session expired. Please refresh the page and try again.';
    } else if (error.message?.includes('Failed to fetch')) {
      userMessage = 'Connection failed. This might be due to private browsing mode or strict privacy settings. Please try in normal browsing mode.';
    } else if (error.message?.includes('disallowed_useragent')) {
      userMessage = 'Mobile authentication not properly configured. Please check with the app administrator.';
    }
    
    console.error('Google sign-in error:', error);
    const err = new Error(userMessage);
    (err as any).originalError = error;
    throw err;
  }
}

/**
 * Checks if running on a mobile device
 */
function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export { app, auth, provider, analytics, signInWithGoogle };
export type { User };