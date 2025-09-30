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
  onPhotoUpload: (photo: File | string, vibes: string[]) => void;
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
      // New file uploaded -> clear previous analysis
      setVerdict(null);
      setSuggestion(null);
      setError(null);
      setRawResponse(null);
      setUploadedPhoto(file);
    }
  };

  const handleSubmit = () => {
    if (uploadedPhoto && selectedVibes.length > 0) {
      // Clear previous states and show loading
      setVerdict(null);
      setSuggestion(null);
      setError(null);
      setRawResponse(null);
      setLoading(true);

      // Convert file to base64 and POST to /api/feedback
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string; // data:<mime>;base64,....
        const base64 = result.includes('base64,') ? result.split('base64,')[1] : result;

        try {
          // If running on localhost (Vite dev), call the local Express server we added on :3001.
          const baseApi = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3001/api/feedback'
            : '/api/feedback';

          const res = await fetch(baseApi, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64, category: selectedVibes.join(', ') }),
          });

          if (!res.ok) {
            // Read the body once as text, then try to parse JSON from it
            let details = null;
            let bodyText = '';
            try {
              bodyText = await res.text();
            } catch (e) {
              bodyText = '';
            }
            try {
              const jsonErr = bodyText ? JSON.parse(bodyText) : null;
              details = jsonErr?.error || jsonErr?.details || (jsonErr ? JSON.stringify(jsonErr) : bodyText);
            } catch (e) {
              details = bodyText || 'No response body';
            }
            const statusMsg = `API error ${res.status}: ${details}`;
            console.error(statusMsg);
            throw new Error(statusMsg);
          }

          const json = await res.json();
          // log raw response for debugging
          console.log('Hugging Face raw response:', json);
          setRawResponse(json);

          // Expecting { verdict, suggestion, raw }
          if (json?.verdict) setVerdict(json.verdict);
          if (json?.suggestion) setSuggestion(json.suggestion);

          // If API returned no verdict, attempt to parse from raw
          if (!json?.verdict && json?.raw) {
            const maybe = (json.raw?.generated_text || json.raw?.text || '') as string;
            if (maybe) {
              if (maybe.toLowerCase().includes('post')) setVerdict('Post ✅');
              else if (maybe.toLowerCase().includes('nah')) setVerdict('Nah ❌');
            }
          }

          // Pass raw result to parent as well (keeps previous behavior)
          onPhotoUpload(json, selectedVibes);
        } catch (err: any) {
          console.error('Feedback request failed', err);
          // show specific error if available
          const msg = err?.message ? String(err.message) : 'Something went wrong, please try again.';

          // Network-level failures (e.g. "Failed to fetch") are usually because the backend
          // isn't reachable. Provide a clearer hint so it's easier to debug locally.
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
      {/* Top-right auth controls */}
      <div className="relative">
        <div className="absolute top-0 right-0">
          <AuthControls />
        </div>
      </div>

      {/* Upload Section */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        {/* Centered logo (match splash) */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-2" style={{ gap: '10px' }}>
            <img src={newLogo} alt="Post or Nah" className="app-logo rounded-3xl shadow-2xl" />
            <img src={newLogo2} alt="Post or Nah variant" className="app-logo rounded-3xl shadow-2xl" />
          </div>
          <p className="text-blue-100 mb-4">Check #{checksUsed + 1} of 15 free</p>
        </div>
        <motion.div 
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 6, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.45, ease: "easeOut" }}
        >
          {/* Direct unsigned Cloudinary upload form (uses your unsigned preset) */}
          <UploadForm onUpload={(url) => {
            // pass uploaded url to parent
            onPhotoUpload(url, selectedVibes);
          }} />

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

        {/* Results area: loading, verdict, suggestion, error */}
        <div className="w-full max-w-sm mt-4 text-center">
          {loading && (
            <div className="text-white bg-white/5 px-4 py-3 rounded-lg">Analyzing your photo...</div>
          )}

          {error && (
            <div className="text-red-200 bg-red-900/20 px-4 py-3 rounded-lg">{error}</div>
          )}

          {verdict && (
            <div className="mt-4 bg-white/5 p-6 rounded-2xl">
              <div className="text-3xl font-extrabold text-white">{verdict}</div>
              {suggestion && (
                <div className="mt-2 text-sm text-white/80">{suggestion}</div>
              )}
            </div>
          )}

          {/* Developer raw response link (collapsed) */}
          {rawResponse && (
            <details className="mt-3 text-left text-xs text-white/60">
              <summary className="cursor-pointer">Show raw response (debug)</summary>
              <pre className="whitespace-pre-wrap max-h-48 overflow-auto text-xs mt-2">{JSON.stringify(rawResponse, null, 2)}</pre>
            </details>
          )}
        </div>

        {/* The UploadForm is a tiny helper that posts directly to Cloudinary using an unsigned preset. */}

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