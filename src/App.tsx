import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SplashScreen } from './components/SplashScreen';
import { UploadScreen } from './components/UploadScreen';
import { ResultScreen } from './components/ResultScreen';
import { SubscriptionScreen } from './components/SubscriptionScreen';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

type Screen = 'splash' | 'upload' | 'result' | 'subscription' | 'login';

interface PhotoData {
  file: File;
  vibes: string[];
}

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [checksUsed, setChecksUsed] = useState(0);
  const [currentPhoto, setCurrentPhoto] = useState<PhotoData | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showSignInToast, setShowSignInToast] = useState(false);
  const [prevUser, setPrevUser] = useState<any | null>(null);

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
        setShowSignInToast(false);
      } else {
        // when user signs in, move to upload screen
        setCurrentScreen('upload');
        // show a brief sign-in toast when transitioning from logged-out to logged-in
        if (!prevUser) {
          setShowSignInToast(true);
          setTimeout(() => setShowSignInToast(false), 2500);
        }
        setPrevUser(u);
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

  const handlePhotoUpload = (photo: File, vibes: string[]) => {
    // Check if user has reached free limit and isn't premium
    if (checksUsed >= 15 && !isPremium) {
      setCurrentScreen('subscription');
      return;
    }

    setCurrentPhoto({ file: photo, vibes });
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
    <div className="w-full h-screen overflow-hidden bg-gradient-to-b from-blue-300 to-blue-800">
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
          className="absolute top-4 right-4 bg-yellow-400 text-yellow-800 px-3 py-1 rounded-full text-sm z-50"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          Premium ✨
        </motion.div>
      )}

      {/* Sign-in toast */}
      {showSignInToast && user && (
        <motion.div
          className="absolute top-6 left-1/2 -translate-x-1/2 bg-white/90 text-blue-800 px-4 py-2 rounded-full shadow-md z-50"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Signed in as {user.displayName || user.email}
        </motion.div>
      )}
    </div>
  );
}