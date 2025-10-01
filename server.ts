import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import streamifier from 'streamifier';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables
dotenv.config(); // load root .env (if any)
dotenv.config({ path: path.resolve(__dirname, 'src/.env') }); // load src/.env (if present)
// Also try local env files commonly used in frontend projects
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // allow larger base64 payloads

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// HuggingFace configuration
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
// Text-only model (fallback)
const HF_TEXT_MODEL = process.env.HUGGINGFACE_MODEL || 'microsoft/DialoGPT-medium';
// Vision-language model (primary)
const HF_VISION_MODEL = process.env.HUGGINGFACE_VISION_MODEL || 'Salesforce/blip2-flan-t5-xl';

if (!HF_API_KEY) {
  console.warn('Warning: HUGGINGFACE_API_KEY not set. Set it in .env or environment to call HF.');
} else {
  console.log('Using HF models -> vision:', HF_VISION_MODEL, ', text:', HF_TEXT_MODEL);
}

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'Server is healthy',
    services: {
      feedback: 'Available at POST /api/feedback',
      upload: 'Available at POST /api/upload'
    },
    hf_configured: !!HF_API_KEY,
    hf_models: { vision: HF_VISION_MODEL, text: HF_TEXT_MODEL },
    cloudinary_configured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)
  });
});

// Feedback API endpoint
app.get('/api/feedback', (req: Request, res: Response) => {
  res.json({
    message: 'Feedback API is running!',
    method: 'This endpoint expects POST requests with imageBase64 and category in the body',
    example: {
      imageBase64: 'base64_encoded_image_data',
      category: 'Aesthetic vibe, Classy core'
    },
    status: 'Server is healthy',
    hf_configured: !!HF_API_KEY
  });
});

app.post('/api/feedback', async (req: Request, res: Response) => {
  try {
    const { imageBase64, category } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

    const dataUri = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
    
    // Build a concise prompt that guides BLIP2 to produce a verdict + suggestion.
    const prompt = `You are a social photo critic.
Photo vibe tags: ${category || 'None'}.
In one short line, reply as: Post ✅ or Nah ❌, then a brief suggestion.`;

    if (!HF_API_KEY) {
      return res.status(500).json({ error: 'HUGGINGFACE_API_KEY not configured in environment' });
    }
    
    // 1) Try the BLIP2 vision-language model with image + prompt
    console.log('Calling HF vision model for category:', category);
    const visionPayload = {
      inputs: {
        image: dataUri,
        prompt,
      },
      parameters: {
        max_new_tokens: 80,
        temperature: 0.7,
        return_full_text: false,
      },
    };

    let hfJson: any = null;
    let visionOk = false;
    try {
      const visRes = await fetch(`https://api-inference.huggingface.co/models/${HF_VISION_MODEL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(visionPayload),
      });

      if (visRes.ok) {
        hfJson = await visRes.json();
        visionOk = true;
      } else {
        const t = await visRes.text();
        console.warn('Vision model error:', visRes.status, t);
      }
    } catch (e) {
      console.warn('Vision model call failed:', e);
    }

    // 2) If vision fails, try text-only model as a softer fallback
    if (!visionOk) {
      console.log('Falling back to HF text model for category:', category);
      const textPayload = {
        inputs: prompt,
        parameters: {
          max_new_tokens: 60,
          temperature: 0.7,
          return_full_text: false,
        },
      };

      const txtRes = await fetch(`https://api-inference.huggingface.co/models/${HF_TEXT_MODEL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(textPayload),
      });

      if (!txtRes.ok) {
        const text = await txtRes.text();
        console.error('HF text model error:', txtRes.status, text);
        if (txtRes.status === 403 || text.includes('permissions') || text.includes('Inference Providers')) {
          console.log('HF permissions issue detected, using fallback logic');
          return generateFallbackResponse(category, res);
        }
        return res.status(500).json({ error: 'Hugging Face inference error', details: text });
      }

      hfJson = await txtRes.json();
    }

    const extractGeneratedText = (payload: any): string | null => {
      if (!payload) return null;
      if (typeof payload === 'string') return payload;
      if (Array.isArray(payload)) {
        for (const item of payload) {
          if (!item) continue;
          if (typeof item === 'string') return item;
          if (item.generated_text) return item.generated_text;
          if (item?.generated_texts && Array.isArray(item.generated_texts)) return item.generated_texts.join(' ');
          if (item?.text) return item.text;
          if (item?.caption) return item.caption;
        }
      }
      if (payload.generated_text) return payload.generated_text;
      if (payload.text) return payload.text;
      if (payload.caption) return payload.caption;
      try { return JSON.stringify(payload); } catch (e) { return null; }
    };

  const rawText = extractGeneratedText(hfJson);
    const normalized = (rawText || '').trim();

    let verdict: string | null = null;
    const lower = normalized.toLowerCase();
    if (lower.includes('post')) verdict = 'Post ✅';
    else if (lower.includes('nah')) verdict = 'Nah ❌';
    else {
      const positive = ['good','nice','aesthetic','beautiful','great','amazing','positive','lovely','stylish','cute','stunning','fire','lit'];
      verdict = positive.some(w => lower.includes(w)) ? 'Post ✅' : 'Nah ❌';
    }

    let suggestion = '';
    if (normalized) {
      suggestion = normalized.replace(/post\s*✅|post|nah\s*❌|nah/ig, '').replace(/[\r\n]+/g, ' ').trim();
      suggestion = suggestion.replace(/^[\:\-—–\s]+/, '').replace(/[\s\-—–:.]+$/,'').trim();
      const s = suggestion.split(/\.|\n/).map(p => p.trim()).filter(Boolean);
      suggestion = s.length ? s[0] : suggestion;
    }

    if (!suggestion) {
      suggestion = verdict === 'Post ✅' ? 'Looks good — minor lighting or crop tweaks.' : 'Try brighter lighting or a clearer background.';
    }

    return res.status(200).json({ verdict, suggestion, raw: hfJson });
  } catch (err) {
    console.error('Server /api/feedback error', err);
    return res.status(500).json({ error: 'Inference failed', details: String(err) });
  }
});

