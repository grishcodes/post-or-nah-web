import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import Stripe from 'stripe';
import { VertexAI } from '@google-cloud/vertexai';
import { getUserData, incrementChecksUsed, updatePremiumStatus, addCreditsToUser, updateUserSubscription, auth as adminAuth } from './firebaseAdmin.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || process.env.BACKEND_PORT || 3001;

// Get allowed origin from env, or use wildcard for development
const allowedOrigin = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '*';

// Enhanced CORS configuration for global compatibility
// Handles Safari, private browsing, and strict privacy settings
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
  ],
  exposedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Total-Count',
    'X-Page-Number',
  ],
  maxAge: 86400, // 24 hours - reduces preflight requests
}));

// Add additional headers for browser compatibility
app.use((req: Request, res: Response, next: NextFunction) => {
  // Allow this resource to be used in cross-origin contexts
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  // Support for private browsing / incognito modes
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  // Charset for better international support
  res.header('Content-Type', 'application/json; charset=utf-8');
  next();
});

// --- Stripe Webhook (Must be before express.json) ---
app.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret || !webhookSecret) {
    console.error('[Webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Stripe webhook env not configured' });
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: '2025-10-29.clover' });

  const sig = req.headers['stripe-signature'] as string;
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed (for recurring subscriptions)
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;
    const subscriptionId = session.subscription as string;
    console.log(`[Webhook] checkout.session.completed for userId=${userId}, subscriptionId=${subscriptionId}`);

    if (userId && subscriptionId) {
      try {
        // Get subscription details to determine tier and monthly credits
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price?.id;
        console.log(`[Webhook] Subscription priceId=${priceId}`);

        // Map new recurring price IDs to monthly credits
        let monthlyCredits = 0;
        if (priceId === 'price_1SiPpnFvu58DRDkCWZQENIqt') monthlyCredits = 50;      // Starter
        else if (priceId === 'price_1SiRKCFvu58DRDkCGoZeG8Er') monthlyCredits = 200; // Pro
        else if (priceId === 'price_1SiPqnFvu58DRDkCWwdway9a') monthlyCredits = 999999; // Unlimited (soft cap)

        if (monthlyCredits > 0) {
          // Set subscription tier in Firestore
          await updateUserSubscription(userId, {
            subscriptionId,
            tier: priceId === 'price_1SiPpnFvu58DRDkCWZQENIqt' ? 'starter' 
                  : priceId === 'price_1SiPqIFvu58DRDkC7UQP8hiJ' ? 'pro' 
                  : 'unlimited',
            monthlyCredits,
            creditsBalance: monthlyCredits,
            billingCycleStart: new Date(),
          });
          console.log(`[Webhook] Set subscription for user ${userId}: ${monthlyCredits} monthly credits`);
        }
      } catch (err) {
        console.error('[Webhook] Error handling checkout.session.completed:', err);
      }
    }
  }

  // Handle customer.subscription.updated (renewal, plan change, cancellation)
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    const priceId = subscription.items.data[0]?.price?.id;
    
    console.log(`[Webhook] customer.subscription.updated: customerId=${customerId}, status=${subscription.status}`);

    try {
      // Get the user ID from Stripe metadata (we'll set this during checkout)
      const userId = subscription.metadata?.userId;
      if (!userId) {
        console.warn('[Webhook] No userId in subscription metadata');
        return res.status(200).json({ received: true });
      }

      if (subscription.status === 'active' && priceId) {
        // Subscription renewed or plan changed - reset monthly credits
        let monthlyCredits = 0;
        if (priceId === 'price_1SiPpnFvu58DRDkCWZQENIqt') monthlyCredits = 50;
        else if (priceId === 'price_1SiRKCFvu58DRDkCGoZeG8Er') monthlyCredits = 200;
        else if (priceId === 'price_1SiPqnFvu58DRDkCWwdway9a') monthlyCredits = 999999;

        if (monthlyCredits > 0) {
          await updateUserSubscription(userId, {
            subscriptionId: subscription.id,
            tier: priceId === 'price_1SiPpnFvu58DRDkCWZQENIqt' ? 'starter' 
                  : priceId === 'price_1SiRKCFvu58DRDkCGoZeG8Er' ? 'pro' 
                  : 'unlimited',
            monthlyCredits,
            creditsBalance: monthlyCredits,
            billingCycleStart: new Date(),
          });
          console.log(`[Webhook] Renewed subscription for user ${userId}: reset to ${monthlyCredits} credits`);
        }
      } else if (subscription.status === 'canceled' || subscription.status === 'past_due') {
        // Mark subscription as inactive
        await updateUserSubscription(userId, {
          subscriptionId: subscription.id,
          tier: 'none',
          status: subscription.status,
        });
        console.log(`[Webhook] Subscription ${subscription.status} for user ${userId}`);
      }
    } catch (err) {
      console.error('[Webhook] Error handling customer.subscription.updated:', err);
    }
  }

  res.status(200).json({ received: true });
});

