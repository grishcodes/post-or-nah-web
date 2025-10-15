const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/feedback', (req, res) => {
  res.json({ message: 'Feedback API is running!', status: 'healthy' });
});

// Feedback endpoint
app.post('/api/feedback', async (req, res) => {
  try {
    const { imageBase64, category, imageUrl, vibes } = req.body;
    
    console.log('Processing feedback request:', { 
      hasImageBase64: !!imageBase64, 
      category, 
      hasImageUrl: !!imageUrl, 
      vibes 
    });
    
    if (!imageBase64 && !imageUrl) {
      return res.status(400).json({ error: 'Either imageBase64 or imageUrl is required' });
    }

    // Determine verdict randomly for now
    const verdict = Math.random() < 0.7 ? 'Post ✅' : 'Nah ❌';
    
    const suggestions = {
      'Post ✅': [
        'Great aesthetic! Consider adjusting the lighting.',
        'Nice composition! Maybe crop it tighter.',
        'Solid vibe! The colors work well.',
        'Looking good! Try a different angle next time.'
      ],
      'Nah ❌': [
        'Try better lighting for a more appealing look.',
        'Consider a cleaner background.',
        'The angle could be improved.',
        'Maybe wait for better natural light.'
      ]
    };

    const suggestionList = suggestions[verdict];
    const suggestion = suggestionList[Math.floor(Math.random() * suggestionList.length)];

    res.json({ 
      verdict, 
      suggestion, 
      raw: { 
        fallback: true, 
        category: category || 'general',
        vibes: vibes || 'unknown'
      } 
    });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});