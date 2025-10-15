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
const HF_VISION_MODEL = process.env.HUGGINGFACE_VISION_MODEL || 'Salesforce/blip-image-captioning-large';
const HF_TEXT_MODEL = process.env.HUGGINGFACE_TEXT_MODEL || 'microsoft/DialoGPT-medium';

if (!HF_API_KEY) {
  console.warn('Warning: HUGGINGFACE_API_KEY not set. Set it in .env or environment to call HF.');
} else {
  console.log('Using HF vision model:', HF_VISION_MODEL);
  console.log('Using HF text fallback model:', HF_TEXT_MODEL);
}

// Helper function to extract generated text from various HuggingFace response formats
function extractGeneratedText(payload: any): string {
  if (!payload) return '';
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
  return '';
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

    if (!HF_API_KEY) {
      return res.status(500).json({ error: 'HUGGINGFACE_API_KEY not configured in environment' });
    }

    // Ensure we have the full data URI format
    const dataUri = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    console.log('=== Vision Model Attempt ===');
    console.log('Calling HF vision model:', HF_VISION_MODEL);
    console.log('Category:', category || 'Not provided');

    // Step 1: Try vision model first
    let visionDescription = '';
    let visionModelSuccess = false;
    
    try {
      // BLIP model expects inputs with image and optional text prompt
      const visionPayload = category 
        ? { 
            inputs: {
              image: dataUri,
              text: `Describe this image for ${category} category`
            }
          }
        : { inputs: dataUri };

      const visionRes = await fetch(`https://api-inference.huggingface.co/models/${HF_VISION_MODEL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(visionPayload),
      });

      if (visionRes.ok) {
        const visionJson = await visionRes.json();
        console.log('Vision model raw response:', JSON.stringify(visionJson, null, 2));

        // Extract generated text from vision model
        visionDescription = extractGeneratedText(visionJson);
        if (visionDescription) {
          visionModelSuccess = true;
          console.log('Vision model description:', visionDescription);
        } else {
          console.log('Vision model returned no text');
        }
      } else {
        const errorText = await visionRes.text();
        console.error('Vision model error:', visionRes.status, errorText);
      }
    } catch (visionErr) {
      console.error('Vision model exception:', visionErr);
    }

    // Step 2: Generate verdict based on vision description + category
    let verdict = '';
    let rawResponse: any = {};

    if (visionModelSuccess && visionDescription) {
      // Use the vision description to make a decision
      const categoryText = category ? ` Category: ${category}.` : '';
      const prompt = `Image shows: ${visionDescription}.${categoryText} Should I post this? Reply with 'Post ✅' or 'Nah ❌' and a brief suggestion.`;
      
      console.log('=== Text Model with Vision Context ===');
      console.log('Prompt:', prompt);

      try {
        const textRes = await fetch(`https://api-inference.huggingface.co/models/${HF_TEXT_MODEL}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 100,
              temperature: 0.7,
              return_full_text: false
            }
          }),
        });

        if (textRes.ok) {
          const textJson = await textRes.json();
          console.log('Text model raw response:', JSON.stringify(textJson, null, 2));
          rawResponse = { vision: visionDescription, text: textJson };
          verdict = extractGeneratedText(textJson) || visionDescription;
        } else {
          console.log('Text model failed, using vision description as verdict');
          rawResponse = { vision: visionDescription };
          verdict = visionDescription;
        }
      } catch (textErr) {
        console.error('Text model exception:', textErr);
        rawResponse = { vision: visionDescription };
        verdict = visionDescription;
      }
    } else {
      // Step 3: Fallback to text-only if vision failed
      console.log('=== Fallback to Text-Only Model ===');
      const categoryText = category ? ` for the category: ${category}` : '';
      const prompt = `Rate a photo${categoryText}. Reply only with 'Post ✅' or 'Nah ❌' and one short suggestion.`;
      
      try {
        const textRes = await fetch(`https://api-inference.huggingface.co/models/${HF_TEXT_MODEL}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 100,
              temperature: 0.7,
              return_full_text: false
            }
          }),
        });

        if (textRes.ok) {
          const textJson = await textRes.json();
          console.log('Text fallback raw response:', JSON.stringify(textJson, null, 2));
          rawResponse = textJson;
          verdict = extractGeneratedText(textJson) || 'No verdict returned';
        } else {
          const errorText = await textRes.text();
          console.error('Text fallback error:', textRes.status, errorText);
          
          // Final fallback to rule-based response
          return generateFallbackResponse(category, res);
        }
      } catch (err) {
        console.error('Text fallback exception:', err);
        return generateFallbackResponse(category, res);
      }
    }

    // If still no verdict, return error
    if (!verdict) {
      return res.status(200).json({ 
        verdict: 'No verdict returned', 
        suggestion: '',
        raw: rawResponse 
      });
    }

    // Extract suggestion from verdict
    let suggestion = '';
    const normalized = verdict.trim();
    
    // Try to extract suggestion text
    suggestion = normalized.replace(/post\s*✅|post|nah\s*❌|nah/ig, '').replace(/[\r\n]+/g, ' ').trim();
    suggestion = suggestion.replace(/^[\:\-—–\s]+/, '').replace(/[\s\-—–:.]+$/,'').trim();
    const sentences = suggestion.split(/\.|\n/).map(p => p.trim()).filter(Boolean);
    suggestion = sentences.length ? sentences[0] : suggestion;

    console.log('=== Final Response ===');
    console.log('Verdict:', verdict);
    console.log('Suggestion:', suggestion);

    return res.status(200).json({ 
      verdict, 
      suggestion: suggestion || '',
      raw: rawResponse 
    });
  } catch (err) {
    console.error('Server /api/feedback error:', err);
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

const PORT = process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT) : 3001;
app.listen(PORT, 'localhost', () => {
  console.log(`Local feedback server listening on http://localhost:${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  - GET  http://localhost:${PORT}/api/health`);
  console.log(`  - GET  http://localhost:${PORT}/api/feedback`);
  console.log(`  - POST http://localhost:${PORT}/api/feedback`);
  console.log(`  - POST http://localhost:${PORT}/api/upload`);
});

// Fallback function when HF API fails due to permissions
function generateFallbackResponse(category: string | undefined, res: Response) {
  const responses: Record<string, { verdict: string; suggestion: string }> = {
    'Aesthetic vibe': { verdict: 'Post ✅', suggestion: 'Great aesthetic choice! Consider soft lighting for even better vibes.' },
    'Classy core': { verdict: 'Post ✅', suggestion: 'Very classy! A neutral background could elevate it further.' },
    'Rizz core': { verdict: 'Post ✅', suggestion: 'Solid rizz energy! Good confidence in the shot.' },
    'Matcha core': { verdict: 'Post ✅', suggestion: 'Perfect matcha vibes! The green tones work well.' },
    'Bad bih vibe': { verdict: 'Post ✅', suggestion: 'Fierce energy! Great confidence and style.' }
  };

  // Pick response based on category, or random if not found
  const categoryKey = category ? Object.keys(responses).find(key => category.includes(key)) : undefined;
  const response = categoryKey ? responses[categoryKey] : responses['Aesthetic vibe'];

  // Add some randomness to verdicts (70% Post, 30% Nah)
  const finalVerdict = Math.random() < 0.7 ? response.verdict : 'Nah ❌';
  const finalSuggestion = finalVerdict === 'Nah ❌' ?
    'Try better lighting or a different angle to enhance the vibe.' :
    response.suggestion;

  return res.status(200).json({
    verdict: finalVerdict,
    suggestion: finalSuggestion,
    raw: { fallback: true, category: category || 'none', generated_text: `${finalVerdict} ${finalSuggestion}` }
  });
}