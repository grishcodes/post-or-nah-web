import { motion } from 'motion/react';
import imageCompression from 'browser-image-compression';
import heic2any from 'heic2any';
import { useState, useRef, useEffect } from 'react';
import newLogo from '../assets/1.png'; 
import newLogo2 from '../assets/2.png';
import { useAuth } from '../context/AuthContext';
import { Upload } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { SafariCompat } from '../lib/safariCompat';

interface UploadScreenProps {
  // onPhotoUpload now accepts either a File (local) or a string (uploaded URL)
  onPhotoUpload: (photo: File | string, vibes: string[], verdict?: string | null, suggestion?: string | null, score?: number | null) => void;
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
  'Baddie vibe'
];

export function UploadScreen({ onPhotoUpload, checksUsed, isPremium, creditsBalance = 0 }: UploadScreenProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'rate' | 'select'>('rate');
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [uploadedPhoto, setUploadedPhoto] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [batchPreviewUrls, setBatchPreviewUrls] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  // Helper to resize images
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          const maxDim = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load image: ${file.name}`));
      };
      
      img.src = url;
    });
  };

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

  const handleBatchFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files).slice(0, 30); // Limit to 30
      
      setBatchFiles(fileArray);
      setVerdict(null);
      setSuggestion(null);
      setError(null);
      setRawResponse(null);

      // Create preview URLs - convert HEIC to data URL for preview
      const urls = fileArray.map(file => {
        if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic')) {
          // For HEIC, show a placeholder since browsers can't render HEIC
          return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23ccc%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23666%22%3EHEIC Image%3C/text%3E%3C/svg%3E';
        }
        return URL.createObjectURL(file);
      });
      
      setBatchPreviewUrls(prev => {
        prev.forEach(url => {
          if (!url.startsWith('data:')) URL.revokeObjectURL(url);
        });
        return urls;
      });
    }
  };

  const handleBatchSubmit = async () => {
    if (batchFiles.length === 0) return;

    setLoading(true);
    setVerdict(null);
    setSuggestion(null);
    setError(null);

    const isLocalhost = window.location.hostname === 'localhost';
    const selectBestCandidates: string[] = (
      isLocalhost
        ? ['http://localhost:3001/api/select-best']
        : import.meta.env.PROD
          ? (() => {
              const envApiBase = import.meta.env.VITE_API_URL as string | undefined;
              const normalizedEnv = envApiBase ? envApiBase.replace(/\/$/, '') : undefined;
              const defaults = [
                'https://post-or-nah-web-gpg2j4io3q-ew.a.run.app',
              ];
              const bases = [normalizedEnv, ...defaults].filter(Boolean) as string[];
              return bases.map(b => `${b}/api/select-best`);
            })()
          : (() => {
              const envApiBase = import.meta.env.VITE_API_URL as string | undefined;
              const normalizedEnv = envApiBase ? envApiBase.replace(/\/$/, '') : '';
              const list = ['/api/select-best'];
              if (normalizedEnv) list.unshift(`${normalizedEnv}/api/select-best`);
              return list;
            })()
    );

    try {
      console.log(`ðŸ”„ Starting batch analysis for ${batchFiles.length} images...`);
      
      // Create FormData to handle both binary and base64
      const formData = new FormData();
      
      for (let i = 0; i < batchFiles.length; i++) {
        const file = batchFiles[i];
        console.log(`ðŸ“„ Processing file ${i + 1}: ${file.name} (${file.type}, ${Math.round(file.size/1024)}KB)`);

        let toAppend: File = file;
        let isHeic = file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic');
        let heicConvertedToJpeg = false;

        // Convert HEIC/HEIF to JPEG in the browser when possible (Vertex typically doesn't accept HEIC).
        // If conversion fails (browser/memory limits), fall back to uploading the original and let the
        // backend attempt conversion.
        if (isHeic) {
          try {
            const converted = await heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.82,
            });

            const blob = Array.isArray(converted) ? converted[0] : converted;
            const outName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
            toAppend = new File([blob as BlobPart], outName, { type: 'image/jpeg' });
            heicConvertedToJpeg = true;
            isHeic = false;
            console.log(`ðŸ§¾ HEICâ†’JPEG: ${file.name} â†’ ${outName} (${Math.round((toAppend.size)/1024)}KB)`);
          } catch (e: any) {
            console.warn('âš ï¸ HEIC conversion failed in browser; sending original HEIC to backend:', e);
            setRawResponse(`HEIC conversion failed in browser: ${e?.message || String(e)}`);
            toAppend = file;
          }
        }

        // Compress large images to stay under Cloud Run's request size limits (~32MB total)
        if (!isHeic) {
          try {
            const opts = { maxSizeMB: 2, maxWidthOrHeight: 1600, useWebWorker: true, initialQuality: 0.8 } as const;
            if (file.size > 2_500_000) {
              const compressed = await imageCompression(file, opts);
              console.log(`ðŸ”§ Compressed ${file.name}: ${Math.round(file.size/1024)}KB â†’ ${Math.round(compressed.size/1024)}KB`);
              toAppend = compressed as File;
            }
          } catch (e) {
            console.warn(`Compression failed for ${file.name}, sending original.`, e);
          }
        }

        // If HEIC was converted, compress the JPEG if it's still large
        if (heicConvertedToJpeg) {
          try {
            const opts = { maxSizeMB: 2, maxWidthOrHeight: 1600, useWebWorker: true, initialQuality: 0.82 } as const;
            if (toAppend.size > 2_500_000) {
              const compressed = await imageCompression(toAppend, opts);
              console.log(`ðŸ”§ Compressed (post-convert) ${toAppend.name}: ${Math.round(toAppend.size/1024)}KB â†’ ${Math.round(compressed.size/1024)}KB`);
              toAppend = compressed as File;
            }
          } catch (e) {
            console.warn(`Compression failed for ${toAppend.name}, sending converted JPEG.`, e);
          }
        }

        formData.append('images', toAppend, toAppend.name);
      }
      
      let data: any = null;
      let lastErr: any = null;
      for (const url of selectBestCandidates) {
        try {
          console.log(`ðŸ“¤ Sending request to ${url} with ${batchFiles.length} images`);
          const response = await fetch(url, {
            method: 'POST',
            body: formData,
          });
          console.log(`ðŸ“¨ Response status: ${response.status} ${response.statusText}`);
          if (!response.ok) {
            let bodyText = '';
            try { bodyText = await response.text(); } catch { bodyText = ''; }
            const statusMsg = `HTTP ${response.status} at ${url}: ${bodyText || response.statusText}`;
            console.warn(statusMsg);
            lastErr = new Error(statusMsg);
            continue;
          }
          data = await response.json();
          // Stop at first success
          break;
        } catch (e: any) {
          console.warn(`Network error calling ${url}:`, e?.message || e);
          lastErr = e;
          continue;
        }
      }

      if (!data) {
        throw lastErr || new Error(`All endpoints failed: ${selectBestCandidates.join(', ')}`);
      }
      
      console.log('âœ… Received response:', data);
      console.log('âœ… Received response:', data);
      
      if (data.error) {
        setRawResponse(data.raw || null);
        setError(data.message || 'Analysis failed');
      } else {
        const winnerIndex = data.selectedIndex || 0;
        setVerdict(data.verdict || 'WINNER ðŸ†');
        setSuggestion(data.reason || 'This is the best one!');

        // Prefer backend-provided preview (fixes HEIC winners not rendering in browser)
        const winnerPreviewDataUrl: string | undefined = typeof data.winnerPreviewDataUrl === 'string' ? data.winnerPreviewDataUrl : undefined;
        const winnerFile = batchFiles[winnerIndex];
        const winnerPreviewFallback = batchPreviewUrls[winnerIndex];

        // Set local state (keeps filename/etc) and preview
        setUploadedPhoto(winnerFile);
        setPreviewUrl(winnerPreviewDataUrl || winnerPreviewFallback);
        
        // Trigger the parent callback to show result screen
        onPhotoUpload(winnerPreviewDataUrl || winnerFile, ['Best Photo Selection'], data.verdict, data.reason, null);
        // Don't setLoading(false) on success — keep overlay until component unmounts
        return;
      }

    } catch (err: any) {
      console.error('âŒ Batch submit error:', err);
      const errorMessage = err.message || 'Unknown error';
      setError(`Error: ${errorMessage}. \nTargets tried: ${selectBestCandidates.join(', ')}`);
    } finally {
      setLoading(false);
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
        const isLocalhost = window.location.hostname === 'localhost';
        const candidates = (
          isLocalhost
            ? ['http://localhost:3001/api/feedback']
            : import.meta.env.PROD
              ? ['/api/feedback']
              : (() => {
                  const envApiBase = import.meta.env.VITE_API_URL as string | undefined;
                  return [
                    '/api/feedback',
                    envApiBase ? `${envApiBase.replace(/\/$/, '')}/api/feedback` : undefined,
                    'http://localhost:3001/api/feedback',
                  ].filter(Boolean) as string[];
                })()
        );

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
            if (maybe.toLowerCase().includes('post')) setVerdict('Post âœ…');
            else if (maybe.toLowerCase().includes('nah')) setVerdict('Nah âŒ');
          }
        }

        onPhotoUpload(uploadedPhoto, selectedVibes, json?.verdict ?? verdict, json?.suggestion ?? suggestion, json?.score ?? null);
        // Don't setLoading(false) on success — keep overlay until component unmounts
        return;
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
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'var(--deep-bg)' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
    >
      {/* â”€â”€ Ambient Orbs â”€â”€ */}
      <div className="orb orb-1 top-[-140px] left-[-100px] opacity-70" />
      <div className="orb orb-2 bottom-[-100px] right-[-120px] opacity-60" style={{ animationDelay: '6s' }} />
      <div className="orb orb-3 top-[50%] right-[8%] opacity-50" style={{ animationDelay: '10s' }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(124,58,237,0.16),transparent)] pointer-events-none" />

      {/* â”€â”€ Auth controls (top-right) â”€â”€ */}
      <div className="absolute top-4 right-4 z-20">
        <AuthControls />
      </div>

      {/* Hidden Cloudinary form */}
      <div className="hidden">
        <UploadForm onUpload={(url) => onPhotoUpload(url, selectedVibes, null, null, null)} />
      </div>

      <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" ref={fileInputRef} />
      <input type="file" accept="image/*" multiple onChange={handleBatchFileSelect} className="hidden" ref={batchInputRef} />

      {/* â”€â”€ Main content â”€â”€ */}
      <div className="relative z-10 container mx-auto px-6 max-w-3xl" style={{ paddingTop: '5rem', paddingBottom: '2.5rem' }}>

        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-center mb-4 gap-3">
            <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
              <img src={newLogo} alt="Post or Nah" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
            </div>
            <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
              <img src={newLogo2} alt="Post or Nah variant" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
            </div>
          </div>

          <div className="flex justify-center gap-2 text-sm text-white/40 tracking-wide">
            <span>{isPremium ? `Premium - Check ${checksUsed + 1}` : `Check ${checksUsed + 1}`}</span>
            <span className="text-white/20">|</span>
            <span>Credits remaining: {creditsBalance > 0 ? creditsBalance : isPremium ? 'unlimited' : Math.max(0, 3 - checksUsed)}</span>
          </div>
        </motion.div>

        {/* Mode Toggle */}
        <motion.div
          className="flex justify-start mb-8"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <div className="flex gap-2">
            {(['rate', 'select'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setUploadedPhoto(null); setBatchFiles([]); }}
                style={{
                  padding: '10px 36px',
                  borderRadius: '999px',
                  fontSize: '14px',
                  fontWeight: 600,
                  minWidth: '160px',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  ...(mode === m
                    ? { background: 'rgba(255,255,255,0.95)', color: '#111', border: '1.5px solid rgba(255,255,255,0.9)' }
                    : { background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1.5px solid rgba(255,255,255,0.2)' }
                  )
                }}
              >
                {m === 'rate' ? 'Rate My Photo' : 'Pick Best Photo'}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Upload Zone */}
        <motion.div
          className="mb-10"
          style={{ marginBottom: '3rem' }}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.55 }}
        >
          {mode === 'rate' ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-64 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 group"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: uploadedPhoto ? '1.5px solid rgba(124,58,237,0.55)' : '1.5px dashed rgba(255,255,255,0.12)',
                backdropFilter: 'blur(16px)',
                boxShadow: uploadedPhoto ? '0 0 32px rgba(124,58,237,0.2) inset' : 'none',
                minHeight: '260px',
                overflow: 'hidden',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.6)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = uploadedPhoto ? 'rgba(124,58,237,0.55)' : 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
            >
              {uploadedPhoto ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%', padding: '0 16px' }}>
                  {previewUrl && (
                    <div style={{ width: '120px', height: '120px', borderRadius: '16px', overflow: 'hidden', border: '2px solid rgba(124,58,237,0.5)', flexShrink: 0 }}>
                      <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: '15px' }}>Photo Selected ✓</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', padding: '4px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {uploadedPhoto.name.length > 28 ? `${uploadedPhoto.name.substring(0, 28)}...` : uploadedPhoto.name}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-white/50 group-hover:text-white/75 transition-colors">
                  <Upload className="w-9 h-9 mb-1" />
                  <span className="text-xl font-semibold text-white/70">Upload Photo</span>
                </div>
              )}
            </button>
          ) : (
            <button
              onClick={() => batchInputRef.current?.click()}
              className="w-full h-64 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: batchFiles.length > 0 ? '1.5px solid rgba(124,58,237,0.55)' : '1.5px dashed rgba(255,255,255,0.12)',
                backdropFilter: 'blur(16px)',
                minHeight: '260px',
                overflow: 'hidden',
              }}
            >
              {batchFiles.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%', padding: '0 16px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {batchPreviewUrls.slice(0, 5).map((url, i) => (
                      <div key={i} style={{ width: '72px', height: '72px', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(124,58,237,0.45)', flexShrink: 0 }}>
                        <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                    ))}
                    {batchFiles.length > 5 && (
                      <div style={{ width: '72px', height: '72px', borderRadius: '12px', border: '2px solid rgba(124,58,237,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#fff', background: '#7c3aed', flexShrink: 0 }}>
                        +{batchFiles.length - 5}
                      </div>
                    )}
                  </div>
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: '15px' }}>{batchFiles.length} Photos Selected ✓</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-white/50">
                  <Upload className="w-9 h-9 mb-1" />
                  <span className="text-xl font-semibold text-white/70">Upload Batch</span>
                  <span className="text-sm text-white/35">Select up to 30 photos</span>
                </div>
              )}
            </button>
          )}
        </motion.div>

        {/* Vibe Selection */}
        {mode === 'rate' && (
          <motion.div
            className="mb-10"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.55 }}
          >
            <p className="text-white/35 text-xs font-semibold uppercase tracking-widest text-center mb-4">Select Vibes (up to 2)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center" }}>
              {VIBE_CATEGORIES.map((vibe, i) => {
                const selected = selectedVibes.includes(vibe);
                return (
                  <motion.button
                    key={vibe}
                    onClick={() => handleVibeToggle(vibe)}
                    style={{ padding: "10px 22px", borderRadius: "999px", fontSize: "14px", fontWeight: 600, cursor: "pointer", ...(selected ? { background: "linear-gradient(135deg, #7c3aed, #9333ea)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 4px 20px rgba(124,58,237,0.5)" } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)" }) }}
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.04 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {selected && <span style={{ marginRight: 4 }}>&#10003;</span>}{vibe}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Submit Button */}
        <motion.div
          className="mb-10"
          style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {mode === 'rate' ? (
            <button
              onClick={handleSubmit}
              disabled={!uploadedPhoto || selectedVibes.length === 0 || loading}
              className="btn-primary py-4 text-base rounded-2xl disabled:opacity-35 disabled:cursor-not-allowed disabled:transform-none"
              style={{ minWidth: '260px', paddingLeft: '3rem', paddingRight: '3rem' }}
            >
              <span className="relative z-10">{loading ? 'Analyzing...' : 'Get AI Feedback'}</span>
            </button>
          ) : (
            <button
              onClick={handleBatchSubmit}
              disabled={batchFiles.length === 0 || loading}
              className="btn-primary py-4 text-base rounded-2xl disabled:opacity-35 disabled:cursor-not-allowed disabled:transform-none"
              style={{ minWidth: '260px', paddingLeft: '3rem', paddingRight: '3rem' }}
            >
              <span className="relative z-10">{loading ? 'Analyzing Batch...' : 'Find Best Photo'}</span>
            </button>
          )}
        </motion.div>

        {/* Loading overlay — full screen takeover */}
        {loading && (
          <motion.div
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'var(--deep-bg)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '2rem',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            {/* Photo + pulse ring */}
            {uploadedPhoto && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Outer pulse rings */}
                <motion.div
                  style={{
                    position: 'absolute',
                    width: 160, height: 160,
                    borderRadius: '50%',
                    border: '1.5px solid rgba(124,58,237,0.4)',
                  }}
                  animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  style={{
                    position: 'absolute',
                    width: 140, height: 140,
                    borderRadius: '50%',
                    border: '1.5px solid rgba(124,58,237,0.3)',
                  }}
                  animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                />
                {/* Photo thumbnail */}
                <div style={{ width: 110, height: 110, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.12)', flexShrink: 0 }}>
                  <img
                    src={URL.createObjectURL(uploadedPhoto)}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.75)' }}
                  />
                </div>
              </div>
            )}

            {/* Text */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <motion.p
                style={{ color: '#fff', fontSize: '18px', fontWeight: 600, margin: 0 }}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                Analyzing your photo
              </motion.p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', margin: 0 }}>This might take a moment</p>
            </div>

            {/* Thin progress bar */}
            <div style={{ width: 180, height: 2, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div
            className="mb-7 px-5 py-4 rounded-2xl"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.22)' }}
            initial={false}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <p className="text-red-300 font-semibold mb-1 text-center">Something went wrong</p>
            <p className="text-red-200/70 text-sm text-center whitespace-pre-wrap break-words">{error}</p>
          </motion.div>
        )}

        {/* Results card */}
        {verdict && (
          <motion.div
            className="mb-7"
            initial={false}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], type: 'spring', stiffness: 110, damping: 16 }}
          >
            <div
              className="p-7 rounded-3xl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(24px)',
                border: `1px solid ${verdict.includes('âœ…') ? 'rgba(74,222,128,0.28)' : verdict.includes('âŒ') ? 'rgba(248,113,113,0.28)' : 'rgba(250,204,21,0.28)'}`,
                boxShadow: verdict.includes('âœ…') ? '0 0 40px rgba(74,222,128,0.12)' : verdict.includes('âŒ') ? '0 0 40px rgba(248,113,113,0.12)' : '0 0 40px rgba(250,204,21,0.12)',
              }}
            >
              <div className="space-y-5">
                {/* Verdict */}
                <motion.div
                  className="text-center"
                  initial={false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
                >
                  <p className="text-xs font-semibold text-white/35 uppercase tracking-widest mb-2">Verdict</p>
                  <p className="text-5xl font-black">{verdict}</p>
                </motion.div>

                {/* Divider */}
                <div className="h-px w-full bg-white/[0.06]" />

                {/* Suggestion */}
                {suggestion && (
                  <motion.div
                    className="px-5 py-4 rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.38, duration: 0.5 }}
                  >
                    <p className="text-xs font-semibold text-white/35 uppercase tracking-widest text-center mb-2">Feedback</p>
                    <p className="text-white/80 text-sm leading-relaxed text-center">{suggestion}</p>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Debug */}
        {rawResponse && (
          <motion.div
            className="mb-7"
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            <details
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <summary className="cursor-pointer p-4 text-white/35 text-xs font-medium hover:text-white/55 transition-colors">
                Raw response (debug)
              </summary>
              <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <pre className="text-xs text-white/50 overflow-auto max-h-48 whitespace-pre-wrap">
                  {JSON.stringify(rawResponse, null, 2)}
                </pre>
              </div>
            </details>
          </motion.div>
        )}

        <div className="h-16" />
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
    <div className="flex flex-col items-end gap-1.5 p-2">
      <button
        onClick={() => signOut()}
        className="text-sm text-white/70 hover:text-white/90 rounded-full transition-colors"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', padding: '8px 20px', fontSize: '14px', fontWeight: 500 }}
      >
        Sign out
      </button>
      {user.photoURL ? (
        <ImageWithFallback
          src={user.photoURL}
          alt={user.displayName || 'User avatar'}
          className="w-9 h-9 rounded-full object-cover ring-2 ring-violet-500/30 shadow-lg"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white/80"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#9333ea)' }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}

// Unsigned upload form â€” posts directly to Cloudinary using an unsigned preset.
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
