import { motion } from 'motion/react';
import appIcon from 'figma:asset/4aa122b285e3e6a8319c5a3638bb61ba822a9ec8.png';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  return (
    <motion.div 
      className="min-h-screen bg-gradient-to-b from-blue-300 to-blue-800 flex flex-col items-center justify-between px-6 py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Logo in center */}
      <div className="flex-1 flex items-center justify-center">
        <img
          src={appIcon}
          alt="Post or Nah"
          className="w-32 h-32 rounded-3xl shadow-2xl"
        />
      </div>

      {/* Bottom section with text and button */}
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-4xl font-black text-white">Post or Nah</h1>
        </div>
        
        <motion.button
          onClick={onComplete}
          className="bg-white/20 backdrop-blur-sm text-white px-8 py-3 rounded-full border border-white/30"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Get Started
        </motion.button>
      </div>
    </motion.div>
  );
}