// Compatibility alias for clients expecting Next.js style /api/route
app.post('/api/route', async (req: Request, res: Response) => {
  try {
    const { imageBase64, category } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

    const dataUri = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    const prompt = `You are a social photo critic.\nPhoto vibe tags: ${category || 'None'}.\nIn one short line, reply as: Post ✅ or Nah ❌, then a brief suggestion.`;

    if (!HF_API_KEY) {
      return res.status(500).json({ error: 'HUGGINGFACE_API_KEY not configured in environment' });
    }

    console.log('Calling HF vision model (alias /api/route) for category:', category);
    const visionPayload = {
      inputs: { image: dataUri, prompt },
      parameters: { max_new_tokens: 80, temperature: 0.7, return_full_text: false },
    };

    let hfJson: any = null;
    let visionOk = false;
    try {
      const visRes = await fetch(`https://api-inference.huggingface.co/models/${HF_VISION_MODEL}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${HF_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(visionPayload),
      });
      if (visRes.ok) { hfJson = await visRes.json(); visionOk = true; }
      else { console.warn('Vision model error:', visRes.status, await visRes.text()); }
    } catch (e) { console.warn('Vision model call failed:', e); }

    if (!visionOk) {
      const textPayload = { inputs: prompt, parameters: { max_new_tokens: 60, temperature: 0.7, return_full_text: false } };
      const txtRes = await fetch(`https://api-inference.huggingface.co/models/${HF_TEXT_MODEL}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${HF_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(textPayload),
      });
      if (!txtRes.ok) {
        const text = await txtRes.text();
        console.error('HF text model error:', txtRes.status, text);
        if (txtRes.status === 403 || text.includes('permissions') || text.includes('Inference Providers')) {
          console.log('HF permissions issue detected, using fallback logic');
          return generateFallbackResponse(category, res);
        }
        return res.status(500).json({ error: 'Hugging Face inference error', details: text });
      }
      hfJson = await txtRes.json();
    }

    const extractGeneratedText = (payload: any): string | null => {
      if (!payload) return null;
      if (typeof payload === 'string') return payload;
      if (Array.isArray(payload)) {
        for (const item of payload) {
          if (!item) continue;
          if (typeof item === 'string') return item;
          if ((item as any).generated_text) return (item as any).generated_text;
          if ((item as any)?.generated_texts && Array.isArray((item as any).generated_texts)) return (item as any).generated_texts.join(' ');
          if ((item as any)?.text) return (item as any).text;
          if ((item as any)?.caption) return (item as any).caption;
        }
      }
      if ((payload as any).generated_text) return (payload as any).generated_text;
      if ((payload as any).text) return (payload as any).text;
      if ((payload as any).caption) return (payload as any).caption;
      try { return JSON.stringify(payload); } catch { return null; }
    };

    const rawText = extractGeneratedText(hfJson);
    const normalized = (rawText || '').trim();
    let verdict: string | null = null;
    const lower = normalized.toLowerCase();
    if (lower.includes('post')) verdict = 'Post ✅';
    else if (lower.includes('nah')) verdict = 'Nah ❌';
    else {
      const positive = ['good','nice','aesthetic','beautiful','great','amazing','positive','lovely','stylish','cute','stunning','fire','lit'];
      verdict = positive.some(w => lower.includes(w)) ? 'Post ✅' : 'Nah ❌';
    }

    let suggestion = '';
    if (normalized) {
      suggestion = normalized.replace(/post\s*✅|post|nah\s*❌|nah/ig, '').replace(/[\r\n]+/g, ' ').trim();
      suggestion = suggestion.replace(/^[\:\-—–\s]+/, '').replace(/[\s\-—–:.]+$/,'').trim();
      const s = suggestion.split(/\.|\n/).map(p => p.trim()).filter(Boolean);
      suggestion = s.length ? s[0] : suggestion;
    }
    if (!suggestion) {
      suggestion = verdict === 'Post ✅' ? 'Looks good — minor lighting or crop tweaks.' : 'Try brighter lighting or a clearer background.';
    }

    return res.status(200).json({ verdict, suggestion, raw: hfJson });
  } catch (err) {
    console.error('Server /api/route error', err);
    return res.status(500).json({ error: 'Inference failed', details: String(err) });
  }
});

