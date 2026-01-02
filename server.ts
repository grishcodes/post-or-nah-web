import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import Stripe from 'stripe';
import { VertexAI } from '@google-cloud/vertexai';
import { getUserData, incrementChecksUsed, updatePremiumStatus, addCreditsToUser, updateUserSubscription, auth as adminAuth } from './firebaseAdmin.js';
import { logCreditChange, logPremiumStatusChange, logSubscriptionUpdate, getAllAuditLogs } from './firebaseAuditLog.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || process.env.BACKEND_PORT || 3001;

// Get allowed origin from env, or use wildcard for development
const allowedOrigin = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '*';

// Enhanced CORS configuration for global compatibility
// Handles Safari, private browsing, and strict privacy settings
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // If allowedOrigin is wildcard, allow all
    if (allowedOrigin === '*') return callback(null, true);
    
    // Otherwise check if origin matches
    if (origin === allowedOrigin) return callback(null, true);
    
    // For development, also allow localhost variants
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    
    console.log(`⚠️  CORS rejected origin: ${origin} (allowed: ${allowedOrigin})`);
    callback(new Error('CORS not allowed'));
  },
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
        if (priceId === 'price_1Skb33Fvu58DRDkCqEOvW03I') monthlyCredits = 10;       // $1 Starter
        else if (priceId === 'price_1SiPpnFvu58DRDkCWZQENIqt') monthlyCredits = 50;      // Starter
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
        if (priceId === 'price_1Skb33Fvu58DRDkCqEOvW03I') monthlyCredits = 10;
        else if (priceId === 'price_1SiPpnFvu58DRDkCWZQENIqt') monthlyCredits = 50;
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
  console.warn('⚠️  Skipping Vertex AI initialization - required for image analysis');
} else {
  try {
    // Ensure GOOGLE_APPLICATION_CREDENTIALS is set for local development
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credentialsPath && !credentialsPath.startsWith('/')) {
      // If it's a relative path, resolve it to absolute path
      const absolutePath = path.resolve(process.cwd(), credentialsPath);
      if (fs.existsSync(absolutePath)) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = absolutePath;
        console.log(`✅ Setting GOOGLE_APPLICATION_CREDENTIALS to: ${absolutePath}`);
      } else {
        console.warn(`⚠️  Credentials file not found at: ${absolutePath}`);
        console.warn(`📁 Current working directory: ${process.cwd()}`);
      }
    }

    // Initialize Vertex AI
    vertexAI = new VertexAI({ project, location });
    console.log('✅ Vertex AI configured successfully');
    console.log(`📍 Region: ${location}`);
    console.log(`🤖 Using model: ${modelName}`);
    console.log(`🔐 Project: ${project}`);
  } catch (err) {
    console.error('❌ Failed to initialize Vertex AI:', err);
    console.error('⚠️  Make sure gcloud-credentials.json exists and GOOGLE_APPLICATION_CREDENTIALS env var is set');
  }
}

// --- GLOBAL CALIBRATION: Defines modern social media standards for the AI ---
// This ensures the AI accepts "vibey" photos but rejects "internet junk" AND "bad angles".
const GLOBAL_CALIBRATION = `
**GLOBAL DECISION CALIBRATION (APPLIES TO ALL VIBES):**

1. **THE "REAL CONTENT" FILTER (CRITICAL):**
   - **Memes / Random Screenshots:** Unless it is *extremely* funny or relevant, the verdict is **"NAH"**. Tell them: "This belongs in the group chat, not the Story."
   - **AI Art / Cartoons / Fake Images:** Immediate **"NAH"**. Tell them: "Keep it real, we don't post AI/Google images."
   - **Niche/Random (e.g., Baby Memes):** If it's a random internet picture that isn't about the user's life, it's usually a **"NAH"**.

2. **THE "FLATTERY" FILTER (NEW & CRITICAL):**
   - **Just because a photo is "vibey" doesn't mean the user looks good.**
   - **Reject (TWEAK IT / NAH) if:**
     - The angle is unflattering (accidental double chin, up-the-nose view).
     - The pose is awkward/stiff (deer in headlights look).
     - The outfit is bunching weirdly or looks messy in a bad way.
     - The expression looks forced or uncomfortable.
   - *Rule:* Cool lighting cannot save an awkward photo.

3. **DO NOT penalize a *REAL* photo solely because:**
   - lighting is dark, moody, or flash-heavy
   - the face is partially hidden, turned away, or obscured
   - the image is soft, grainy, or has motion blur
   - the angle is "0.5x" or distorted
   **If it is a real photo of the user/life, these are stylistic choices.**

4. **Face visibility rule:**
   - If the face is not clearly visible BUT the pose, outfit, or energy reads well:
   → This is NOT a reason to downgrade the verdict.

5. **Lighting rule:**
   - Imperfect lighting ≠ bad lighting.
   - Only penalize lighting if the image is unintelligible (pitch black) or if it actively clashes with the specific vibe.

6. **Verdict sanity check:**
   - Ask: "If this was me, would I want this posted? Or do I look bad in it?"
   - If the user looks bad -> **"NAH"**.
`;

