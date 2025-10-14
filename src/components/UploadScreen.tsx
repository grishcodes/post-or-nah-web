import { motion } from 'motion/react';
import { useState, useRef } from 'react';
import appIcon from '../assets/4aa122b285e3e6a8319c5a3638bb61ba822a9ec8.png';
import newLogo from '../assets/1.png'; 
import newLogo2 from '../assets/2.png';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Upload, Camera } from 'lucide-react';

interface UploadScreenProps {
  // onPhotoUpload now accepts either a File (local) or a string (uploaded URL)
  onPhotoUpload: (photo: File | string, vibes: string[], verdict?: string | null, suggestion?: string | null) => void;
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
  const [verdict, setVerdict] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVibeToggle = (vibe: string) => {
    setSelectedVibes(prev => {
      if (prev.includes(vibe)) return prev.filter(v => v !== vibe);
      else if (prev.length < 2) return [...prev, vibe];
      return prev;
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVerdict(null);
      setSuggestion(null);
      setError(null);
      setRawResponse(null);
      setUploadedPhoto(file);
    }
  };

  const handleSubmit = () => {
    if (!uploadedPhoto || selectedVibes.length === 0) return;

    setVerdict(null);
    setSuggestion(null);
    setError(null);
    setRawResponse(null);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string; // data:<mime>;base64,....
      const base64 = result.includes('base64,') ? result.split('base64,')[1] : result;

      try {
        // Prefer explicit env override if provided
        const envApiBase = (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
        const host = window.location.hostname;
        const port = window.location.port;
        const isLocalHost = host === 'localhost' || host === '127.0.0.1';
        const isViteDev = port === '5173' || port === '5174' || isLocalHost;

        // Always try an explicit Vite base URL first, then proxy path, then direct backend call
        const candidates = [
          envApiBase ? `${envApiBase.replace(/\/$/, '')}/api/feedback` : undefined,
          '/api/feedback', // Use Vite proxy first in dev
          isViteDev ? 'http://localhost:5000/api/feedback' : undefined,
        ].filter(Boolean) as string[];

        let lastErr: any = null;
        let json: any = null;
        for (const url of candidates) {
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64, category: selectedVibes.join(', ') }),
            });

            if (!res.ok) {
              let details: any = null;
              let bodyText = '';
              try { bodyText = await res.text(); } catch { bodyText = ''; }
              try {
                const jsonErr = bodyText ? JSON.parse(bodyText) : null;
                details = jsonErr?.error || jsonErr?.details || (jsonErr ? JSON.stringify(jsonErr) : bodyText);
              } catch {
                details = bodyText || 'No response body';
              }
              const statusMsg = `API error ${res.status} at ${url}: ${details}`;
              console.warn(statusMsg);
              lastErr = new Error(statusMsg);
              continue;
            }

            json = await res.json();
            break; // success
          } catch (e: any) {
            console.warn(`Network error calling ${url}:`, e?.message || e);
            lastErr = e;
            continue;
          }
        }

        if (!json) throw lastErr || new Error('No API endpoint reachable');

        console.log('Hugging Face raw response:', json);
        setRawResponse(json);

        if (json?.verdict) setVerdict(json.verdict);
        if (json?.suggestion) setSuggestion(json.suggestion);

        if (!json?.verdict && json?.raw) {
          const maybe = (json.raw?.generated_text || json.raw?.text || '') as string;
          if (maybe) {
            if (maybe.toLowerCase().includes('post')) setVerdict('Post ✅');
            else if (maybe.toLowerCase().includes('nah')) setVerdict('Nah ❌');
          }
        }

        onPhotoUpload(uploadedPhoto, selectedVibes, json?.verdict ?? verdict, json?.suggestion ?? suggestion);
      } catch (err: any) {
        console.error('Feedback request failed', err);
        const msg = err?.message ? String(err.message) : 'Something went wrong, please try again.';
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('TypeError')) {
          setError(
            `${msg} — backend unreachable. Make sure your API server is running.
If you use Next.js API routes, run 'npm run dev' from the project root. If you use the optional Express server, run 'node server.js' and ensure PORT/CORS are configured.`
          );
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(uploadedPhoto);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-300 to-blue-800">
      {/* Top-right auth controls */}
      <div className="relative">
        <div className="absolute top-4 right-4 z-10">
          <AuthControls />
        </div>
      </div>

      {/* Main Content Container */}
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header Section */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="flex items-center justify-center mb-4 gap-3">
            {/* Mask logos to remove any visible white fringe/outline */}
            <div className="w-12 h-12 rounded-full overflow-hidden circle-mask transition-transform duration-200 ease-out hover:scale-105">
              <img
                src={newLogo}
                alt="Post or Nah"
                className="w-full h-full object-cover transform-gpu origin-center scale-[1.1] select-none pointer-events-none"
                draggable={false}
              />
            </div>
            <div className="w-12 h-12 rounded-full overflow-hidden circle-mask transition-transform duration-200 ease-out hover:scale-105">
              <img
                src={newLogo2}
                alt="Post or Nah variant"
                className="w-full h-full object-cover transform-gpu origin-center scale-[1.1] select-none pointer-events-none"
                draggable={false}
              />
            </div>
          </div>
          <p className="text-blue-100 text-lg">Check #{checksUsed + 1} of 15 free</p>
        </motion.div>

        {/* Upload Section */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
        >
          {/* Hidden Cloudinary Upload Form */}
          <div className="hidden">
            <UploadForm onUpload={(url) => {
              onPhotoUpload(url, selectedVibes);
            }} />
          </div>

          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            ref={fileInputRef}
          />

          <Button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-40 bg-white/10 backdrop-blur-sm hover:bg-white/20 border-2 border-dashed border-white/40 text-white rounded-3xl flex flex-col items-center justify-center space-y-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
            variant="ghost"
          >
            {uploadedPhoto ? (
              <div className="flex flex-col items-center space-y-3">
                <Camera className="w-10 h-10" />
                <span className="text-xl font-medium">Photo Selected ✓</span>
                <span className="text-sm text-blue-100 px-4 py-1 bg-white/10 rounded-full">
                  {uploadedPhoto.name.length > 20 ? `${uploadedPhoto.name.substring(0, 20)}...` : uploadedPhoto.name}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-3">
                <Upload className="w-10 h-10" />
                <span className="text-2xl font-medium">Upload Photo</span>
                <span className="text-base text-blue-100">Get AI feedback on your picture</span>
              </div>
            )}
          </Button>
        </motion.div>

        {/* Vibe Selection */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
        >
          <h3 className="text-xl text-white text-center mb-6 font-medium">Select Vibes (up to 2)</h3>
          <div className="flex flex-wrap gap-3 justify-center">
            {VIBE_CATEGORIES.map((vibe) => (
              <Badge
                key={vibe}
                onClick={() => handleVibeToggle(vibe)}
                className={`px-6 py-3 cursor-pointer transition-all duration-300 text-base font-medium rounded-full ${
                  selectedVibes.includes(vibe)
                    ? 'bg-white text-blue-800 hover:bg-white/90 shadow-lg scale-105'
                    : 'bg-white/15 text-white hover:bg-white/25 border border-white/30 hover:scale-105'
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
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
        >
          <Button
            onClick={handleSubmit}
            disabled={!uploadedPhoto || selectedVibes.length === 0}
            className="bg-white text-blue-800 hover:bg-white/90 h-auto min-h-12 px-8 py-3 rounded-full text-base md:text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.03] active:scale-95 hover:shadow-xl whitespace-nowrap w-fit"
          >
            {loading ? 'Analyzing...' : 'Get AI Feedback'}
          </Button>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 px-8 py-6 rounded-3xl">
              <div className="flex items-center justify-center space-x-3 mb-3">
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="text-white text-lg font-medium">Analyzing your photo...</span>
              </div>
              <p className="text-blue-100 text-sm">This might take a few seconds</p>
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="bg-red-900/20 backdrop-blur-sm border border-red-500/30 px-6 py-4 rounded-2xl">
              <div className="text-red-200 text-center">
                <div className="text-lg font-medium mb-2">Oops! Something went wrong</div>
                <div className="text-sm opacity-90">{error}</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Results Section */}
        {verdict && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ 
              duration: 0.7, 
              ease: [0.22, 1, 0.36, 1],
              type: "spring",
              stiffness: 100,
              damping: 15
            }}
          >
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl shadow-2xl">
              <div className="space-y-6">
                {/* Verdict Section */}
                <motion.div
                  className="text-center"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
                >
                  <div className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
                    Verdict
                  </div>
                  <div className="text-5xl font-bold text-white mb-2">
                    {verdict}
                  </div>
                </motion.div>

                {/* Suggestion Section */}
                {suggestion && (
                  <motion.div
                    className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-2xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
                  >
                    <div className="text-center">
                      <div className="text-sm font-semibold text-blue-200/80 uppercase tracking-wider mb-3">
                        Suggestion
                      </div>
                      <div className="text-lg text-blue-100 leading-relaxed max-w-md mx-auto">
                        {suggestion}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Developer Debug Section */}
        {rawResponse && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <details className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
              <summary className="cursor-pointer p-4 text-white/60 text-sm font-medium hover:bg-white/5 transition-colors">
                Show raw response (debug)
              </summary>
              <div className="p-4 border-t border-white/10">
                <pre className="text-xs text-white/70 overflow-auto max-h-48 whitespace-pre-wrap">
                  {JSON.stringify(rawResponse, null, 2)}
                </pre>
              </div>
            </details>
          </motion.div>
        )}

        {/* Bottom Spacing for Scroll */}
        <div className="h-20"></div>
      </div>
    </div>
  );
}

function AuthControls() {
  const { user, signOut } = useAuth();
  if (!user) return null;

  return (
    <div className="flex items-center gap-3 p-2">
      {user.photoURL && (
        // eslint-disable-next-line jsx-a11y/img-redundant-alt
        <img src={user.photoURL} alt="User avatar" className="w-10 h-10 rounded-full shadow-sm" />
      )}
      <div className="flex items-center gap-2">
        <span className="text-white text-sm hidden sm:inline">{user.displayName}</span>
        <button
          onClick={() => signOut()}
          className="text-sm text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// Unsigned upload form — posts directly to Cloudinary using an unsigned preset.
// Usage: <UploadForm onUpload={(url) => { ... }} />
function UploadForm({ onUpload }: { onUpload: (url: string) => void }) {
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'your_unsigned_preset'); // replace with your unsigned preset

    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.secure_url) {
        onUpload(data.secure_url);
      } else {
        console.error('Cloudinary upload failed', data);
      }
    } catch (err) {
      console.error('Upload error', err);
    }
  };

  return <input type="file" accept="image/*" onChange={handleFile} className="mb-2" />;
}
