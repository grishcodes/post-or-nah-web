import { motion } from 'motion/react';
import { Crown, Check, X } from 'lucide-react';
import { User } from 'firebase/auth';
import { useState } from 'react';

interface SubscriptionScreenProps {
  onUpgrade: () => void;
  onClose: () => void;
  user: User | null;
}

// Get API URL from environment or default to localhost:3001
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Handle main "Choose a plan" button - redirect to Stripe with the Pro plan
async function handleChoosePlan(user: User | null) {
  // Default to the middle option (Pro - $12/month) for the main button
  await handlePurchase('price_1SiRKCFvu58DRDkCGoZeG8Er', user);
}

// Call Stripe Checkout via your backend
async function handlePurchase(priceId: string, user: User | null) {
  try {
    if (!user) {
      alert('Please sign in to make a purchase');
      return;
    }

    const userId = user.uid;

    const res = await fetch(`${API_URL}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId, userId }),
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

export function SubscriptionScreen({ onUpgrade, onClose, user }: SubscriptionScreenProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const plans = [
    { label: 'Pre Start', price: '$1/mo', credits: '10 credits', priceId: 'price_1Skb33Fvu58DRDkCqEOvW03I' },
    { label: 'Starter', price: '$5/mo', credits: '50 credits', priceId: 'price_1SiPpnFvu58DRDkCWZQENIqt' },
    { label: 'Pro', price: '$12/mo', credits: '200 credits', priceId: 'price_1SiRKCFvu58DRDkCGoZeG8Er', popular: true },
    { label: 'Unlimited', price: '$25/mo', credits: 'Unlimited credits', priceId: 'price_1SiPqnFvu58DRDkCWwdway9a' },
  ];

  const features = [
    'Monthly credit allowance',
    'Credits reset every month',
    'Simple: 1 credit = 1 photo',
    'Fast processing',
    'Cancel anytime',
  ];

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

      {/* Close button */}
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 20, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        <X size={16} />
      </button>

      {/* Two-column layout */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'row', alignItems: 'center', minHeight: '100vh', maxWidth: '1000px', margin: '0 auto', padding: '3rem 2rem', gap: '3rem' }}>

        {/* LEFT — Crown + tagline + pricing highlight */}
        <motion.div
          style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.75rem' }}
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 140, damping: 20 }}
        >
          {/* Crown */}
          <motion.div
            style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', borderRadius: '50%', padding: '1.4rem', boxShadow: '0 8px 40px rgba(251,191,36,0.5)' }}
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 200, damping: 16 }}
          >
            <Crown size={44} color="#92400e" />
          </motion.div>

          {/* Text */}
          <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.3rem', fontWeight: 500, margin: 0 }}>You've used your</p>
            <p style={{ fontSize: '2.4rem', fontWeight: 900, margin: '4px 0', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>3 free checks</p>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.3rem', fontWeight: 500, margin: 0 }}>this month</p>
          </div>

          {/* Pricing highlight card */}
          <div className="glass" style={{ borderRadius: '20px', padding: '1.75rem 2rem', textAlign: 'center', width: '100%' }}>
            <span style={{ display: 'inline-block', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#92400e', fontWeight: 700, fontSize: '14px', borderRadius: '999px', padding: '5px 18px', marginBottom: '1rem' }}>
              Unlock More
            </span>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '15px', margin: '0 0 6px' }}>Starting from</p>
            <p style={{ fontSize: '3rem', fontWeight: 900, color: '#fff', margin: '0 0 4px', lineHeight: 1 }}>$1<span style={{ fontSize: '1.3rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>/mo</span></p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>10 credits monthly • Cancel anytime</p>
          </div>
        </motion.div>

        {/* RIGHT — Features + plans + buttons */}
        <motion.div
          style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 140, damping: 20 }}
        >
          {/* Features */}
          <div className="glass" style={{ borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {features.map((f, i) => (
              <motion.div
                key={f}
                style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                initial={{ x: -16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.07 }}
              >
                <Check size={15} color="#4ade80" style={{ flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: '14px' }}>{f}</span>
              </motion.div>
            ))}
          </div>

          {/* Plan selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {plans.map((plan, i) => (
              <motion.button
                key={plan.priceId}
                onClick={() => { setSelectedPlan(plan.priceId); handlePurchase(plan.priceId, user); }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '14px',
                  border: selectedPlan === plan.priceId || plan.popular
                    ? '1.5px solid rgba(251,191,36,0.6)'
                    : '1.5px solid rgba(255,255,255,0.1)',
                  background: plan.popular
                    ? 'rgba(251,191,36,0.1)'
                    : 'rgba(255,255,255,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
                initial={{ x: 16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.08 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#fff', fontWeight: 600, fontSize: '15px' }}>{plan.label}</span>
                  {plan.popular && (
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(251,191,36,0.25)', color: '#fbbf24', letterSpacing: '0.04em' }}>
                      MOST POPULAR
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: plan.popular ? '#fbbf24' : 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '14px' }}>{plan.price}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginLeft: '6px' }}>{plan.credits}</span>
                </div>
              </motion.button>
            ))}
          </div>

          {/* CTA */}
          <motion.button
            onClick={() => handleChoosePlan(user)}
            style={{ width: '100%', height: '52px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#78350f', fontWeight: 700, fontSize: '16px', cursor: 'pointer', boxShadow: '0 6px 28px rgba(251,191,36,0.45)' }}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.75 }}
          >
            Choose a plan that fits you
          </motion.button>

          <motion.button
            onClick={onClose}
            style={{ width: '100%', height: '46px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.82 }}
          >
            Maybe Later
          </motion.button>

          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
            By upgrading, you agree to our Terms of Service and Privacy Policy. Subscription auto-renews monthly.
          </p>
        </motion.div>

      </div>
    </motion.div>
  );
}