app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images

// --- Google Vertex AI Configuration ---
const project = process.env.GCLOUD_PROJECT;
const location = process.env.GCLOUD_LOCATION || 'us-central1';
const modelName = process.env.GCLOUD_MODEL || 'gemini-2.5-flash';

let vertexAI: VertexAI | null = null;

if (!project) {
  console.warn('⚠️  WARNING: GCLOUD_PROJECT not set in env vars');
} else {
  try {
    // Cloud Run automatically provides credentials - no JSON file needed
    vertexAI = new VertexAI({ project, location });
    console.log('✅ Vertex AI configured');
    console.log(`📍 Region: ${location}`);
    console.log(`🤖 Using model: ${modelName}`);
  } catch (err) {
    console.error('❌ Failed to initialize Vertex AI:', err);
  }
}

// --- GLOBAL CALIBRATION: Defines modern social media standards for the AI ---
// This ensures the AI accepts "vibey" photos (dark, grainy, faceless) as valid.
const GLOBAL_CALIBRATION = `
**GLOBAL DECISION CALIBRATION (APPLIES TO ALL VIBES):**

1. **DO NOT penalize a photo solely because:**
   - lighting is dark, moody, or flash-heavy
   - the face is partially hidden, turned away, or obscured
   - the image is soft, grainy, or has motion blur
   - the angle is "0.5x" or distorted
   **These are NORMAL modern posting styles and should be treated as intentional.**

2. **Only trigger "TWEAK IT" if:**
   - A SMALL, CLEAR change (cropping, straightening) would noticeable improve it.
   - AND the photo does NOT already succeed for the selected vibe.
   *If the photo already works "as-is" for the vibe, the verdict must be "POST IT".*

3. **Face visibility rule:**
   - If the face is not clearly visible BUT the pose, outfit, or energy reads well:
   → This is NOT a reason to downgrade the verdict.

4. **Lighting rule (VERY IMPORTANT):**
   - Imperfect lighting ≠ bad lighting.
   - Only penalize lighting if the image is unintelligible (pitch black) or if it actively clashes with the specific vibe (e.g., harsh neon light in a soft matcha aesthetic).

5. **Verdict sanity check:**
   - Before outputting, ask: "If my friend posted this right now, would I tell them to delete it?"
   - If you wouldn't actually DM them a fix, do NOT choose "TWEAK IT".
`;

