// Standalone Stripe Checkout server (CommonJS)
// Run with: node stripe-checkout-server.cjs

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.STRIPE_PORT || process.env.PORT || 4242;

// IMPORTANT: The webhook needs the raw body for signature verification.
// Mount the webhook BEFORE the JSON parser middleware.

// POST /webhook
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret || !webhookSecret) {
    console.error('Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET in environment');
    return res.status(500).json({ error: 'Stripe environment not configured' });
  }

  const Stripe = require('stripe');
  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object; // Stripe.Checkout.Session
      const userId = session.client_reference_id || null;

      try {
        // Retrieve line items to get the price ID used
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
        const first = lineItems.data[0];
        const priceId = first?.price?.id || null;

        // Placeholder: add credits based on purchased price
        await addCreditsByPrice(userId, priceId);
      } catch (err) {
        console.error('Error processing checkout.session.completed:', err);
      }
      break;
    }

    default:
      // Unhandled event type
      break;
  }

  res.json({ received: true });
});

// After the webhook route, enable JSON parsing for normal endpoints
app.use(cors());
app.use(express.json());

// POST /create-checkout-session
// Expects: { priceId: string, userId: string }
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

    const Stripe = require('stripe');
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: 'http://localhost:3000/success',
      cancel_url: 'http://localhost:3000/cancel',
      client_reference_id: userId,
      line_items: [
        { price: priceId, quantity: 1 },
      ],
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Placeholder credit function
async function addCredits(userId, credits) {
  // TODO: Integrate with your database (e.g., Firestore) to add credits
  // Example: await incrementUserCredits(userId, credits);
  console.log(`addCredits placeholder → userId=${userId}, credits=+${credits}`);
}

// Map price IDs to credit amounts
async function addCreditsByPrice(userId, priceId) {
  if (!userId || !priceId) {
    console.warn('Missing userId or priceId in addCreditsByPrice');
    return;
  }

  switch (priceId) {
    case '[YOUR_STARTER_PRICE_ID]':
      await addCredits(userId, 10);
      break;
    case '[YOUR_PRO_PRICE_ID]':
      await addCredits(userId, 50);
      break;
    case '[YOUR_PREMIUM_PRICE_ID]':
      await addCredits(userId, 200);
      break;
    default:
      console.warn('Unknown price ID:', priceId);
  }
}

app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Stripe server running' });
});

app.listen(PORT, () => {
  console.log(`⚡ Stripe server listening on http://localhost:${PORT}`);
});
