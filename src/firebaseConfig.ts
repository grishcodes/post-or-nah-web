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
 * Detects if we're in a storage-partitioned environment
 * (e.g., Instagram's in-app browser, Safari private mode, strict privacy settings)
 */
function isStoragePartitioned(): boolean {
  // Test if we can actually write to and read from sessionStorage
  try {
    const testKey = '__test_storage_' + Date.now();
    sessionStorage.setItem(testKey, 'test');
    const value = sessionStorage.getItem(testKey);
    sessionStorage.removeItem(testKey);
    
    // If we got here without exception, storage works
    return false;
  } catch (e) {
    // Storage is partitioned or unavailable
    console.warn('⚠️ Storage is partitioned or unavailable');
    return true;
  }
}

/**
 * Detects if we're in Instagram's in-app browser
 */
function isInstagramBrowser(): boolean {
  const ua = navigator.userAgent;
  return /Instagram/.test(ua);
}

/**
 * Launches Google Sign-In using popup (preferred), server-side redirect (for storage-partitioned),
 * or client-side redirect as fallback.
 * 
 * Handles Safari private browsing mode, privacy-restricted regions, Instagram's in-app browser,
 * and mobile browsers.
 */
async function signInWithGoogle(): Promise<User> {
  try {
    let result;
    
    // Try popup first for all devices (most reliable, avoids sessionStorage issues)
    try {
      result = await signInWithPopup(auth, provider);
    } catch (popupError: any) {
      const inStoragePartitioned = isStoragePartitioned();
      const inInstagram = isInstagramBrowser();
      
      console.log(`[Auth] Popup failed. Storage partitioned: ${inStoragePartitioned}, Instagram: ${inInstagram}`);
      
      // If popup is blocked AND we're NOT in a storage-partitioned environment,
      // try client-side redirect
      if ((popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') && 
          isMobile() && 
          !inStoragePartitioned) {
        console.log('[Auth] Popup blocked on mobile, attempting client-side redirect...');
        await signInWithRedirect(auth, provider);
        return null as unknown as User;
      }
      
      // If we're in a storage-partitioned environment, use server-side OAuth flow
      if (inStoragePartitioned || inInstagram) {
        console.log('[Auth] Storage partitioned detected, using server-side OAuth flow...');
        try {
          const user = await signInWithServerSideOAuth();
          if (user) return user;
        } catch (serverOAuthError) {
          console.warn('[Auth] Server-side OAuth failed:', serverOAuthError);
          // Fall through to show helpful error
        }
      }
      
      // Show helpful error if all methods failed
      if (inStoragePartitioned || inInstagram) {
        const err = new Error(
          inInstagram 
            ? 'Instagram\'s browser has restrictions. Please open this link in Chrome, Safari, or Firefox instead.'
            : 'Your browser has storage restrictions. Please try in a standard browser or disable private browsing mode.'
        );
        (err as any).originalError = popupError;
        (err as any).code = 'auth/storage-partitioned';
        throw err;
      }
      
      throw popupError;
    }
    
    if (!result?.user) {
      throw new Error('Sign-in failed: No user returned');
    }
    return result.user;
  } catch (error: any) {
    // Provide user-friendly error messages
    let userMessage = 'Google sign-in failed. Please try again.';
    
    if (error.code === 'auth/storage-partitioned') {
      userMessage = error.message;
    } else if (error.code === 'auth/popup-blocked') {
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
    
    console.error('[Auth] Google sign-in error:', error);
    const err = new Error(userMessage);
    (err as any).originalError = error;
    throw err;
  }
}

/**
 * Server-side OAuth flow for storage-partitioned environments
 * Works in Instagram's in-app browser, Safari private mode, etc.
 */
async function signInWithServerSideOAuth(): Promise<User | null> {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
    
    // Step 1: Initialize OAuth flow on server
    console.log('[ServerOAuth] Initializing OAuth flow...');
    const initResponse = await fetch(`${backendUrl}/api/oauth/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!initResponse.ok) {
      throw new Error('Failed to initialize OAuth');
    }
    
    const { authUrl, state } = await initResponse.json();
    
    // Step 2: Redirect to Google (will work even in storage-partitioned environments)
    // Store state in URL params or memory for callback
    sessionStorage.setItem('oauth_state_pending', state);
    window.location.href = authUrl;
    
    // This won't return as we're redirecting
    return null;
  } catch (error) {
    console.error('[ServerOAuth] Error:', error);
    throw error;
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