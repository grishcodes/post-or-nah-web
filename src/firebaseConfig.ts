// Import the functions you need from the SDKs you need
// Firebase initialization and auth helpers
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, Auth, User } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDasbLVdC5rWXTPTrO3kk2Wdh5G4r7vQdk",
  authDomain: "post-or-nah.firebaseapp.com",
  projectId: "post-or-nah",
  storageBucket: "post-or-nah.firebasestorage.app",
  messagingSenderId: "754222877889",
  appId: "1:754222877889:web:7de6390af2b9cdd39bd840",
  measurementId: "G-NVRXBR7CRK"
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);
const analytics: Analytics = getAnalytics(app);

// Auth exports
const auth: Auth = getAuth(app);
const provider: GoogleAuthProvider = new GoogleAuthProvider();

/**
 * Launches a Google Sign-In popup and returns the signed-in user.
 * Errors are caught and logged; caller can handle the thrown error.
 */
async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, provider);
    // This gives you a Google Access Token. You can use it to access the Google API.
    // const credential = GoogleAuthProvider.credentialFromResult(result);
    // const token = credential.accessToken;
    return result.user;
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
}

export { auth, provider, signInWithGoogle };
export type { User };