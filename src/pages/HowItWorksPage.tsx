import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Upload, Sparkles, BarChart3, Download } from 'lucide-react';

export function HowItWorksPage() {
  const navigate = useNavigate();

  const steps = [
    {
      icon: Upload,
      title: 'Upload Your Photo',
      description: 'Choose a photo from your device or drag and drop. We support JPEG, PNG, HEIC, and more.',
      color: '#7c3aed',
    },
    {
      icon: Sparkles,
      title: 'Select Your Vibe',
      description: 'Pick the aesthetic you\'re going for: Aesthetic Core, Classy Core, Rizz Core, or others.',
      color: '#f59e0b',
    },
    {
      icon: BarChart3,
      title: 'Get AI Feedback',
      description: 'Our AI analyzes composition, lighting, and vibe fit to give you a score out of 10.',
      color: '#4ade80',
    },
    {
      icon: Download,
      title: 'Post with Confidence',
      description: 'Download winners or try another photo. No more second-guessing before posting.',
      color: '#ec4899',
    },
  ];

  return (
    <motion.div
      style={{ minHeight: '100vh', background: 'var(--deep-bg)', position: 'relative', overflow: 'hidden' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Ambient orbs */}
      <div className="orb orb-1" style={{ top: -160, left: -100, opacity: 0.6 }} />
      <div className="orb orb-2" style={{ bottom: -120, right: -100, opacity: 0.5, animationDelay: '6s' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(124,58,237,0.14), transparent)', pointerEvents: 'none' }} />

      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', zIndex: 20, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '12px', padding: '10px 16px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '800px', margin: '0 auto', padding: '5rem 2rem 4rem' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h1 className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: 900, margin: '0 0 1rem', letterSpacing: '-0.02em' }}>
            How It Works
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', margin: 0, maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
            Get instant AI-powered feedback on your photos in four simple steps
          </p>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                className="glass"
                style={{ borderRadius: '20px', padding: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}
                initial={{ x: i % 2 === 0 ? -40 : 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 120 }}
              >
                <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: '16px', background: `${step.color}20`, border: `2px solid ${step.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={28} color={step.color} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: step.color, background: `${step.color}20`, padding: '2px 10px', borderRadius: '999px' }}>
                      Step {i + 1}
                    </span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                      {step.title}
                    </h3>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div
          style={{ marginTop: '3rem', textAlign: 'center' }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
            style={{ padding: '14px 32px', fontSize: '16px' }}
          >
            Try It Now - Free
          </button>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '1rem' }}>
            3 free checks per month. No credit card required.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
