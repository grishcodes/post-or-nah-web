import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SplashScreen } from './components/SplashScreen';
import { UploadScreen } from './components/UploadScreen';
import { ResultScreen } from './components/ResultScreen';
import { PricingPlans } from './components/PricingPlans';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

type Screen = 'splash' | 'upload' | 'result' | 'pricing' | 'login';

interface PhotoData {
  file: File | string;
  vibes: string[];
  verdict?: string | null;
  suggestion?: string | null;
}

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [credits, setCredits] = useState(3); // Start with 3 free credits
  const [currentPlan, setCurrentPlan] = useState<string>('Free');
  const [currentPhoto, setCurrentPhoto] = useState<PhotoData | null>(null);

  // Load credits and plan from localStorage on mount
  useEffect(() => {
    const savedCredits = localStorage.getItem('postOrNahCredits');
    const savedPlan = localStorage.getItem('postOrNahPlan');
    if (savedCredits) {
      setCredits(parseInt(savedCredits, 10));
    }
    if (savedPlan) {
      setCurrentPlan(savedPlan);
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

  // Save credits and plan to localStorage
  useEffect(() => {
    localStorage.setItem('postOrNahCredits', credits.toString());
    localStorage.setItem('postOrNahPlan', currentPlan);
  }, [credits, currentPlan]);

  const handleSplashComplete = () => {
    setCurrentScreen('upload');
  };

  const handlePhotoUpload = (photo: File | string, vibes: string[], verdict?: string | null, suggestion?: string | null) => {
    // Check if user has no credits left
    if (credits <= 0) {
      setCurrentScreen('pricing');
      return;
    }

    setCurrentPhoto({ file: photo, vibes, verdict: verdict ?? null, suggestion: suggestion ?? null });
    setCredits(prev => prev - 1);
    setCurrentScreen('result');
  };

  const handleTryAnother = () => {
    setCurrentPhoto(null);
    setCurrentScreen('upload');
  };

  const handleSelectPlan = (planName: string, planCredits: number) => {
    // Mock purchase process - in production, integrate with Stripe/payment processor
    setCurrentPlan(planName);
    setCredits(prev => prev + planCredits);
    setCurrentScreen('upload');
    alert(`${planName} plan purchased! You now have ${credits + planCredits} credits. (This is a demo)`);
  };

  const handleClosePricing = () => {
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
              credits={credits}
              currentPlan={currentPlan}
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
        
        {currentScreen === 'pricing' && (
          <motion.div key="pricing">
            <PricingPlans
              onSelectPlan={handleSelectPlan}
              onClose={handleClosePricing}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plan indicator */}
      {currentPlan !== 'Free' && (
        <motion.div
          className="absolute top-4 left-4 bg-slate-800 text-white px-4 py-2 rounded-full text-sm font-semibold z-50 shadow-lg"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          {currentPlan} Plan
        </motion.div>
      )}
    </div>
  );
}