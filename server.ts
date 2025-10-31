import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { VertexAI } from '@google-cloud/vertexai';

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

    const categoryPrompt = category ? `This photo should match a "${category}" aesthetic. ` : '';
    const prompt = `${categoryPrompt}Analyze this photo and decide: should it be posted on social media or not?\n` +
      `Give a short verdict ("Post" or "Nah") and a brief 1-sentence suggestion.\n` +
      `Focus on: lighting, composition, clarity, and overall vibe. Keep it casual and friendly.`;

  const model = vertexAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
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

    const lower = responseText.toLowerCase();
    const isPost = lower.includes('post') && !lower.includes('nah');
    const verdict = isPost ? 'Post ✅' : 'Nah ❌';

    let suggestion = responseText;
    if (suggestion.length > 150) suggestion = suggestion.substring(0, 147) + '...';

    return {
      verdict,
      suggestion,
      raw: result.response,
    };
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

// API Endpoints
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is running' });
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