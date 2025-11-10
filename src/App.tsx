import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SplashScreen } from './components/SplashScreen';
import { UploadScreen } from './components/UploadScreen';
import { ResultScreen } from './components/ResultScreen';
// import {pricingplan} from './components/PricingPlan';
import { SubscriptionScreen } from './components/SubscriptionScreen';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

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
  const [checksUsed, setChecksUsed] = useState(0);
  const [currentPhoto, setCurrentPhoto] = useState<PhotoData | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  // Load checks used from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('postOrNahChecks');
    if (saved) {
      setChecksUsed(parseInt(saved, 10));
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

  // Save checks used to localStorage
  useEffect(() => {
    localStorage.setItem('postOrNahChecks', checksUsed.toString());
  }, [checksUsed]);

  const handleSplashComplete = () => {
    setCurrentScreen('upload');
  };

  const handlePhotoUpload = (photo: File | string, vibes: string[], verdict?: string | null, suggestion?: string | null) => {
    // Check if user has reached free limit and isn't premium
    if (checksUsed >= 3 && !isPremium) {
      setCurrentScreen('subscription');
      return;
    }

  setCurrentPhoto({ file: photo, vibes, verdict: verdict ?? null, suggestion: suggestion ?? null });
    setChecksUsed(prev => prev + 1);
    setCurrentScreen('result');
  };

  const handleTryAnother = () => {
    setCurrentPhoto(null);
    setCurrentScreen('upload');
  };

  const handleUpgrade = () => {
    // Mock upgrade process
    setIsPremium(true);
    setCurrentScreen('upload');
    // In a real app, this would integrate with a payment processor
    alert('Upgrade successful! (This is a demo)');
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