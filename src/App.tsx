import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SplashScreen } from './components/SplashScreen';
import { UploadScreen } from './components/UploadScreen';
import { ResultScreen } from './components/ResultScreen';
// import {pricingplan} from './components/PricingPlan';
import { SubscriptionScreen } from './components/SubscriptionScreen';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { useUserSubscription } from './hooks/useUserSubscription';
import { SafariCompat } from './lib/safariCompat';

type Screen = 'splash' | 'upload' | 'result' | 'subscription' | 'login';

interface PhotoData {
  file: File | string;
  vibes: string[];
  verdict?: string | null;
  suggestion?: string | null;
}

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [currentPhoto, setCurrentPhoto] = useState<PhotoData | null>(null);
  
  // Use the new backend-powered subscription hook
  const { checksUsed, isPremium, creditsBalance, loading, incrementCheck, updatePremium, refetch } = useUserSubscription(user);

  // Initialize Safari compatibility on mount
  useEffect(() => {
    // Apply Safari-specific fixes
    SafariCompat.applyWebkitFixes();
    SafariCompat.fixViewport();
    
    // Log browser info for debugging
    const browserInfo = SafariCompat.getBrowserInfo();
    if (browserInfo.isSafari) {
      console.log('🔍 Safari detected:', browserInfo.version);
    }
  }, []);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      // if logged out, show login screen
      if (!u) {
        setCurrentScreen('splash');
      } else {
        // when user signs in, move to upload screen
        setCurrentScreen('upload');
      }
    });
    return () => unsub();
  }, []);

  // Refetch subscription data when returning from payment (e.g., after Stripe checkout)
  useEffect(() => {
    if (user && currentScreen === 'upload') {
      // Slight delay to allow webhook to process
      const timer = setTimeout(() => {
        refetch?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, currentScreen, refetch]);

  const handleSplashComplete = () => {
    setCurrentScreen('upload');
  };

  const handlePhotoUpload = async (photo: File | string, vibes: string[], verdict?: string | null, suggestion?: string | null) => {
    // Check if user has reached free limit and isn't premium
    if (checksUsed >= 3 && !isPremium && creditsBalance === 0) {
      setCurrentScreen('subscription');
      return;
    }

    setCurrentPhoto({ file: photo, vibes, verdict: verdict ?? null, suggestion: suggestion ?? null });
    
    // Increment check count on backend
    await incrementCheck();
    
    setCurrentScreen('result');
  };

  const handleTryAnother = () => {
    setCurrentPhoto(null);
    setCurrentScreen('upload');
  };

  const handleUpgrade = () => {
    if (!user) {
      alert('You must be signed in to upgrade. Please sign in with Google first.');
      return;
    }

    // Show subscription screen with credit purchase options
    setCurrentScreen('subscription');
  };

  const handleCloseSubscription = () => {
    setCurrentScreen('upload');
  };

  // App renders normally; routing handles the /login page. Auth state
  // is used to advance the flow automatically when a user signs in.

  return (
    <div className="w-full min-h-screen overflow-x-hidden overflow-y-auto bg-gradient-to-b from-blue-300 to-blue-800">
      <AnimatePresence mode="wait">
        {currentScreen === 'splash' && (
          <motion.div key="splash">
            <SplashScreen onComplete={handleSplashComplete} />
          </motion.div>
        )}
        
        {currentScreen === 'upload' && (
          <motion.div key="upload">
            <UploadScreen 
              onPhotoUpload={handlePhotoUpload}
              checksUsed={checksUsed}
              isPremium={isPremium}
              creditsBalance={creditsBalance}
            />
          </motion.div>
        )}
        
        {currentScreen === 'result' && currentPhoto && (
          <motion.div key="result">
            <ResultScreen
              photo={currentPhoto.file}
              vibes={currentPhoto.vibes}
              verdict={currentPhoto.verdict ?? undefined}
              suggestion={currentPhoto.suggestion ?? undefined}
              onTryAnother={handleTryAnother}
            />
          </motion.div>
        )}
        
        {currentScreen === 'subscription' && (
          <motion.div key="subscription">
            <SubscriptionScreen
              onUpgrade={handleUpgrade}
              onClose={handleCloseSubscription}
              user={user}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium indicator */}
      {isPremium && (
        <motion.div
          className="absolute top-4 left-4 bg-yellow-400 text-yellow-800 px-3 py-1 rounded-full text-sm z-50"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          Premium ✨
        </motion.div>
      )}
    </div>
  );
}