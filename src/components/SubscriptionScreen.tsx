import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Crown, Check, X } from 'lucide-react';
import { User } from 'firebase/auth';

interface SubscriptionScreenProps {
  onUpgrade: () => void;
  onClose: () => void;
  user: User | null;
}

// Call Stripe Checkout via your backend
async function handlePurchase(priceId: string, user: User | null) {
  try {
    if (!user) {
      alert('Please sign in to make a purchase');
      return;
    }

    const userId = user.uid;

    const res = await fetch('http://localhost:4242/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId, userId }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { url } = await res.json();
    if (url) {
      window.location.href = url; // redirect to Stripe Checkout
    } else {
      console.error('No URL returned from backend.');
    }
  } catch (err) {
    console.error('handlePurchase error:', err);
  }
}

export function SubscriptionScreen({ onUpgrade, onClose, user }: SubscriptionScreenProps) {
  return (
    <motion.div 
      className="min-h-screen bg-gradient-to-b from-blue-300 to-blue-800 flex flex-col px-6 py-8"
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Close button */}
      <div className="flex justify-end mb-4">
        <Button
          onClick={onClose}
          className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full"
          variant="ghost"
          size="sm"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        {/* Crown Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="bg-yellow-400 p-6 rounded-full shadow-2xl">
            <Crown className="w-12 h-12 text-yellow-800" />
          </div>
        </motion.div>

        {/* Main Message */}
        <motion.div 
          className="text-center space-y-4"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h1 className="text-3xl text-white">You've used your</h1>
          <h2 className="text-4xl text-yellow-300">3 free checks</h2>
          <h3 className="text-2xl text-white">this month</h3>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mt-6">
            <Badge className="bg-yellow-400 text-yellow-800 px-4 py-2 text-lg mb-4">
              Premium Upgrade
            </Badge>
            <h4 className="text-2xl text-white mb-4">Unlock Unlimited Checks</h4>
            <div className="text-5xl text-white mb-2">              $35<span className="text-2xl">/month</span></div>
            <p className="text-blue-100">Cancel anytime</p>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div 
          className="w-full max-w-sm space-y-3"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {[
            'Unlimited photo checks',
            'Faster priority processing',
            'Deeper AI insights',
            'No ads',
            'Simple credits: 1 photo = 1 credit'
          ].map((feature, index) => (
            <motion.div
              key={feature}
              className="flex items-center space-x-3 text-white"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.8 + index * 0.1 }}
            >
              <Check className="w-5 h-5 text-green-300 flex-shrink-0" />
              <span>{feature}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Button */}
        <motion.div
          className="w-full max-w-sm space-y-4"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <Button
            onClick={onUpgrade}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-800 py-4 rounded-2xl text-xl shadow-xl"
          >
            Choose a plan that fits you
          </Button>
          
          <Button
            onClick={onClose}
            className="w-full bg-white/20 hover:bg-white/30 text-white py-3 rounded-2xl border border-white/30"
            variant="ghost"
          >
            Maybe Later
          </Button>
        </motion.div>

        {/* Credit Packs */}
        <motion.div
          className="w-full max-w-sm mt-2 space-y-3"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.1 }}
        >

          <div className="grid grid-cols-1 gap-3">
            <Button
              onClick={() => handlePurchase('price_1STDj1Fvu58DRDkCT9RStWeM', user)}
              className="w-full bg-white text-blue-800 hover:bg-white/90 py-3 rounded-xl shadow"
            >
              Starter • 10 credits
            </Button>
            <Button
              onClick={() => handlePurchase('price_1STDjKFvu58DRDkCWcUGtzIx', user)}
              className="w-full bg-white text-blue-800 hover:bg-white/90 py-3 rounded-xl shadow"
            >
              Pro • 50 credits
            </Button>
            <Button
              onClick={() => handlePurchase('price_1STDjpFvu58DRDkC6MatX9YN', user)}
              className="w-full bg-white text-blue-800 hover:bg-white/90 py-3 rounded-xl shadow"
            >
              Premium • 200 credits
            </Button>
          </div>
        </motion.div>

        <p className="text-xs text-blue-200 text-center max-w-xs">
          By upgrading, you agree to our Terms of Service and Privacy Policy. 
          Subscription auto-renews monthly.
        </p>
      </div>
    </motion.div>
  );
}