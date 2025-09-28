import { motion } from 'motion/react';
import { useState } from 'react';
import { signInWithGoogle } from '../firebaseConfig';
import appIcon from '../assets/4aa122b285e3e6a8319c5a3638bb61ba822a9ec8.png';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [step, setStep] = useState<'start' | 'login'>('start');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStart = () => {
    // reveal the Google login CTA in-place
    setStep('login');
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      // onAuthStateChanged in App will move the flow forward
    } catch (err) {
      console.error('Google sign-in failed', err);
      setError('Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      className="min-h-screen bg-gradient-to-b from-blue-300 to-blue-800 flex flex-col items-center justify-between px-6 py-12 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Logo at top-middle */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2">
        <img src={appIcon} alt="Post or Nah" className="w-32 h-32 rounded-3xl shadow-2xl" />
      </div>

      {/* Bottom section with text and button */}
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-4xl font-black text-white">Post or Nah</h1>
        </div>
        
        {step === 'start' ? (
          <motion.button
            onClick={handleStart}
            className="bg-white/20 backdrop-blur-sm text-white px-8 py-3 rounded-full border border-white/30"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Get Started
          </motion.button>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <motion.button
              onClick={handleGoogleLogin}
              className="bg-white text-blue-700 font-semibold px-6 py-3 rounded-full shadow-md flex items-center justify-center gap-3 w-full max-w-xs mx-auto"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-busy={loading}
            >
              {loading ? 'Signing in...' : 'Login with Google'}
            </motion.button>
            {error && <p className="text-sm text-red-200 text-center">{error}</p>}
          </div>
        )}
      </div>
    </motion.div>
  );
}