// Stripe Payment Flow Server
// Usage: node stripe-payment-server.cjs
// Endpoints:
//   POST /create-checkout-session  => returns { url }
//   POST /webhook                  => handles checkout.session.completed
//
// Requires environment variables:
//   STRIPE_SECRET_KEY=sk_test_...
//   STRIPE_WEBHOOK_SECRET=whsec_...
// Optional:
//   PORT=4242 (or STRIPE_PORT)
//   FRONTEND_SUCCESS_URL (defaults to http://localhost:3000/success)
//   FRONTEND_CANCEL_URL  (defaults to http://localhost:3000/cancel)
//
// Price IDs handled (example mapping):
//   Starter: price_1STDj1Fvu58DRDkCT9RStWeM  => +10 credits
//   Pro:     price_1STDjKFvu58DRDkCWcUGtzIx  => +50 credits
//   Premium: price_1STDjpFvu58DRDkC6MatX9YN  => +200 credits

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.STRIPE_PORT || process.env.PORT || 4242;

// ---------------- Webhook Endpoint (raw body) ----------------
// MUST come before express.json() so signature verification works.
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret || !webhookSecret) {
    console.error('[Webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Stripe webhook env not configured' });
  }

  const Stripe = require('stripe');
  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object; // Stripe.Checkout.Session
      const userId = session.client_reference_id || null;
      console.log(`[Webhook] checkout.session.completed for userId=${userId}`);
      try {
        // Retrieve line items to determine purchased price
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
        const purchasedPriceId = lineItems?.data?.[0]?.price?.id || null;
        console.log(`[Webhook] Retrieved priceId=${purchasedPriceId}`);

        // Placeholder fulfillment logic: map price -> credits
        if (userId && purchasedPriceId) {
          switch (purchasedPriceId) {
            case 'price_1STDj1Fvu58DRDkCT9RStWeM': // Starter
              await addCreditsToUser(userId, 10);
              break;
            case 'price_1STDjKFvu58DRDkCWcUGtzIx': // Pro
              await addCreditsToUser(userId, 50);
              break;
            case 'price_1STDjpFvu58DRDkC6MatX9YN': // Premium
              await addCreditsToUser(userId, 200);
              break;
            default:
              console.warn(`[Webhook] Unrecognized priceId: ${purchasedPriceId}`);
          }
        } else {
          console.warn('[Webhook] Missing userId or priceId; skipping credit allocation');
        }
      } catch (err) {
        console.error('[Webhook] Error handling checkout.session.completed:', err);
      }
      break;
    }

    default:
      // Optionally log other events
      // console.log(`[Webhook] Unhandled event type: ${event.type}`);
      break;
  }

  res.status(200).json({ received: true });
});

// ---------------- Normal Middleware ----------------
app.use(cors());
app.use(express.json());

// ---------------- Create Checkout Session ----------------
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId, userId } = req.body || {};
    if (!priceId || !userId) {
      return res.status(400).json({ error: 'Missing priceId or userId' });
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY not set' });
    }

    const successUrl = process.env.FRONTEND_SUCCESS_URL || 'http://localhost:3000/success';
    const cancelUrl = process.env.FRONTEND_CANCEL_URL || 'http://localhost:3000/cancel';

    const Stripe = require('stripe');
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      line_items: [
        { price: priceId, quantity: 1 },
      ],
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[Create Checkout] Error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ---------------- Firebase Integration ----------------
async function addCreditsToUser(userId, amount) {
  try {
    console.log(`[Fulfillment] Adding ${amount} credits to user ${userId}`);
    
    // Call our Firebase backend to add credits
    // Note: This is a server-to-server call, so we use internal communication
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    const response = await fetch(`${backendUrl}/api/user/add-credits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use server secret for internal calls
        'Authorization': `Bearer ${process.env.SERVER_SECRET || 'stripe-webhook-secret'}`
      },
      body: JSON.stringify({
        userId: userId,
        credits: amount,
        source: 'stripe_purchase'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`[Fulfillment] Successfully added credits. New balance: ${result.newBalance || 'unknown'}`);
    return result;
    
  } catch (error) {
    console.error(`[Fulfillment] Failed to add credits for user ${userId}:`, error);
    throw error;
  }
}

// ---------------- Health ----------------
app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Stripe payment server running' });
});

// ---------------- Error Handling ----------------
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - keep server running
});

// ---------------- Start Server ----------------
const server = app.listen(PORT, () => {
  console.log(`🚀 Stripe payment server listening on http://localhost:${PORT}`);
});

// Keep server alive
server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
