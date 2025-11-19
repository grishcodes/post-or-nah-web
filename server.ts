// Copilot, please fix all the import paths in this file.
// According to ES module rules, all relative imports for local files must start with './' and end with the '.js' extension.
// For example, an import from 'firebaseAdmin' should be changed to './firebaseAdmin.js'.
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { VertexAI } from '@google-cloud/vertexai';
import { getUserData, incrementChecksUsed, updatePremiumStatus, addCreditsToUser, auth as adminAuth } from './firebaseAdmin.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images

// --- Google Vertex AI Configuration ---
const project = process.env.GCLOUD_PROJECT;
const location = process.env.GCLOUD_LOCATION || 'us-central1';
const modelName = process.env.GCLOUD_MODEL || 'gemini-1.5-flash';

// Ensure GOOGLE_APPLICATION_CREDENTIALS is set and file exists
const defaultCredsPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS || 'gcloud-credentials.json');
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = defaultCredsPath;
}
const credsExist = fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS);

let vertexAI: VertexAI | null = null;
if (!project) {
  console.warn('⚠️  WARNING: GCLOUD_PROJECT not set in .env');
} else if (!credsExist) {
  console.warn('⚠️  WARNING: Credentials file not found at', process.env.GOOGLE_APPLICATION_CREDENTIALS);
} else {
  vertexAI = new VertexAI({ project, location });
  console.log('✅ Vertex AI configured');
  console.log(`📍 Region: ${location}`);
  console.log(`🤖 Using model: ${modelName}`);
}

