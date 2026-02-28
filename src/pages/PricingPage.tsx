import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Crown, Check, ArrowLeft } from 'lucide-react';
import { User } from 'firebase/auth';

interface PricingPageProps {
  user: User | null;
  onPurchase?: (priceId: string) => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function handlePurchase(priceId: string, user: User | null) {
  try {
    if (!user) {
      alert('Please sign in to make a purchase');
      return;
    }

    const res = await fetch(`${API_URL}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId, userId: user.uid }),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Error: No checkout URL received');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    alert(`Payment error: ${message}. Please try again or contact support.`);
  }
}

export function PricingPage({ user }: PricingPageProps) {
  const navigate = useNavigate();

  const plans = [
    { label: 'Pre Start', price: '$1/mo', credits: '10 credits', priceId: 'price_1Skb33Fvu58DRDkCqEOvW03I', description: 'Perfect for trying it out' },
    { label: 'Starter', price: '$5/mo', credits: '50 credits', priceId: 'price_1SiPpnFvu58DRDkCWZQENIqt', description: 'For casual users' },
    { label: 'Pro', price: '$12/mo', credits: '200 credits', priceId: 'price_1SiRKCFvu58DRDkCGoZeG8Er', popular: true, description: 'Best value for active posters' },
    { label: 'Unlimited', price: '$25/mo', credits: 'Unlimited', priceId: 'price_1SiPqnFvu58DRDkCWwdway9a', description: 'For power users' },
  ];

  const features = [
    'AI-powered photo analysis',
    'Instant vibe check results',
    'Multiple photo comparison',
    'Credits reset monthly',
    'Cancel anytime',
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
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '900px', margin: '0 auto', padding: '5rem 2rem 4rem' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <motion.div
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', borderRadius: '50%', width: 64, height: 64, marginBottom: '1.5rem', boxShadow: '0 8px 32px rgba(251,191,36,0.4)' }}
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 16 }}
          >
            <Crown size={32} color="#92400e" />
          </motion.div>
          <h1 className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: 900, margin: '0 0 1rem', letterSpacing: '-0.02em' }}>
            Choose Your Plan
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', margin: 0 }}>
            Get unlimited AI-powered vibe checks for your photos
          </p>
        </div>

        {/* Features */}
        <motion.div
          className="glass"
          style={{ borderRadius: '20px', padding: '2rem', marginBottom: '2.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {features.map((f, i) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={16} color="#4ade80" />
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>{f}</span>
            </div>
          ))}
        </motion.div>

        {/* Plans grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {plans.map((plan, i) => (
            <motion.button
              key={plan.priceId}
              onClick={() => handlePurchase(plan.priceId, user)}
              className="glass"
              style={{
                borderRadius: '20px',
                padding: '2rem 1.5rem',
                border: plan.popular ? '2px solid rgba(251,191,36,0.6)' : '1px solid rgba(255,255,255,0.1)',
                background: plan.popular ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)',
                cursor: 'pointer',
                textAlign: 'center',
                position: 'relative',
                transition: 'transform 0.2s, border-color 0.2s',
              }}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              whileHover={{ scale: 1.02 }}
            >
              {plan.popular && (
                <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', padding: '4px 16px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: '#92400e', letterSpacing: '0.05em' }}>
                  MOST POPULAR
                </div>
              )}
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: '0 0 0.5rem' }}>{plan.label}</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 1rem', minHeight: '36px' }}>{plan.description}</p>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: plan.popular ? '#fbbf24' : '#fff', margin: '0 0 0.25rem' }}>
                {plan.price.split('/')[0]}<span style={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>/mo</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: 600, margin: 0 }}>{plan.credits}</p>
            </motion.button>
          ))}
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px', lineHeight: 1.6, margin: 0 }}>
          All plans auto-renew monthly. Cancel anytime with no questions asked.<br />
          By subscribing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </motion.div>
  );
}