// --- MASTER INSTRUCTIONS: THE BRAIN OF THE AI ---
// This block allows the AI to accept modern trends while thinking broadly about the vibe.
const MASTER_VISUAL_INSTRUCTIONS = `
**GLOBAL VISUAL CONSTITUTION (GEN Z & SOCIAL MEDIA STANDARDS):**

1. **THE "IT'S A VIBE" RULE:**
   - **Low Light / Dark / Moody:** This is often a stylistic choice. If the silhouette or mood is cool, it is GOOD.
   - **Flash Photography:** Harsh flash is a TREND. Do not call it "bad lighting."
   - **Grain / Noise / Blur:** Motion blur and film grain are aesthetic choices. Do not penalize them.
   - **Hidden Faces:** Phones covering faces, looking away, or "mystery" angles are POSITIVE stylistic choices.

2. **THE MIRROR SELFIE & FIT CHECK RULE:**
   - **Context:** If the user is in front of a mirror (gym, hallway, bedroom), ignore professional photography rules.
   - **Distance:** Being far away to show the shoes/pants is CORRECT.
   - **Focus:** If the outfit looks good and the stance is chill, the verdict is "POST IT".

3. **VERDICT LOGIC (POST IT vs TWEAK IT):**
   - **POST IT:** The photo captures a mood, an outfit, or a moment. It feels authentic.
   - **TWEAK IT:** ONLY use this if there is a **fixable disaster** (e.g., "Your fly is open," "There is a pile of garbage," "It is pitch black").
   - **NAH:** The photo is embarrassing or completely unusable.

4. **INTERPRETATION RULE (CRITICAL):**
   - **Do NOT look for a rigid checklist.** 
   - Use your judgment to detect the **essence** of the vibe.
   - If a photo breaks a "rule" but still looks cool, it passes.

5. **OUTPUT FORMAT (STRICT):**
   - Return valid JSON: { "verdict": "POST IT" | "TWEAK IT" | "NAH", "comment": "string", "reasons": ["string", "string"] }
   - **Reasons:** Must be 2-4 ULTRA-SHORT visual observations (max 6 words).
`;

