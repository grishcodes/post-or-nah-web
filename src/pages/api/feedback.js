// Hugging Face inference API handler
// Expects POST { imageBase64, category }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
  const HF_MODEL = process.env.HUGGINGFACE_MODEL || 'Salesforce/blip2-flan-t5-xl';

  if (!HF_API_KEY) {
    return res.status(500).json({ error: 'HUGGINGFACE_API_KEY not configured in environment' });
  }

  try {
    const { imageBase64, category } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

    // Ensure data URI prefix exists (default to jpeg)
    const dataUri = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    // Compose prompt
    const prompt = `Rate this photo for the category: ${category}. Reply only with 'Post ✅' or 'Nah ❌' and one short suggestion.`;

    // Many HF multimodal models accept an inputs object with image + prompt
    const body = {
      inputs: {
        image: dataUri,
        prompt: prompt,
      },
      options: { wait_for_model: true },
    };

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
      // Per your request, return HTTP 500 when HF fails
      return res.status(500).json({ error: 'Hugging Face inference error', details: text });
    }

    const hfJson = await hfRes.json();

    // Extract generated text from common shapes
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
      // Fallback to JSON string
      try { return JSON.stringify(payload); } catch (e) { return null; }
    };

    const rawText = extractGeneratedText(hfJson);
    const normalized = (rawText || '').trim();

    // Determine verdict
    let verdict = null;
    const lower = normalized.toLowerCase();
    if (lower.includes('post')) verdict = 'Post ✅';
    else if (lower.includes('nah')) verdict = 'Nah ❌';
    else {
      // fallback: check for positive words
      const positive = ['good','nice','aesthetic','beautiful','great','amazing','positive','lovely','stylish','cute','stunning','fire','lit'];
      verdict = positive.some(w => lower.includes(w)) ? 'Post ✅' : 'Nah ❌';
    }

    // Extract suggestion: remove verdict tokens and emojis, then trim
    let suggestion = '';
    if (normalized) {
      // remove verdict keywords if present
      suggestion = normalized.replace(/post\s*✅|post|nah\s*❌|nah/ig, '').replace(/[\r\n]+/g, ' ').trim();
      // remove surrounding punctuation
      suggestion = suggestion.replace(/^[:\-–—\s]+/, '').replace(/[\s\-–—:.]+$/,'').trim();
      // take first sentence if multiple
      const s = suggestion.split(/\.|\n/).map(p => p.trim()).filter(Boolean);
      suggestion = s.length ? s[0] : suggestion;
    }

    // If suggestion is empty, provide a small default
    if (!suggestion) {
      suggestion = verdict === 'Post ✅' ? 'Looks good — minor lighting or crop tweaks.' : 'Try brighter lighting or a clearer background.';
    }

    return res.status(200).json({ verdict, suggestion, raw: hfJson });
  } catch (err) {
    console.error('Inference handler error', err);
    return res.status(500).json({ error: 'Inference failed' });
  }
}
