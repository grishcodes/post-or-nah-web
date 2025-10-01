const express = require('express');// Simple Express server to handle server-side Cloudinary uploads

const cors = require('cors');const express = require('express');

const dotenv = require('dotenv');const multer = require('multer');

const dotenv = require('dotenv');

dotenv.config();const streamifier = require('streamifier');

const cloudinary = require('cloudinary').v2;

const app = express();

app.use(cors());dotenv.config();

app.use(express.json({ limit: '10mb' }));

cloudinary.config({

app.get('/api/feedback', (req, res) => {  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,

  res.json({ message: 'Feedback API is running!', status: 'healthy' });  api_key: process.env.CLOUDINARY_API_KEY,

});  api_secret: process.env.CLOUDINARY_API_SECRET,

});

app.post('/api/feedback', async (req, res) => {

  try {const app = express();

    const { imageBase64, category } = req.body;const upload = multer({ storage: multer.memoryStorage() });

    

    if (!imageBase64) {app.post('/api/upload', upload.single('file'), (req, res) => {

      return res.status(400).json({ error: 'imageBase64 is required' });  if (!req.file) return res.status(400).json({ error: 'No file provided' });

    }

  const uploadStream = cloudinary.uploader.upload_stream({ folder: 'uploads' }, (error, result) => {

    console.log('Processing feedback for category:', category);    if (error) return res.status(500).json({ error: error.message });

    res.json({ secure_url: result.secure_url, public_id: result.public_id });

    const verdict = Math.random() < 0.7 ? 'Post ✅' : 'Nah ❌';  });

    

    const suggestions = {  streamifier.createReadStream(req.file.buffer).pipe(uploadStream);

      'Post ✅': [});

        'Great aesthetic! Consider adjusting the lighting.',

        'Nice composition! Maybe crop it tighter.',const port = process.env.PORT || 5000;

        'Solid vibe! The colors work well.',app.listen(port, () => console.log(`Server listening on port ${port}`));

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

    res.json({ verdict, suggestion, raw: { fallback: true, category } });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}/api/feedback`);
});