// --- Vibe-specific prompt suite ---
const vibePromptsFinal: Record<string, string> = {
  general: `
  **ROLE:** You are the user's best friend. Honest, casual, and supportive.

  ${MASTER_VISUAL_INSTRUCTIONS}

  **YOUR TASK:** Analyze this photo for "IG Story Vibe" (Casual, Quick, Cool).
  
  **CORE ENERGY ANALYSIS (Think for yourself):**
  - **The "Story Worthy" Factor:** Does this photo look good at a glance? Is it interesting, funny, or cool?
  - **Authenticity:** Does it feel like a real moment? (Candid energy is better than stiff posing).
  - **Flexibility:** This category is the broadest. It can be a mirror selfie, a scenery shot, a blurry party pic, or a fit check. 
  - **Judgment:** If it looks like something a cool person would post on their story, say "POST IT".

  **TONE EXAMPLES (Guide only):**
  - "POST IT": "Fit is clean and the mirror selfie vibe is chill. Post it."
  - "POST IT": "Wait the low light actually makes this look so mysterious."
  - "TWEAK IT": "Fit is fire, but move the trash bag behind you."
  `,

  aesthetic: `
  **ROLE:** You are an artsy, curated influencer friend. You value composition and mood over perfection.

  ${MASTER_VISUAL_INSTRUCTIONS}

  **YOUR TASK:** Analyze for "Aesthetic Core" (Mood > Clarity).
  
  **CORE ENERGY ANALYSIS (Think for yourself):**
  - **Visual Harmony:** Do the colors and elements feel cohesive? (Look for palettes that match).
  - **The "Art" Factor:** Is the framing interesting? (Negative space, off-center, zoomed-in details).
  - **Texture & Feel:** Does the photo have a tactile quality? (Grain, softness, shadows).
  - **Judgment:** Does this look like it belongs on a curated Pinterest board or a moody feed?

  **TONE EXAMPLES (Guide only):**
  - "POST IT": "the grain and the dark lighting is such a mood."
  - "POST IT": "love how blurry this is, feels like a memory."
  - "TWEAK IT": "love the vibe but maybe crop out the messy floor."
  `,

  classyCore: `
  **ROLE:** You are a sophisticated, stylish friend. You value elegance and timelessness.

  ${MASTER_VISUAL_INSTRUCTIONS}

  **YOUR TASK:** Analyze for "Classy Core" (Timeless, Chic, High-End).
  
  **CORE ENERGY ANALYSIS (Think for yourself):**
  - **Sophistication:** Does the subject carry themselves with grace or confidence?
  - **The "It Factor":** Does the photo feel expensive or editorial? (This can include candid flash photos or posed shots).
  - **Polish:** Is the outfit or setting elevating the photo? 
  - **Judgment:** Does this give "Old Money," "High Fashion," or "Clean Girl" energy?

  **TONE EXAMPLES (Guide only):**
  - "POST IT": "Giving off-duty model. The flash makes it look so editorial."
  - "TWEAK IT": "Outfit is stunning, but straighten the horizon line."
  - "NAH": "The background clutter distracts from the elegance."
  `,

  rizzCore: `
  **ROLE:** You are a hype-man friend. You are looking for confidence and magnetic energy.

  ${MASTER_VISUAL_INSTRUCTIONS}

  **YOUR TASK:** Analyze for "Rizz Core" (Charisma, Coolness).
  
  **CORE ENERGY ANALYSIS (Think for yourself):**
  - **Magnetism:** Does the photo pull you in? Is there a sense of allure or "cool"?
  - **Body Language:** Does the subject look comfortable in their skin? (Relaxed, confident, dominant).
  - **The Aura:** Is there a sense of mystery or intensity? (Hidden faces and dark lighting often help this).
  - **Judgment:** Does this photo make the person look attractive or undeniably cool?

  **TONE EXAMPLES (Guide only):**
  - "POST IT": "The fact we can't see your face makes this 10x hotter. Mystery rizz."
  - "POST IT": "Shadows are hitting perfectly. Main character energy."
  - "TWEAK IT": "Pose is cool, but maybe crop it closer to you to show off the fit."
  `,

  matchaCore: `
  **ROLE:** You are a cozy, wholesome friend. You love cafes, mornings, and peace.

  ${MASTER_VISUAL_INSTRUCTIONS}

  **YOUR TASK:** Analyze for "Matcha Core" (Soft, Earthy, Calm).
  
  **CORE ENERGY ANALYSIS (Think for yourself):**
  - **Serenity:** Does the photo make you feel calm or relaxed?
  - **Softness:** Is the lighting or texture gentle? (Avoid harshness/aggression).
  - **Wholesomeness:** Does it capture a quiet moment? (Morning routines, nature, reading, coffee).
  - **Judgment:** Does this give "Slow Living" or "Cozy Morning" energy?

  **TONE EXAMPLES (Guide only):**
  - "POST IT": "so soft and dreamy, the lighting is perfect."
  - "TWEAK IT": "super cute but the red car in the back ruins the zen palette."
  - "NAH": "a bit too sharp and high-contrast for the cozy vibe."
  `,

  badBihVibe: `
  **ROLE:** You are the ultimate hype-bestie. You are sassy, loud, and confident.

  ${MASTER_VISUAL_INSTRUCTIONS}

  **YOUR TASK:** Analyze for "Bad Bih Vibe" (Confidence, Boldness).
  
  **CORE ENERGY ANALYSIS (Think for yourself):**
  - **Unapologetic Confidence:** Does the subject look like they own the room? (Main character energy).
  - **Boldness:** Is the photo loud? (Through motion, angles, outfits, or expression).
  - **The "Baddie" Factor:** Does it feel effortless yet fierce?
  - **Judgment:** Does this photo scream confidence and attitude?

  **TONE EXAMPLES (Guide only):**
  - "POST IT": "The blur makes this look so chaotic and fun. Obsessed."
  - "POST IT": "Flash is blinding but you look so good. PERIOD."
  - "TWEAK IT": "Fit is fire, but the pose feels a little shy."
  `,
};

function normalizeVibeKey(category?: string): string {
  if (!category) return 'general';
  const lower = category.toLowerCase().replace(/[^a-z]/g, '');
  
  // Map variants to canonical keys
  if (lower === 'general' || lower === 'vibecheck') return 'general';
  if (lower === 'aesthetic' || lower === 'aestheticcore') return 'aesthetic';
  if (lower === 'classy' || lower === 'classycore') return 'classyCore';
  if (lower === 'rizz' || lower === 'rizzcore') return 'rizzCore';
  if (lower === 'matcha' || lower === 'matchacore') return 'matchaCore';
  if (lower === 'badbih' || lower === 'badbihvibe' || lower === 'baddie') return 'badBihVibe';
  
  // Default to general if unknown
  return 'general';
}