// --- MASTER INSTRUCTIONS: THE BRAIN OF THE AI ---
// This block allows the AI to accept modern trends while filtering out low-quality internet clutter.
const MASTER_VISUAL_INSTRUCTIONS = `
**GLOBAL VISUAL CONSTITUTION (GEN Z & SOCIAL MEDIA STANDARDS):**

1. **THE "REALITY CHECK" (FIRST STEP):**
   - **Is this a real photo?** (User, friends, scenery, objects, fit check). -> **PROCEED.**
   - **Is this internet clutter?** (Memes, text screenshots, blurry generic images, AI, cartoons). -> **STOP & REJECT.**
   - *Friend Rule:* Real friends don't let friends post bad memes to their main story.

2. **THE "DO I LOOK GOOD?" CHECK (SECOND STEP):**
   - **Awkwardness is NOT a vibe.** Even if the filter/lighting is cool, check the human subject.
   - **Trigger "NAH" or "TWEAK IT" if:**
     - Eyes are half-closed (blink error).
     - Posture is unflattering (slouching unintentionally).
     - Smile looks painful/fake.
     - Camera angle makes the body look disproportionate in an ugly way.
   - **Be Honest:** If the photo gives "I tried too hard and failed" energy, reject it.

3. **THE "IT'S A VIBE" RULE (FOR REAL PHOTOS ONLY):**
   - **Low Light / Dark / Moody:** This is often a stylistic choice. If the silhouette or mood is cool, it is GOOD.
   - **Flash Photography:** Harsh flash is a TREND. Do not call it "bad lighting."
   - **Grain / Noise / Blur:** Motion blur and film grain are aesthetic choices. Do not penalize them.
   - **Hidden Faces:** Phones covering faces, looking away, or "mystery" angles are POSITIVE stylistic choices.

4. **THE MIRROR SELFIE & FIT CHECK RULE:**
   - **Context:** If the user is in front of a mirror, ignore professional photography rules.
   - **Distance:** Being far away to show the shoes/pants is CORRECT.
   - **Focus:** If the outfit looks good and the stance is chill, the verdict is "POST IT".

5. **VERDICT LOGIC (POST IT vs TWEAK IT vs NAH):**
   - **POST IT:** The photo captures a mood, an outfit, or a moment. The subject looks cool/comfortable.
   - **TWEAK IT:** Use this if the vibe is there, but the **angle or pose** is slightly off (e.g., "Chin up a bit," "Fix your hair").
   - **NAH:** 
     1. The photo is embarrassing (bad angle/look).
     2. **It is a bad meme/screenshot/AI image.**

6. **INTERPRETATION RULE:**
   - **Do NOT look for a rigid checklist.** 
   - Use your judgment to detect the **essence** of the vibe.
   - If a photo breaks a "rule" but still looks cool, it passes.

7. **OUTPUT FORMAT (STRICT):**
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
  - **Content Check:** Is this actually the user's life? Or is it a random meme? (Reject random memes).
  - **Flattery Check:** Does the user actually look good? If the pose is awkward, say TWEAK IT.
  - **The "Story Worthy" Factor:** Does this photo look good at a glance? Is it interesting, funny, or cool?
  - **Authenticity:** Does it feel like a real moment? (Candid energy is better than stiff posing).
  - **Flexibility:** This category is the broadest. It can be a mirror selfie, a scenery shot, a blurry party pic, or a fit check. 
  - **Judgment:** If it looks like something a cool person would post on their story, say "POST IT".

  **TONE EXAMPLES (Guide only):**
  - "POST IT": "Fit is clean and the mirror selfie vibe is chill. Post it."
  - "POST IT": "Wait the low light actually makes this look so mysterious."
  - "TWEAK IT": "Fit is fire, but the pose looks a little stiff/uncomfortable."
  - "NAH": "This meme is kinda 2018... maybe keep it for the group chat."
  - "NAH": "Honestly, the angle isn't doing you justice here. Try taking it from higher up."
  `,

  aesthetic: `
  **ROLE:** You are an artsy, curated influencer friend. You value composition and mood over perfection.

  ${MASTER_VISUAL_INSTRUCTIONS}

  **YOUR TASK:** Analyze for "Aesthetic Core" (Mood > Clarity).
  
  **CORE ENERGY ANALYSIS (Think for yourself):**
  - **Reality Check:** Is this a real photo? (No AI art, no cartoons).
  - **Visual Harmony:** Do the colors and elements feel cohesive? (Look for palettes that match).
  - **The "Art" Factor:** Is the framing interesting? (Negative space, off-center, zoomed-in details).
  - **Texture & Feel:** Does the photo have a tactile quality? (Grain, softness, shadows).
  - **Judgment:** Does this look like it belongs on a curated Pinterest board or a moody feed?

  **TONE EXAMPLES (Guide only):**
  - "POST IT": "the grain and the dark lighting is such a mood."
  - "POST IT": "love how blurry this is, feels like a memory."
  - "NAH": "this looks like an AI generated image, let's keep it real."
  `,

  classyCore: `
  **ROLE:** You are a sophisticated, stylish friend. You value elegance and timelessness.

  ${MASTER_VISUAL_INSTRUCTIONS}

  **YOUR TASK:** Analyze for "Classy Core" (Timeless, Chic, High-End).
  
  **CORE ENERGY ANALYSIS (Think for yourself):**
  - **Class Check:** Memes and screenshots are automatically NOT classy.
  - **Sophistication:** Does the subject carry themselves with grace or confidence? (Slouching = NAH).
  - **The "It Factor":** Does the photo feel expensive or editorial? (This can include candid flash photos or posed shots).
  - **Polish:** Is the outfit or setting elevating the photo? 
  - **Judgment:** Does this give "Old Money," "High Fashion," or "Clean Girl" energy?

  **TONE EXAMPLES (Guide only):**
  - "POST IT": "Giving off-duty model. The flash makes it look so editorial."
  - "TWEAK IT": "Outfit is stunning, but straighten the horizon line."
  - "NAH": "Screenshots aren't really the 'classy' vibe we're going for."
  - "NAH": "The posture feels a bit slouched, stand tall to sell the elegance!"
  `,

  rizzCore: `
  **ROLE:** You are a hype-man friend. You are looking for confidence and magnetic energy.

  ${MASTER_VISUAL_INSTRUCTIONS}

  **YOUR TASK:** Analyze for "Rizz Core" (Charisma, Coolness).
  
  **CORE ENERGY ANALYSIS (Think for yourself):**
  - **Subject Check:** Rizz requires a person. Random cartoons don't have rizz.
  - **Magnetism:** Does the photo pull you in? Is there a sense of allure or "cool"?
  - **Body Language:** Does the subject look comfortable in their skin? (Relaxed, confident, dominant).
  - **The Aura:** Is there a sense of mystery or intensity? (Hidden faces and dark lighting often help this).
  - **Judgment:** Does this photo make the person look attractive? If they look awkward/scared, say NAH.

  **TONE EXAMPLES (Guide only):**
  - "POST IT": "The fact we can't see your face makes this 10x hotter. Mystery rizz."
  - "POST IT": "Shadows are hitting perfectly. Main character energy."
  - "NAH": "Bro, a cartoon character doesn't count as a fit check."
  - "NAH": "You look a little unsure here—confidence is key for rizz!"
  `,

  matchaCore: `
  **ROLE:** You are a cozy, wholesome friend. You love cafes, mornings, and peace.

  ${MASTER_VISUAL_INSTRUCTIONS}

  **YOUR TASK:** Analyze for "Matcha Core" (Soft, Earthy, Calm).
  
  **CORE ENERGY ANALYSIS (Think for yourself):**
  - **Vibe Check:** Low-effort memes ruin the matcha aesthetic. Real photos only.
  - **Serenity:** Does the photo make you feel calm or relaxed?
  - **Softness:** Is the lighting or texture gentle? (Avoid harshness/aggression).
  - **Wholesomeness:** Does it capture a quiet moment? (Morning routines, nature, reading, coffee).
  - **Judgment:** Does this give "Slow Living" or "Cozy Morning" energy?

  **TONE EXAMPLES (Guide only):**
  - "POST IT": "so soft and dreamy, the lighting is perfect."
  - "TWEAK IT": "super cute but the red car in the back ruins the zen palette."
  - "NAH": "this meme is too chaotic for the cozy vibe."
  `,

  badBihVibe: `
  **ROLE:** You are the ultimate hype-bestie. You are sassy, loud, and confident.

  ${MASTER_VISUAL_INSTRUCTIONS}

  **YOUR TASK:** Analyze for "Baddie Vibe" (Confidence, Boldness).
  
  **CORE ENERGY ANALYSIS (Think for yourself):**
  - **Realness:** Bad B*tches post themselves, not random internet pics.
  - **Unapologetic Confidence:** Does the subject look like they own the room? (Main character energy).
  - **Boldness:** Is the photo loud? (Through motion, angles, outfits, or expression).
  - **The "Baddie" Factor:** Does it feel effortless yet fierce?
  - **Judgment:** Does this photo scream confidence? If they look shy/awkward, say TWEAK IT.

  **TONE EXAMPLES (Guide only):**
  - "POST IT": "The blur makes this look so chaotic and fun. Obsessed."
  - "POST IT": "Flash is blinding but you look so good. PERIOD."
  - "NAH": "Not the low-res meme... we need to see YOU shining."
  - "NAH": "You look a little shy in this pose, I need you to OWN it."
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
    // Extract MIME type and base64 data from data URI
    let mimeType = 'image/jpeg'; // default
    let base64Data = imageBase64;
    
    // Check if it's a data URI (data:image/png;base64,...)
    const dataUriMatch = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (dataUriMatch) {
      mimeType = dataUriMatch[1]; // e.g., 'image/png'
      base64Data = dataUriMatch[2]; // the actual base64 string
      console.log(`✅ MIME extracted: ${mimeType}`);
    } else {
      console.log(`⚠️  No MIME match. Using default: ${mimeType}`);
    }

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
                  mimeType: mimeType,
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

// ===== OAuth State Storage for Storage-Partitioned Environments =====
// Stores OAuth state server-side to handle Instagram's in-app browser,
// Safari private mode, and other storage-partitioned environments

interface OAuthState {
  state: string;
  nonce: string;
  createdAt: number;
  expiresAt: number;
}

const oauthStateStore = new Map<string, OAuthState>(); // In production, use Redis or database
const OAUTH_STATE_EXPIRY = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a random string for state parameter
 */
function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create and store OAuth state server-side
 */
function createOAuthState(): OAuthState {
  const state = generateRandomString();
  const nonce = generateRandomString();
  const now = Date.now();
  const oauthState: OAuthState = {
    state,
    nonce,
    createdAt: now,
    expiresAt: now + OAUTH_STATE_EXPIRY,
  };
  oauthStateStore.set(state, oauthState);
  return oauthState;
}

/**
 * Retrieve and validate OAuth state
 */
function getAndValidateOAuthState(state: string): OAuthState | null {
  const oauthState = oauthStateStore.get(state);
  if (!oauthState) return null;
  
  // Check if expired
  if (Date.now() > oauthState.expiresAt) {
    oauthStateStore.delete(state);
    return null;
  }
  
  return oauthState;
}

// Cleanup expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of oauthStateStore.entries()) {
    if (now > state.expiresAt) {
      oauthStateStore.delete(key);
    }
  }
}, 60 * 1000); // Every minute

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

// Get audit logs for a user (admin endpoint)
app.get('/api/audit-logs/:userId', verifyFirebaseToken, verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const logs = await getAllAuditLogs(100);
    const userLogs = logs.filter((log: any) => log.userId === userId);
    res.status(200).json(userLogs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
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

    // Get current balance before update
    const currentUserData = await getUserData(userId);
    const oldBalance = currentUserData.creditsBalance || 0;

    const userData = await addCreditsToUser(userId, credits, source || 'stripe_purchase');

    // Log the credit addition
    await logCreditChange(
      userId,
      'credits_added',
      oldBalance,
      userData.creditsBalance,
      credits,
      `Added via ${source || 'stripe_purchase'}`,
      source || 'stripe_webhook'
    );

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
  console.log('✅ /api/feedback endpoint hit!');
  
  const { imageBase64, category } = req.body;

  if (!imageBase64) {
    console.log('❌ No imageBase64 in request body');
    return res.status(400).json({ error: 'imageBase64 is a required field.' });
  }

  console.log(`📤 Got imageBase64, length: ${imageBase64.length}, category: ${category}`);
  
  // Pass the full data URI so getVertexFeedback can extract MIME type correctly
  const feedback = await getVertexFeedback(imageBase64, category);
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

// ===== OAuth Redirect Endpoints =====
// These endpoints handle OAuth for storage-partitioned environments like Instagram's in-app browser

/**
 * POST /api/oauth/init
 * Initialize OAuth flow and return Google authorization URL
 * Returns state, nonce, and authorization URL to client
 */
app.post('/api/oauth/init', (req: Request, res: Response) => {
  try {
    const state = createOAuthState();
    
    // Google OAuth parameters
    const clientId = process.env.VITE_FIREBASE_API_KEY; // Will use actual OAuth 2.0 client ID
    const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`;
    const scope = 'openid profile email';
    
    // Build authorization URL manually (since we can't rely on Firebase SDK in storage-partitioned envs)
    // This is a simplified version - in production, use proper OAuth libraries
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || clientId || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state: state.state,
      nonce: state.nonce,
      prompt: 'consent',
    });
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    
    console.log(`[OAuth] Initialized OAuth flow with state: ${state.state.substring(0, 8)}...`);
    
    res.json({
      authUrl,
      state: state.state,
      expiresIn: OAUTH_STATE_EXPIRY / 1000, // seconds
    });
  } catch (error) {
    console.error('[OAuth] Init error:', error);
    res.status(500).json({ error: 'Failed to initialize OAuth' });
  }
});

/**
 * POST /api/oauth/callback
 * Handle OAuth callback from Google
 * Exchange authorization code for ID token and verify with Firebase
 */
app.post('/api/oauth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.body;
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }
    
    // Validate state
    const oauthState = getAndValidateOAuthState(state);
    if (!oauthState) {
      return res.status(400).json({ error: 'Invalid or expired state parameter' });
    }
    
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`,
      }).toString(),
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error('[OAuth] Token exchange failed:', error);
      return res.status(400).json({ error: 'Failed to exchange authorization code' });
    }
    
    const tokens = await tokenResponse.json();
    
    // The ID token can be used to sign in with Firebase
    // Client will receive this token and use it with Firebase
    console.log(`[OAuth] Successfully exchanged code for tokens`);
    
    // Clean up the state after use
    oauthStateStore.delete(state);
    
    res.json({
      success: true,
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
    });
  } catch (error) {
    console.error('[OAuth] Callback error:', error);
    res.status(500).json({ error: 'Failed to process OAuth callback' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Backend server running at http://localhost:${port}`);
});
