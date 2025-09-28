import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SplashScreen } from './components/SplashScreen';
import { UploadScreen } from './components/UploadScreen';
import { ResultScreen } from './components/ResultScreen';
import { SubscriptionScreen } from './components/SubscriptionScreen';
import { LoginScreen } from './components/LoginScreen';
import { useAuth } from './context/AuthContext';

type Screen = 'splash' | 'upload' | 'result' | 'subscription' | 'login';

interface PhotoData {
  file: File;
  vibes: string[];
}

export default function App() {
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
    </div>
  );
}