function mapVerdictToUI(verdictRaw: string): string {
  const v = verdictRaw.trim().toUpperCase();
  if (v === 'POST IT') return 'Post ✅';
  if (v === 'NAH') return 'Nah ❌';
  if (v === 'TWEAK IT') return 'Tweak ✏️';
  // Fallback: try to infer
  if (v.includes('POST')) return 'Post ✅';
  if (v.includes('NAH')) return 'Nah ❌';
  return verdictRaw;
}

// --- Function to get feedback from Vertex AI Gemini ---
async function getVertexFeedback(imageBase64: string, category?: string): Promise<any> {
  if (!vertexAI) {
    return {
      verdict: 'Error ⚠️',
      suggestion: 'Vertex AI not configured. Check GCLOUD_* env vars and credentials JSON.',
      raw: 'Vertex AI not initialized',
    };
  }

  try {
    // Remove any data URI prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    console.log('📤 Calling Vertex AI Gemini (vision)...');
    console.log(`🏷️  Category: ${category || 'none'}`);

    const key = normalizeVibeKey(category);
    const selectedPrompt = vibePromptsFinal[key];

    const model = vertexAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: selectedPrompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256,
      },
    });

    const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const responseText = text.trim();
    console.log('✅ Vertex response:', responseText);

    // Try to parse structured JSON { verdict, comment }
    let parsed: any = null;
    try {
      // Strip code fences if present
      const noFences = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      // Extract first JSON object if wrapped
      const start = noFences.indexOf('{');
      const end = noFences.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const jsonSlice = noFences.slice(start, end + 1);
        parsed = JSON.parse(jsonSlice);
      }
    } catch {
      parsed = null;
    }

    if (parsed && (parsed.verdict || parsed.comment)) {
      const mappedVerdict = mapVerdictToUI(String(parsed.verdict || ''));
      const suggestion = String(parsed.comment || '').trim();
      return {
        verdict: mappedVerdict,
        suggestion,
        raw: result.response,
      };
    }

    // Fallback to old heuristic if JSON parse failed
    const lower = responseText.toLowerCase();
    const isPost = lower.includes('post') && !lower.includes('nah');
    const verdict = isPost ? 'Post ✅' : 'Nah ❌';
    const suggestion = responseText;

    return { verdict, suggestion, raw: result.response };
  } catch (error) {
    console.error('❌ Error calling Vertex AI:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return {
      verdict: 'Error ⚠️',
      suggestion: 'Could not analyze image. Verify Vertex AI API enabled, region/model, and service account roles.',
      raw: msg,
    };
  }
}

// Middleware to verify Firebase token
interface AuthenticatedRequest extends Request {
  user?: { uid: string };
}

async function verifyFirebaseToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = { uid: decodedToken.uid };
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Optional admin guard: set ADMIN_UIDS in .env as comma-separated Firebase UIDs
const adminUIDs = (process.env.ADMIN_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean);

function verifyAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const uid = req.user?.uid;
  if (!uid || !adminUIDs.includes(uid)) {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

// API Endpoints

// Health check endpoint - helps detect connectivity issues
app.get('/api/health', (req: Request, res: Response) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Backend is running',
    vertexAI: vertexAI ? 'configured' : 'not configured',
    environment: process.env.NODE_ENV || 'development',
  };
  res.status(200).json(healthCheck);
});

// Ping endpoint for quick connectivity tests (minimal response)
app.get('/api/ping', (req: Request, res: Response) => {
  res.status(200).json({ ok: true });
});

