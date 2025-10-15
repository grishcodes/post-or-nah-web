// Simple Express server that calls Hugging Face BLIP2 vision model
// Endpoints:
//  - GET  /api/health
//  - GET  /api/feedback (usage helper)
//  - POST /api/feedback { imageBase64, category? }

const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from multiple common locations so it works no matter where you run from
// Priority: src/.env.local -> src/.env -> projectRoot/.env.local -> projectRoot/.env
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Use global fetch if available (Node >= 18); otherwise lazy-load node-fetch
const fetchAny = async (url, opts) => {
	if (typeof fetch !== 'undefined') return fetch(url, opts);
	const { default: nodeFetch } = await import('node-fetch');
	return nodeFetch(url, opts);
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY || process.env.HF_API_TOKEN;
const HF_VISION_MODEL = process.env.HUGGINGFACE_VISION_MODEL || 'Salesforce/blip2-flan-t5-xl';
const HF_TEXT_MODEL = process.env.HUGGINGFACE_MODEL || 'microsoft/DialoGPT-medium';

app.get('/api/health', (req, res) => {
	res.json({ ok: true, hf_configured: !!HF_API_KEY, models: { vision: HF_VISION_MODEL, text: HF_TEXT_MODEL } });
});

// Helpful GET so visiting this URL in the browser shows instructions
app.get('/api/feedback', (req, res) => {
	res.status(405).json({ error: 'Method not allowed', use: "POST /api/feedback with JSON { imageBase64, category? }" });
});

app.get('/api/analyze', (req, res) => {
	res.status(405).json({ error: 'Method not allowed', use: "POST /api/analyze with JSON { imageBase64, category? }" });
});

async function feedbackHandler(req, res) {
	try {
		const { imageBase64, imageUrl, category, vibes } = req.body || {};
		if (!HF_API_KEY) return res.status(500).json({ error: 'HUGGINGFACE_API_KEY or HF_API_TOKEN not configured' });

		// Determine category: explicit category wins; else join vibes array if provided
		const effectiveCategory = typeof category === 'string' && category.trim().length
			? category.trim()
			: Array.isArray(vibes) && vibes.length
				? vibes.filter(Boolean).join(', ')
				: undefined;

		// Build a data URI from either imageBase64 or imageUrl
		let dataUri = null;
		if (typeof imageBase64 === 'string' && imageBase64.length) {
			// Accept raw base64 or full data URI
			dataUri = imageBase64.startsWith('data:')
				? imageBase64
				: `data:image/jpeg;base64,${imageBase64}`;
			console.log('[api] /api/feedback invoked (mode=base64)');
		} else if (typeof imageUrl === 'string' && imageUrl.length) {
			if (imageUrl.startsWith('data:')) {
				dataUri = imageUrl; // already a data URI
				console.log('[api] /api/feedback invoked (mode=url-data-uri)');
			} else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
				console.log('[api] /api/feedback invoked (mode=url-fetch)');
				try {
					const imgRes = await fetchAny(imageUrl, { method: 'GET' });
					if (!imgRes.ok) {
						const t = await safeText(imgRes);
						return res.status(400).json({ error: 'Failed to fetch imageUrl', details: t || imgRes.statusText });
					}
					const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
					const arrayBuf = await imgRes.arrayBuffer();
					const b64 = Buffer.from(arrayBuf).toString('base64');
					dataUri = `data:${contentType};base64,${b64}`;
				} catch (e) {
					return res.status(400).json({ error: 'Unable to retrieve image from imageUrl', details: String(e) });
				}
			}
		}

		if (!dataUri) {
			return res.status(400).json({ error: 'imageBase64 or imageUrl is required' });
		}

		const prompt = `You are a social photo critic.\nPhoto vibe tags: ${effectiveCategory || 'None'}.\nIn one short line, reply as: Post ✅ or Nah ❌, then a brief suggestion.`;

		// 1) Try the vision-language model
		let hfJson = null;
		let visionOk = false;
		try {
			const visRes = await fetchAny(`https://api-inference.huggingface.co/models/${HF_VISION_MODEL}`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${HF_API_KEY}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					inputs: { image: dataUri, prompt },
					parameters: { max_new_tokens: 80, temperature: 0.7, return_full_text: false },
					options: { wait_for_model: true }
				}),
			});
			if (visRes.ok) {
				hfJson = await visRes.json();
				visionOk = true;
				console.log('[api] Vision model succeeded');
			} else {
				console.warn('[api] Vision model error:', visRes.status, await safeText(visRes));
			}
		} catch (e) {
			console.warn('[api] Vision model call failed:', e);
		}

		// 2) If vision fails, try a text-only fallback
		if (!visionOk) {
			try {
				console.log('[api] Falling back to text model');
				const txtRes = await fetchAny(`https://api-inference.huggingface.co/models/${HF_TEXT_MODEL}`, {
					method: 'POST',
					headers: { Authorization: `Bearer ${HF_API_KEY}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({
						inputs: prompt,
						parameters: { max_new_tokens: 60, temperature: 0.7, return_full_text: false },
						options: { wait_for_model: true }
					}),
				});
				if (txtRes.ok) {
					hfJson = await txtRes.json();
					console.log('[api] Text model succeeded');
				} else {
					const errorText = await safeText(txtRes);
					console.error('[api] Text model error:', txtRes.status, errorText);
					if (txtRes.status === 403 || (errorText || '').toLowerCase().includes('permission') || (errorText || '').toLowerCase().includes('inference provider')) {
						console.log('[api] Using fallback due to permission/model issues');
						return generateFallback(effectiveCategory, res);
					}
					// For other errors, still try to use fallback
					console.log('[api] Using fallback due to text model failure');
					return generateFallback(effectiveCategory, res);
				}
			} catch (e) {
				console.error('[api] Text model call failed:', e);
				console.log('[api] Using fallback due to network/model issues');
				return generateFallback(effectiveCategory, res);
			}
		}

		// Extract the generated text from the response
		const generatedText = extractGeneratedText(hfJson);
		console.log('[api] Generated text:', generatedText);

		// If no text was generated from either model, use fallback
		if (!generatedText || generatedText.trim().length === 0) {
			console.log('[api] No generated text, using fallback');
			return generateFallback(effectiveCategory, res);
		}

		const normalized = generatedText.trim();
		let verdict = null;
		const lower = normalized.toLowerCase();

		// Check for explicit post/nah mentions first
		if (lower.includes('post')) verdict = 'Post ✅';
		else if (lower.includes('nah')) verdict = 'Nah ❌';
		else {
			// Fallback to sentiment analysis
			const positive = ['good','nice','aesthetic','beautiful','great','amazing','positive','lovely','stylish','cute','stunning','fire','lit'];
			verdict = positive.some(w => lower.includes(w)) ? 'Post ✅' : 'Nah ❌';
		}

		// Extract suggestion from the response
		let suggestion = normalized.replace(/post\s*✅|post|nah\s*❌|nah/ig, '').replace(/[\r\n]+/g, ' ').trim();
		suggestion = suggestion.replace(/^[\:\-—–\s]+/, '').replace(/[\s\-—–:.]+$/,'').trim();
		const parts = suggestion.split(/\.|\n/).map(s => s.trim()).filter(Boolean);
		suggestion = parts.length ? parts[0] : (verdict === 'Post ✅' ? 'Looks good — minor lighting or crop tweaks.' : 'Try brighter lighting or a clearer background.');

		console.log('[api] Final verdict:', verdict, 'Suggestion:', suggestion);
		return res.status(200).json({
			verdict: verdict,
			suggestion: suggestion,
			raw: hfJson
		});
	} catch (err) {
		console.error('Server /api/feedback error', err);
		return res.status(500).json({ error: 'Inference failed', details: String(err) });
	}
}

app.post('/api/feedback', feedbackHandler);
app.post('/api/analyze', feedbackHandler);

// Friendly root message
app.get('/', (_req, res) => {
	res.type('text/plain').send('Post-or-Nah API is running. Try GET /api/health or POST /api/feedback');
});

function extractGeneratedText(payload) {
	if (!payload) return null;
	if (typeof payload === 'string') return payload;
	if (Array.isArray(payload)) {
		for (const item of payload) {
			if (!item) continue;
			if (typeof item === 'string') return item;
			if (item.generated_text) return item.generated_text;
			if (item && Array.isArray(item.generated_texts)) return item.generated_texts.join(' ');
			if (item && item.text) return item.text;
			if (item && item.caption) return item.caption;
		}
	}
	if (payload.generated_text) return payload.generated_text;
	if (payload.text) return payload.text;
	if (payload.caption) return payload.caption;
	try { return JSON.stringify(payload); } catch { return null; }
}

function generateFallback(category, res) {
	const finalVerdict = Math.random() < 0.7 ? 'Post ✅' : 'Nah ❌';
	const finalSuggestion = finalVerdict === 'Nah ❌' ? 'Try better lighting or a different angle to enhance the vibe.' : 'Great aesthetic choice! Consider soft lighting for even better vibes.';
	return res.status(200).json({ verdict: finalVerdict, suggestion: finalSuggestion, raw: { fallback: true, category } });
}

async function safeText(res) { try { return await res.text(); } catch { return ''; } }

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	console.log(`Local feedback server listening on http://localhost:${PORT}`);
	console.log('Endpoints:');
	console.log(`  - GET  http://localhost:${PORT}/api/health`);
	console.log(`  - GET  http://localhost:${PORT}/api/feedback (405 helper)`);
	console.log(`  - POST http://localhost:${PORT}/api/feedback`);
});

