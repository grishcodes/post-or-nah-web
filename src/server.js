// Lightweight Express server for local development
// Run this with: node src/server.js (from project root) or cd src; node server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // allow larger base64 payloads

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HF_MODEL = process.env.HUGGINGFACE_MODEL || 'Salesforce/blip2-flan-t5-xl';

if (!HF_API_KEY) {
  console.warn('Warning: HUGGINGFACE_API_KEY not set. Set it in .env or environment to call HF.');
}

app.post('/api/feedback', async (req, res) => {
  try {
    const { imageBase64, category } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

    const dataUri = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    const prompt = `Rate this photo for the category: ${category}. Reply only with 'Post ✅' or 'Nah ❌' and one short suggestion.`;

    const body = {
      inputs: {
        image: dataUri,
        prompt: prompt,
      },
      options: { wait_for_model: true },
    };

    if (!HF_API_KEY) {
      return res.status(500).json({ error: 'HUGGINGFACE_API_KEY not configured in environment' });
    }

    const hfRes = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!hfRes.ok) {
      const text = await hfRes.text();
      console.error('Hugging Face error:', hfRes.status, text);
      return res.status(500).json({ error: 'Hugging Face inference error', details: text });
    }

    const hfJson = await hfRes.json();

    const extractGeneratedText = (payload) => {
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

    let verdict = null;
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
      suggestion = suggestion.replace(/^[\:\-–—\s]+/, '').replace(/[\s\-–—:.]+$/,'').trim();
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Local feedback server listening on http://localhost:${PORT}/api/feedback`);
});