// Upload endpoint for Cloudinary
app.post('/api/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const uploadStream = cloudinary.uploader.upload_stream(
    { folder: 'uploads' }, 
    (error, result) => {
      if (error) return res.status(500).json({ error: error.message });
      res.json({ secure_url: result?.secure_url, public_id: result?.public_id });
    }
  );

  // Create a readable stream and pipe it to cloudinary
  const readableStream = streamifier.createReadStream(req.file.buffer);
  (readableStream as any).pipe(uploadStream);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Local feedback server listening on http://localhost:${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  - GET  http://localhost:${PORT}/api/health`);
  console.log(`  - GET  http://localhost:${PORT}/api/feedback`);
  console.log(`  - POST http://localhost:${PORT}/api/feedback`);
  console.log(`  - POST http://localhost:${PORT}/api/upload`);
});

// Fallback function when HF API fails due to permissions
function generateFallbackResponse(category: string, res: Response) {
  const responses: Record<string, { verdict: string; suggestion: string }> = {
    'Aesthetic vibe': { verdict: 'Post ✅', suggestion: 'Great aesthetic choice! Consider soft lighting for even better vibes.' },
    'Classy core': { verdict: 'Post ✅', suggestion: 'Very classy! A neutral background could elevate it further.' },
    'Rizz core': { verdict: 'Post ✅', suggestion: 'Solid rizz energy! Good confidence in the shot.' },
    'Matcha core': { verdict: 'Post ✅', suggestion: 'Perfect matcha vibes! The green tones work well.' },
    'Bad bih vibe': { verdict: 'Post ✅', suggestion: 'Fierce energy! Great confidence and style.' }
  };

  // Pick response based on category, or random if not found
  const categoryKey = Object.keys(responses).find(key => category.includes(key));
  const response = categoryKey ? responses[categoryKey] : responses['Aesthetic vibe'];

  // Add some randomness to verdicts (70% Post, 30% Nah)
  const finalVerdict = Math.random() < 0.7 ? response.verdict : 'Nah ❌';
  const finalSuggestion = finalVerdict === 'Nah ❌' ?
    'Try better lighting or a different angle to enhance the vibe.' :
    response.suggestion;

  return res.status(200).json({
    verdict: finalVerdict,
    suggestion: finalSuggestion,
    raw: { fallback: true, category, generated_text: `${finalVerdict} ${finalSuggestion}` }
  });
}