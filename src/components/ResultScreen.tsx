import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ResultScreenProps {
  photo: File | string;
  vibes: string[];
  verdict?: string;
  suggestion?: string;
  onTryAnother: () => void;
}

// Mock AI responses based on vibes
const generateAIResponse = (vibes: string[]) => {
  const responses = {
  'Aesthetic core': {
      positive: { verdict: 'Post ✅', suggestions: ['Perfect lighting and composition!', 'This fits the aesthetic perfectly'] },
      negative: { verdict: 'Nah ❌', suggestions: ['Try softer lighting', 'Add more visual elements'] }
    },
    'Classy core': {
      positive: { verdict: 'Post ✅', suggestions: ['Elegant and sophisticated', 'Great for professional posts'] },
      negative: { verdict: 'Nah ❌', suggestions: ['Consider more neutral colors', 'Clean up the background'] }
    },
    'Rizz core': {
      positive: { verdict: 'Post ✅', suggestions: ['Confident energy detected!', 'This will definitely get attention'] },
      negative: { verdict: 'Nah ❌', suggestions: ['Work on your pose', 'Better angle needed'] }
    },
    'Matcha core': {
      positive: { verdict: 'Post ✅', suggestions: ['Calm and serene vibes', 'Perfect for mindful content'] },
      negative: { verdict: 'Nah ❌', suggestions: ['Add more green tones', 'Softer, more natural lighting'] }
    },
    'Bad bih vibe': {
      positive: { verdict: 'Post ✅', suggestions: ['Bold and fierce energy!', 'Confidence is on point'] },
      negative: { verdict: 'Nah ❌', suggestions: ['Step up your outfit game', 'More dramatic lighting'] }
    }
  };

  const primaryVibe = (vibes[0] === 'Aesthetic vibe' ? 'Aesthetic core' : vibes[0]) as keyof typeof responses;
  const isPositive = Math.random() > 0.3; // 70% chance of positive
  
  return responses[primaryVibe] ? 
    (isPositive ? responses[primaryVibe].positive : responses[primaryVibe].negative) :
    { verdict: 'Post ✅', suggestions: ['Looking good!', 'Great photo quality'] };
};

export function ResultScreen({ photo, vibes, verdict: verdictProp, suggestion: suggestionProp, onTryAnother }: ResultScreenProps) {
  const [photoUrl, setPhotoUrl] = useState<string>('');
  // Prefer server-provided verdict/suggestion; fallback to mock if absent
  const aiResponse = verdictProp
    ? { verdict: verdictProp, suggestions: suggestionProp ? [suggestionProp] : [] }
    : generateAIResponse(vibes);
  const isPositive = aiResponse.verdict.includes('✅');

  useEffect(() => {
    if (typeof photo === 'string') {
      setPhotoUrl(photo);
    } else {
      const url = URL.createObjectURL(photo);
      setPhotoUrl(url);
      
      // Cleanup function to revoke the object URL
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [photo]);

  return (
    <motion.div 
      className="min-h-screen bg-gradient-to-b from-blue-300 to-blue-800 flex flex-col px-6 py-8 pb-16"
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl text-white">AI Results</h1>
      </div>

      <div className="flex-1 flex flex-col items-center space-y-6">
        {/* Photo */}
        <motion.div 
          className="w-full max-w-sm"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Uploaded photo"
              className="w-full h-64 object-cover rounded-2xl shadow-xl"
            />
          ) : (
            <div className="w-full h-64 bg-white/20 rounded-2xl shadow-xl flex items-center justify-center">
              <span className="text-white">Loading photo...</span>
            </div>
          )}
        </motion.div>

        {/* Selected Vibes */}
        <motion.div 
          className="flex gap-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {vibes.map((vibe) => (
            <Badge
              key={vibe}
              className="bg-white/20 text-white border border-white/30 px-3 py-1"
              variant="secondary"
            >
              {vibe}
            </Badge>
          ))}
        </motion.div>

        {/* AI Verdict */}
        <motion.div 
          className="text-center space-y-4"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className={`text-5xl ${isPositive ? 'text-green-300' : 'text-red-300'}`}>
            {aiResponse.verdict}
          </div>
          
          <div className="space-y-2">
            {aiResponse.suggestions.map((suggestion, index) => (
              <motion.p
                key={index}
                className="text-white text-lg bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                {suggestion}
              </motion.p>
            ))}
          </div>
        </motion.div>

        {/* Try Another Button */}
        <motion.div
          className="pt-6"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Button
            onClick={onTryAnother}
            className="bg-white text-blue-800 hover:bg-white/90 h-auto min-h-12 px-6 py-3 rounded-full text-base md:text-lg font-semibold flex items-center gap-2 whitespace-nowrap"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Try Another Photo</span>
          </Button>
        </motion.div>
      </div>
      {/* bottom spacer for scroll */}
      <div className="h-10" />
    </motion.div>
  );
}