// Get user subscription data
app.get('/api/user/subscription', verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const userData = await getUserData(uid);
    console.log(`📊 Returning subscription data for ${uid}:`, JSON.stringify(userData));
    res.status(200).json({
      checksUsed: userData.checksUsed,
      creditsBalance: userData.creditsBalance || 0,
      isPremium: userData.isPremium,
      subscriptionEndDate: userData.subscriptionEndDate,
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Increment user checks (called after successful feedback)
app.post('/api/user/increment-check', verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const userData = await incrementChecksUsed(uid);
    res.status(200).json({
      checksUsed: userData.checksUsed,
      creditsBalance: userData.creditsBalance || 0,
      isPremium: userData.isPremium,
    });
  } catch (error) {
    console.error('Error incrementing checks:', error);
    res.status(500).json({ error: 'Failed to increment checks' });
  }
});

// Update premium status - ADMIN ONLY (no client upgrades)
app.post('/api/user/update-premium', verifyFirebaseToken, verifyAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { isPremium, stripeCustomerId, subscriptionEndDate } = req.body;

    const userData = await updatePremiumStatus(
      uid,
      isPremium,
      stripeCustomerId,
      subscriptionEndDate ? new Date(subscriptionEndDate) : undefined
    );

    res.status(200).json({
      checksUsed: userData.checksUsed,
      isPremium: userData.isPremium,
      subscriptionEndDate: userData.subscriptionEndDate,
    });
  } catch (error) {
    console.error('Error updating premium status:', error);
    res.status(500).json({ error: 'Failed to update premium status' });
  }
});

// Add credits to user (called by Stripe webhook)
app.post('/api/user/add-credits', async (req: Request, res: Response) => {
  try {
    const { userId, credits, source } = req.body;

    // Verify server secret for internal calls
    const authHeader = req.headers.authorization;
    const serverSecret = process.env.SERVER_SECRET || 'stripe-webhook-secret';

    if (!authHeader || authHeader !== `Bearer ${serverSecret}`) {
      return res.status(401).json({ error: 'Invalid server secret' });
    }

    if (!userId || typeof credits !== 'number' || credits <= 0) {
      return res.status(400).json({ error: 'Invalid userId or credits amount' });
    }

    const userData = await addCreditsToUser(userId, credits, source || 'stripe_purchase');

    res.status(200).json({
      success: true,
      newBalance: userData.creditsBalance,
      checksUsed: userData.checksUsed,
      isPremium: userData.isPremium,
    });
  } catch (error) {
    console.error('Error adding credits:', error);
    res.status(500).json({ error: 'Failed to add credits' });
  }
});

app.post('/api/feedback', async (req: Request, res: Response) => {
  const { imageBase64, category } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is a required field.' });
  }

  const pureBase64 = imageBase64.split(',').pop();
  if (!pureBase64) {
    return res.status(400).json({ error: 'Invalid base64 string format.' });
  }

  console.log('Received image for feedback. Calling Vertex AI Gemini...');
  const feedback = await getVertexFeedback(pureBase64, category);
  res.status(200).json(feedback);
});

// --- Stripe Checkout Session ---
app.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const { priceId, userId } = req.body;
    if (!priceId || !userId) {
      return res.status(400).json({ error: 'Missing priceId or userId' });
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY not set' });
    }

    // Use environment variables for success/cancel URLs
    const successUrl = process.env.FRONTEND_SUCCESS_URL || 'http://localhost:5000/success';
    const cancelUrl = process.env.FRONTEND_CANCEL_URL || 'http://localhost:5000/cancel';

    const stripe = new Stripe(stripeSecret, { apiVersion: '2025-10-29.clover' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',  // Changed from 'payment' to 'subscription' for recurring billing
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      customer_email: req.body.customerEmail, // Optional: pre-fill customer email
      subscription_data: {
        metadata: {
          userId, // Include userId in subscription metadata for webhook handling
        },
      },
      line_items: [
        { price: priceId, quantity: 1 },
      ],
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[Create Checkout] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: 'Failed to create checkout session', detail: message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Backend server running at http://localhost:${port}`);
});
