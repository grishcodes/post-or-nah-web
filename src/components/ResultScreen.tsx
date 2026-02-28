import { motion } from 'motion/react';
import { RefreshCw, Download } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ResultScreenProps {
  photo: File | string;
  vibes: string[];
  verdict?: string;
  suggestion?: string;
  score?: number;
  onTryAnother: () => void;
}

const getScoreColor = (s: number) =>
  s >= 7 ? '#4ade80' : s >= 4 ? '#facc15' : '#f87171';

const getScoreGlowVar = (s: number) =>
  s >= 7 ? 'var(--glow-green)' : s >= 4 ? 'var(--glow-yellow)' : 'var(--glow-red)';

const getScoreLabel = (s: number) => {
  if (s >= 9) return 'no cap fire 🔥';
  if (s >= 7) return 'lowkey slay ✨';
  if (s >= 5) return "it's giving mid 🤷";
  if (s >= 3) return 'not it twin 😬';
  return 'delete this rn 💀';
};

const getVerdictGlow = (verdict: string) => {
  if (verdict.includes('✅')) return '0 0 40px rgba(74,222,128,0.45)';
  if (verdict.includes('❌')) return '0 0 40px rgba(248,113,113,0.45)';
  return '0 0 40px rgba(250,204,21,0.4)';
};

const getVerdictBorder = (verdict: string) => {
  if (verdict.includes('✅')) return 'rgba(74,222,128,0.35)';
  if (verdict.includes('❌')) return 'rgba(248,113,113,0.35)';
  return 'rgba(250,204,21,0.35)';
};

// Animated count-up hook
function useCountUp(target: number, delay = 700) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = Date.now();
      const duration = 900;
      const tick = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, delay]);
  return display;
}

// Generates the mock AI response only as a pure fallback
const generateAIResponse = (vibes: string[]) => {
  const responses: Record<string, { positive: any; negative: any }> = {
    'Aesthetic core': {
      positive: { verdict: 'Post ✅', suggestions: ['Perfect lighting and composition!', 'This fits the aesthetic perfectly'] },
      negative: { verdict: 'Nah ❌', suggestions: ['Try softer lighting', 'Add more visual elements'] },
    },
    'Classy core': {
      positive: { verdict: 'Post ✅', suggestions: ['Elegant and sophisticated', 'Great for professional posts'] },
      negative: { verdict: 'Nah ❌', suggestions: ['Consider more neutral colors', 'Clean up the background'] },
    },
    'Rizz core': {
      positive: { verdict: 'Post ✅', suggestions: ['Confident energy detected!', 'This will definitely get attention'] },
      negative: { verdict: 'Nah ❌', suggestions: ['Work on your pose', 'Better angle needed'] },
    },
    'Matcha core': {
      positive: { verdict: 'Post ✅', suggestions: ['Calm and serene vibes', 'Perfect for mindful content'] },
      negative: { verdict: 'Nah ❌', suggestions: ['Add more green tones', 'Softer, more natural lighting'] },
    },
    'Baddie vibe': {
      positive: { verdict: 'Post ✅', suggestions: ['Bold and fierce energy!', 'Confidence is on point'] },
      negative: { verdict: 'Nah ❌', suggestions: ['Step up your outfit game', 'More dramatic lighting'] },
    },
  };
  const primaryVibe = (vibes[0] === 'Aesthetic vibe' ? 'Aesthetic core' : vibes[0]) as keyof typeof responses;
  const isPositive = Math.random() > 0.3;
  return responses[primaryVibe]
    ? isPositive ? responses[primaryVibe].positive : responses[primaryVibe].negative
    : { verdict: 'Post ✅', suggestions: ['Looking good!', 'Great photo quality'] };
};