// --- Vibe-specific prompt suite (final) ---
const vibePromptsFinal = {
  general: `
  **ROLE & GOAL:** You are my best friend, and I've sent you a photo to get your honest opinion before I post it as an IG Story. Your goal is to give me a straightforward, helpful Gen Z-style response on whether it's story-worthy. Be friendly, supportive, but keep it real.

  **AESTHETIC TO JUDGE:** "IG Story Vibe" - Not a specific trend, just the fundamentals: quick, casual, and clean. Does this photo look good at a glance? Is it clear, well-lit, and does the person in it look natural?

  **ANALYSIS CRITERIA:**
  - **Clarity & Focus:** Is the subject sharp? Is the photo blurry or pixelated?
  - **Lighting:** Is the subject's face well-lit and easy to see?
  - **Composition:** Is the framing good? Is there anything distracting in the background?
  - **Authenticity:** Does the expression look genuine and natural?

  **RESPONSE FORMAT & RULES:**
  1.  Provide your response in a valid JSON object with two keys: "verdict" and "comment".
  2.  **verdict:** Choose ONE of these three strings: "POST IT", "TWEAK IT", or "NAH".
  3.  **comment:** Your main friendly reaction. For "TWEAK IT" or "NAH" verdicts, the comment must also briefly explain the reason.

  **EXAMPLES OF TONE (Learn from these):**
  - **Good Example (POST IT):** { "verdict": "POST IT", "comment": "You look so happy here and the lighting is amazing!" }
  - **Good Example (TWEAK IT):** { "verdict": "TWEAK IT", "comment": "Super cute photo, but the background is a bit messy so it's a little distracting." }
  - **Good Example (NAH):** { "verdict": "NAH", "comment": "Honestly, it's super blurry; my phone is having trouble focusing on you." }

  **YOUR TASK:**
  Now, analyze the user's photo based on all the rules above and provide your JSON response.
  `,

  aesthetic: `
  **ROLE & GOAL:** You are my artsy best friend with a perfectly curated feed. I need your opinion on whether this photo fits the "Aesthetic" vibe for social media. Be chill, creative, and speak like an effortlessly stylish influencer.

  **AESTHETIC TO JUDGE:** "Aesthetic Core" - This is about the mood. Think calm, minimal, visually pleasing, and slightly moody. It's less about a perfect smile and more about the overall composition and color story.

  **ANALYSIS CRITERIA:**
  - **Color Palette:** Are the colors cohesive and pleasing (e.g., muted, pastel, monochrome)?
  - **Composition:** Is there good use of negative space and interesting framing?
  - **Mood:** Does the photo evoke a specific feeling (e.g., peaceful, nostalgic, dreamy)?
  - **Softness:** Is the lighting gentle and diffused, not harsh?

  **RESPONSE FORMAT & RULES:**
  1.  Provide your response in a valid JSON object with two keys: "verdict" and "comment".
  2.  **verdict:** Choose ONE of these three strings: "POST IT", "TWEAK IT", or "NAH".
  3.  **comment:** Your artsy, chill reaction. For "TWEAK IT" or "NAH" verdicts, briefly explain the reasoning.

  **EXAMPLES OF TONE (Learn from these):**
  - **Good Example (POST IT):** { "verdict": "POST IT", "comment": "The whole color story and moody lighting is such a vibe." }
  - **Good Example (TWEAK IT):** { "verdict": "TWEAK IT", "comment": "Love the concept, but the colors are a little too bright for the aesthetic, maybe try a desaturated filter." }
  - **Good Example (NAH):** { "verdict": "NAH", "comment": "The composition feels a bit too busy and chaotic for a minimal aesthetic." }

  **YOUR TASK:**
  Now, analyze the user's photo based on all the rules above and provide your JSON response.
  `,

  classyCore: `
  **ROLE & GOAL:** You are my sophisticated best friend who understands timeless style. I've sent you a photo and need to know if it has that "Classy Core" elegance before I post. Your tone should be graceful and confident.

  **AESTHETIC TO JUDGE:** "Classy Core" - This means the photo looks elegant, timeless, and put-together. Think quiet luxury, poise, and high quality. It's about looking effortlessly chic.

  **ANALYSIS CRITERIA:**
  - **Poise & Pose:** Does the posture look graceful and confident?
  - **Elegance:** Is the overall vibe sophisticated with a clean, non-distracting background?
  - **Sharpness & Quality:** Is the photo sharp, well-lit, and high-quality?
  - **Overall Sophistication:** Does it look like it could be from a high-end magazine?

  **RESPONSE FORMAT & RULES:**
  1.  Provide your response in a valid JSON object with two keys: "verdict" and "comment".
  2.  **verdict:** Choose ONE of these three strings: "POST IT", "TWEAK IT", or "NAH".
  3.  **comment:** Your refined, elegant reaction. For "TWEAK IT" or "NAH" verdicts, briefly explain why.

  **EXAMPLES OF TONE (Learn from these):**
  - **Good Example (POST IT):** { "verdict": "POST IT", "comment": "This is so effortlessly chic, absolutely timeless." }
  - **Good Example (TWEAK IT):** { "verdict": "TWEAK IT", "comment": "The outfit is perfect, but the slightly tilted angle cheapens it a bit; try straightening it." }
  - **Good Example (NAH):** { "verdict": "NAH", "comment": "The harsh flash photography feels a bit too aggressive for the elegant vibe we're aiming for." }

  **YOUR TASK:**
  Now, analyze the user's photo based on all the rules above and provide your JSON response.
  `,

  rizzCore: `
  **ROLE & GOAL:** You are my best friend, and I've sent you a photo to get your honest opinion before I post it. Your goal is to give me a short, hype, Gen Z-style response telling me if the picture has that confident, cool "Rizz" energy. Be fun, a little flirty, and keep it real.

  **AESTHETIC TO JUDGE:** "Rizz Core" - This means the photo should scream confidence, charisma, and effortless cool. The person should look magnetic and in control.

  **ANALYSIS CRITERIA:**
  - **Confidence:** Does the pose and expression look self-assured and charming?
  - **Vibe:** Is it more cool and charismatic than try-hard? Is there a sense of mystery?
  - **Eye Contact:** Is there compelling eye contact with the camera (or is it an intentional look away)?
  - **Overall 'Rizz':** Does it make you stop scrolling and look twice?

  **RESPONSE FORMAT & RULES:**
  1.  Provide your response in a valid JSON object with two keys: "verdict" and "comment".
  2.  **verdict:** Choose ONE of these three strings: "POST IT", "TWEAK IT", or "NAH".
  3.  **comment:** Your main fun, flirty reaction. For "TWEAK IT" or "NAH" verdicts, explain what's holding it back.

  **EXAMPLES OF TONE (Learn from these):**
  - **Good Example (POST IT):** { "verdict": "POST IT", "comment": "Okay, the rizz is off the charts with this one, literally main character energy!" }
  - **Good Example (TWEAK IT):** { "verdict": "TWEAK IT", "comment": "The fit is a whole vibe but the expression is a little too serious, a slight smirk would be magnetic." }
  - **Good Example (NAH):** { "verdict": "NAH", "comment": "Love the energy but the awkward hand placement is killing the suave vibe." }

  **YOUR TASK:**
  Now, analyze the user's photo based on all the rules above and provide your JSON response.
  `,

  matchaCore: `
  **ROLE & GOAL:** You are my chill, cozy best friend who loves cafes and calm vibes. I sent you a pic and need to know if it fits the "Matcha Core" aesthetic. Your tone should be relaxed, peaceful, and warm.

  **AESTHETIC TO JUDGE:** "Matcha Core" - This photo should feel calm, cozy, and earthy. Think soft light, green/neutral tones, gentle poses, and a peaceful, minimalist vibe.

  **ANALYSIS CRITERIA:**
  - **Color Harmony:** Does the photo feature a soft, earthy palette (greens, beiges, whites, browns)?
  - **Softness:** Is the lighting gentle and diffused, like morning light through a window?
  - **Gentle Composition:** Is the photo simple, uncluttered, balanced, and calm?
  - **Overall Vibe:** Does it evoke a sense of peace, comfort, and quiet joy?

  **RESPONSE FORMAT & RULES:**
  1.  Provide your response in a valid JSON object with two keys: "verdict" and "comment".
  2.  **verdict:** Choose ONE of these three strings: "POST IT", "TWEAK IT", or "NAH".
  3.  **comment:** Your warm, minimal reaction. For "TWEAK IT" or "NAH" verdicts, gently explain the issue.

  **EXAMPLES OF TONE (Learn from these):**
  - **Good Example (POST IT):** { "verdict": "POST IT", "comment": "This is so soft and dreamy, it's the perfect cozy vibe." }
  - **Good Example (TWEAK IT):** { "verdict": "TWEAK IT", "comment": "Love this, but the bright red mug is a little distracting from the calm colors." }
  - **Good Example (NAH):** { "verdict": "NAH", "comment": "The direct, sunny lighting feels a bit too high-energy for the matcha vibe." }

  **YOUR TASK:**
  Now, analyze the user's photo based on all the rules above and provide your JSON response.
  `,

  badBihVibe: `
  **ROLE & GOAL:** You are my ultimate hype-bestie. I need you to tell me if this picture is giving "Bad Bih Vibe" and is 100% post-worthy. Your tone needs to be fun, confident, and unapologetically sassy. Hype me up!

  **AESTHETIC TO JUDGE:** "Bad Bih Vibe" - This is all about bold, confident, main-character energy. Power poses, fierce expressions, and looking like you own the place. It's unapologetic and powerful.

  **ANALYSIS CRITERIA:**
  - **Attitude & Expression:** Is the expression fierce, confident, and unapologetic?
  - **Power Pose:** Is the body language strong and commanding? (e.g., standing tall, direct gaze).
  - **Boss Energy:** Does the overall image scream confidence and self-assurance? Is the styling on point?
  - **Clarity:** Is the photo sharp and high-quality? Powerful people don't post blurry pics.

  **RESPONSE FORMAT & RULES:**
  1.  Provide your response in a valid JSON object with two keys: "verdict" and "comment".
  2.  **verdict:** Choose ONE of these three strings: "POST IT", "TWEAK IT", or "NAH".
  3.  **comment:** Your hype-squad, sassy reaction. For "TWEAK IT" or "NAH" verdicts, tell me what to fix to level up.

  **EXAMPLES OF TONE (Learn from these):**
  - **Good Example (POST IT):** { "verdict": "POST IT", "comment": "PERIOD. You ate this up and left no crumbs, this is the definition of main character." }
  - **Good Example (TWEAK IT):** { "verdict": "TWEAK IT", "comment": "The fit is a 10/10 but the sweet smile isn't giving 'bad bih' energy, I need more fierceness!" }
  - **Good Example (NAH):** { "verdict": "NAH", "comment": "You're a 10, but this photo is a 4... the low camera angle isn't giving power, it's just awkward." }

  **YOUR TASK:**
  Now, analyze the user's photo based on all the rules above and provide your JSON response.
  `,
} as const;

