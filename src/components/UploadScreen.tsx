import { motion } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import appIcon from '../assets/4aa122b285e3e6a8319c5a3638bb61ba822a9ec8.png';
import newLogo from '../assets/1.png'; 
import newLogo2 from '../assets/2.png';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Upload, Camera } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { SafariCompat } from '../lib/safariCompat';

interface UploadScreenProps {
  // onPhotoUpload now accepts either a File (local) or a string (uploaded URL)
  onPhotoUpload: (photo: File | string, vibes: string[], verdict?: string | null, suggestion?: string | null) => void;
  checksUsed: number;
  isPremium: boolean;
  creditsBalance?: number;
}

const VIBE_CATEGORIES = [
  'IG Story vibe',
  'Aesthetic core',
  'Classy core',
  'Rizz core',
  'Matcha core',
  'Bad bih vibe'
];

export function UploadScreen({ onPhotoUpload, checksUsed, isPremium, creditsBalance = 0 }: UploadScreenProps) {
  const { user } = useAuth();
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [uploadedPhoto, setUploadedPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevent the browser from dropping/opening images on the page (which can overlay content)
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('dragover', prevent as any);
    window.addEventListener('drop', prevent as any);
    return () => {
      window.removeEventListener('dragover', prevent as any);
      window.removeEventListener('drop', prevent as any);
    };
  }, []);

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

      // Create a bounded preview URL
      try {
        const url = URL.createObjectURL(file);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {}
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
        // Determine API URL
        const envApiBase = import.meta.env.VITE_API_URL;
        
        // Try configured env var first, then fallback to localhost:3001
        const candidates = [
          envApiBase ? `${envApiBase.replace(/\/$/, '')}/api/feedback` : undefined,
          'http://localhost:3001/api/feedback'
        ].filter(Boolean) as string[];

        let lastErr: any = null;
        let json: any = null;
        for (const url of candidates) {
          try {
            // Use Safari-compatible fetch
            const res = await SafariCompat.safeFetch(url, {
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
        
        // Provide helpful error messages based on the error type
        if (msg.includes('private browsing mode') || msg.includes('private') || msg.includes('incognito')) {
          setError(
            'Private browsing/incognito mode detected. Try using normal browsing mode for full functionality.'
          );
        } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('TypeError')) {
          setError(
            `Connection error: ${msg}\n\nPlease check:\n1. Your internet connection\n2. If your backend server is running\n3. Try disabling VPN or strict privacy settings`
          );
        } else if (msg.includes('storage') || msg.includes('unable to save')) {
          setError(
            'Browser storage is restricted. Try disabling private browsing mode or check privacy settings.'
          );
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Failed to read file. Please try a different image.');
      setLoading(false);
    };

    reader.readAsDataURL(uploadedPhoto);
  };

  return (
  <div className="min-h-screen bg-gradient-to-b from-blue-300 to-blue-800" onDragOver={(e) => { e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); }}>
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
          <p className="text-blue-100 text-lg mb-2">
            {isPremium ? (
              `Premium - Check ${checksUsed + 1}`
            ) : (
              `Check ${checksUsed + 1}`
            )}
          </p>
          <p className="text-blue-100 text-lg">
            Credits remaining: {creditsBalance > 0 ? creditsBalance : isPremium ? '∞' : Math.max(0, 3 - checksUsed)}
          </p>
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
            className="w-full h-40 bg-white/10 backdrop-blur-sm hover:bg-white/20 border-2 border-dashed border-white/40 text-white rounded-3xl flex flex-col items-center justify-center space-y-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl overflow-hidden"
            variant="ghost"
          >
            {uploadedPhoto ? (
              <div className="flex flex-col items-center space-y-3">
                {previewUrl && (
                  <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl overflow-hidden border border-white/25 bg-white/5 backdrop-blur-sm shadow-lg flex items-center justify-center flex-shrink-0">
                    <img
                      src={previewUrl}
                      alt="Selected preview"
                      className="w-full h-full object-cover pointer-events-none select-none"
                      onError={(e) => console.error('Image failed to load:', e)}
                    />
                  </div>
                )}
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
          className="mb-8 relative z-10"
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
                    ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500 shadow-xl scale-110 border-2 border-yellow-600'
                    : 'bg-white/15 text-white hover:bg-white/25 border border-white/30 hover:scale-105'
                }`}
                variant="secondary"
              >
                {selectedVibes.includes(vibe) && '✓ '}{vibe}
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
  const initials = (user.displayName || 'U')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0]!.toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <div className="flex flex-col items-end gap-2 p-2">
      <button
        onClick={() => signOut()}
        className="text-sm text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full"
      >
        Sign out
      </button>
      {user.photoURL ? (
        <ImageWithFallback
          src={user.photoURL}
          alt={user.displayName || 'User avatar'}
          className="w-10 h-10 rounded-full shadow-sm object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-10 h-10 rounded-full shadow-sm bg-white/20 backdrop-blur-sm flex items-center justify-center text-xs font-semibold text-white/80">
          {initials}
        </div>
      )}
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