export function ResultScreen({ photo, vibes, verdict: verdictProp, suggestion: suggestionProp, score: scoreProp, onTryAnother }: ResultScreenProps) {
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const aiResponse = verdictProp
    ? { verdict: verdictProp, suggestions: suggestionProp ? [suggestionProp] : [] }
    : generateAIResponse(vibes);
  const isPositive = aiResponse.verdict.includes('✅');
  const score = scoreProp ?? (isPositive ? 8 : 3);
  const displayScore = useCountUp(score, 600);

  // SVG ring math (r=42 so circumference ≈ 264)
  const R = 42;
  const CIRC = 2 * Math.PI * R;
  const ringOffset = CIRC * (1 - score / 10);

  const handleDownload = () => {
    if (!photoUrl) return;
    const link = document.createElement('a');
    link.href = photoUrl;
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = photoFile?.name || `post-or-nah-winner-${timestamp}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (typeof photo === 'string') {
      setPhotoUrl(photo);
      setPhotoFile(null);
    } else {
      setPhotoFile(photo);
      const url = URL.createObjectURL(photo);
      setPhotoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [photo]);

  return (
    <motion.div
      style={{ minHeight: '100vh', background: 'var(--deep-bg)', position: 'relative', overflow: 'hidden' }}
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -60, opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Ambient orbs */}
      <div className="orb orb-1" style={{ top: -160, left: -100, opacity: 0.6 }} />
      <div className="orb orb-2" style={{ bottom: -120, right: -100, opacity: 0.5, animationDelay: '6s' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(124,58,237,0.14), transparent)', pointerEvents: 'none' }} />

      {/* Two-column layout */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'row', alignItems: 'stretch', minHeight: '100vh', maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 2rem', gap: '2.5rem' }}>

        {/* LEFT — Photo */}
        <motion.div
          style={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 140, damping: 20 }}
        >
          {photoUrl ? (
            <div style={{ borderRadius: '24px', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.75)', position: 'relative' }}>
              <img
                src={photoUrl}
                alt="Uploaded photo"
                style={{ width: '100%', height: 'auto', maxHeight: 'calc(100vh - 5rem)', objectFit: 'cover', display: 'block' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(255,255,255,0.03), transparent)', pointerEvents: 'none' }} />
            </div>
          ) : (
            <div className="glass" style={{ height: '420px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Loading…</span>
            </div>
          )}
        </motion.div>

        {/* RIGHT — All info */}
        <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.5rem', overflowY: 'auto' }}>

          {/* Header */}
          <motion.h1
            style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}
            className="gradient-text"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            AI Results
          </motion.h1>

          {/* Vibe badges */}
          {vibes.length > 0 && (
            <motion.div
              style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
            >
              {vibes.map((v) => (
                <span
                  key={v}
                  style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', padding: '4px 12px', borderRadius: '999px', background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.4)', color: '#c4b5fd' }}
                >
                  {v}
                </span>
              ))}
            </motion.div>
          )}

          {/* Score ring row */}
          <motion.div
            className="glass"
            style={{ borderRadius: '20px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 130, damping: 18 }}
          >
            {/* Ring */}
            <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="96" height="96" viewBox="0 0 112 112" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
                <circle cx="56" cy="56" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
                <motion.circle
                  cx="56" cy="56" r={R}
                  fill="none"
                  stroke={getScoreColor(score)}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC}
                  style={{ rotate: -90, transformOrigin: '56px 56px' }}
                  animate={{ strokeDashoffset: ringOffset }}
                  transition={{ delay: 0.65, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                  filter={`drop-shadow(0 0 8px ${getScoreColor(score)})`}
                />
              </svg>
              <motion.span
                style={{ position: 'relative', fontSize: '2rem', fontWeight: 900, color: getScoreColor(score) }}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.7, type: 'spring', stiffness: 220 }}
              >
                {displayScore}
              </motion.span>
            </div>
            {/* Labels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Postability Score</p>
              <motion.span
                className="glass-md"
                style={{ fontSize: '12px', fontWeight: 700, padding: '4px 14px', borderRadius: '999px', color: getScoreColor(score), display: 'inline-block', alignSelf: 'flex-start' }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.95 }}
              >
                {getScoreLabel(score)}
              </motion.span>
            </div>
          </motion.div>

          {/* Verdict */}
          <motion.div
            className="glass"
            style={{
              borderRadius: '20px',
              padding: '1.5rem',
              textAlign: 'center',
              boxShadow: getVerdictGlow(aiResponse.verdict),
              borderColor: getVerdictBorder(aiResponse.verdict),
            }}
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 130, damping: 18 }}
          >
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Verdict</p>
            <motion.p
              style={{ fontSize: '2.25rem', fontWeight: 900, margin: 0, lineHeight: 1.2 }}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.45, type: 'spring', stiffness: 180 }}
            >
              {aiResponse.verdict}
            </motion.p>
          </motion.div>

          {/* Feedback */}
          <motion.div
            className="glass"
            style={{ borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 130, damping: 18 }}
          >
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Feedback</p>
            {aiResponse.suggestions.map((s, i) => (
              <motion.p
                key={i}
                style={{ fontSize: '14px', color: 'rgba(255,255,255,0.82)', lineHeight: 1.65, margin: 0, padding: '10px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)' }}
                initial={{ x: -12, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.65 + i * 0.1 }}
              >
                {s}
              </motion.p>
            ))}
          </motion.div>

          {/* Buttons */}
          <motion.div
            style={{ display: 'flex', gap: '12px' }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <button
              onClick={onTryAnother}
              style={{ flex: 1, height: '52px', borderRadius: '14px', fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer' }}
            >
              <RefreshCw size={16} />
              Try Another
            </button>
            <button
              onClick={handleDownload}
              disabled={!photoUrl}
              style={{ flex: 1, height: '52px', borderRadius: '14px', fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 4px 24px rgba(22,163,74,0.4)', color: '#fff', cursor: 'pointer', border: 'none', opacity: !photoUrl ? 0.4 : 1 }}
            >
              <Download size={16} />
              Save Winner
            </button>
          </motion.div>

        </div>
      </div>
    </motion.div>
  );
}