function normalizeVibeKey(category?: string): keyof typeof vibePromptsFinal | null {
  if (!category) return 'general';
  const first = category.split(',')[0].trim().toLowerCase();
  switch (first) {
    case 'general vibe':
    case 'ig story vibe':
      return 'general';
    case 'aesthetic vibe':
    case 'aesthetic core':
      return 'aesthetic';
    case 'classy core':
      return 'classyCore';
    case 'rizz core':
      return 'rizzCore';
    case 'matcha core':
      return 'matchaCore';
    case 'bad bih vibe':
      return 'badBihVibe';
    default:
      return 'general';
  }
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
async function getVertexFeedback(imageBase64: string, category?: string) {
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

    const key = normalizeVibeKey(category || undefined);
    const selectedPrompt = vibePromptsFinal[key ?? 'general'];

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
async function verifyFirebaseToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    (req as any).user = { uid: decodedToken.uid };
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Optional admin guard: set ADMIN_UIDS in .env as comma-separated Firebase UIDs
const adminUIDs = (process.env.ADMIN_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const allowClientUpgrade = (process.env.ALLOW_CLIENT_UPGRADE || '').toLowerCase() === 'true';
function verifyAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const uid = (req as any).user?.uid;
  if (!uid || !adminUIDs.includes(uid)) {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

// API Endpoints
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is running' });
});

// Get user subscription data
app.get('/api/user/subscription', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const userData = await getUserData(uid);
    
    res.status(200).json({
      checksUsed: userData.checksUsed,
      isPremium: userData.isPremium,
      subscriptionEndDate: userData.subscriptionEndDate,
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Increment user checks (called after successful feedback)
app.post('/api/user/increment-check', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const userData = await incrementChecksUsed(uid);
    
    res.status(200).json({
      checksUsed: userData.checksUsed,
      isPremium: userData.isPremium,
    });
  } catch (error) {
    console.error('Error incrementing checks:', error);
    res.status(500).json({ error: 'Failed to increment checks' });
  }
});

// Update premium status (will be called by Stripe webhook later)
// Premium updates: In production this should be driven by Stripe/Paddle webhooks.
// For development, you can set ALLOW_CLIENT_UPGRADE=true in .env to allow self-upgrade for testing.
app.post('/api/user/update-premium', verifyFirebaseToken, async (req, res) => {
  try {
    const uid = (req as any).user.uid;
    const { isPremium, stripeCustomerId, subscriptionEndDate } = req.body;
    
    // Security gate: allow only admins unless dev override is enabled
    const isAdmin = adminUIDs.includes(uid);
    if (!allowClientUpgrade && !isAdmin) {
      return res.status(403).json({ error: 'Premium updates require admin or payment webhook' });
    }
    
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
app.post('/api/user/add-credits', async (req, res) => {
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
      newBalance: 'unlimited', // Since they're now premium
      checksUsed: userData.checksUsed,
      isPremium: userData.isPremium,
    });
  } catch (error) {
    console.error('Error adding credits:', error);
    res.status(500).json({ error: 'Failed to add credits' });
  }
});
app.post('/api/feedback', async (req, res) => {
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

// Start the server
app.listen(port, () => {
  console.log(`🚀 Backend server running at http://localhost:${port}`);
});
