import { motion } from 'motion/react';
import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Upload, Camera } from 'lucide-react';

interface UploadScreenProps {
  onPhotoUpload: (photo: File, vibes: string[]) => void;
  checksUsed: number;
}

const VIBE_CATEGORIES = [
  'Aesthetic vibe',
  'Classy core',
  'Rizz core',
  'Matcha core',
  'Bad bih vibe'
];

export function UploadScreen({ onPhotoUpload, checksUsed }: UploadScreenProps) {
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [uploadedPhoto, setUploadedPhoto] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVibeToggle = (vibe: string) => {
    setSelectedVibes(prev => {
      if (prev.includes(vibe)) {
        return prev.filter(v => v !== vibe);
      } else if (prev.length < 2) {
        return [...prev, vibe];
      }
      return prev;
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedPhoto(file);
    }
  };

  const handleSubmit = () => {
    if (uploadedPhoto && selectedVibes.length > 0) {
      onPhotoUpload(uploadedPhoto, selectedVibes);
    }
  };

  return (
    <motion.div 
      className="min-h-screen bg-gradient-to-b from-blue-300 to-blue-800 flex flex-col px-6 py-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black text-white mb-2">Post or Nah</h1>
        <p className="text-blue-100">Check #{checksUsed + 1} of 15 free</p>
      </div>

      {/* Upload Section */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        <motion.div 
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 6, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.45, ease: "easeOut" }}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            ref={fileInputRef}
          />
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-32 bg-white/20 backdrop-blur-sm hover:bg-white/30 border-2 border-dashed border-white/50 text-white rounded-2xl flex flex-col items-center justify-center space-y-3"
            variant="ghost"
          >
            {uploadedPhoto ? (
              <div className="flex flex-col items-center space-y-2">
                <Camera className="w-8 h-8" />
                <span className="text-lg">Photo Selected ✓</span>
                <span className="text-sm text-blue-100">{uploadedPhoto.name}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <Upload className="w-8 h-8" />
                <span className="text-2xl">Upload Photo</span>
                <span className="text-sm text-blue-100">Get AI feedback on your picture</span>
              </div>
            )}
          </Button>
        </motion.div>

        {/* Vibe Selection */}
        <motion.div 
          className="w-full max-w-sm space-y-4"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45, ease: "easeOut" }}
        >
          <h3 className="text-xl text-white text-center">Select Vibes (up to 2)</h3>
          <div className="flex flex-wrap gap-3 justify-center">
            {VIBE_CATEGORIES.map((vibe) => (
              <Badge
                key={vibe}
                onClick={() => handleVibeToggle(vibe)}
                className={`px-4 py-2 cursor-pointer transition-all text-base ${
                  selectedVibes.includes(vibe)
                    ? 'bg-white text-blue-800 hover:bg-white/90'
                    : 'bg-white/20 text-white hover:bg-white/30 border border-white/30'
                }`}
                variant="secondary"
              >
                {vibe}
              </Badge>
            ))}
          </div>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.45, ease: "easeOut" }}
        >
          <Button
            onClick={handleSubmit}
            disabled={!uploadedPhoto || selectedVibes.length === 0}
            className="bg-white text-blue-800 hover:bg-white/90 px-8 py-3 rounded-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Get AI Feedback
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}