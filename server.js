// Simple Express server to handle server-side Cloudinary uploads
const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const uploadStream = cloudinary.uploader.upload_stream({ folder: 'uploads' }, (error, result) => {
    if (error) return res.status(500).json({ error: error.message });
    res.json({ secure_url: result.secure_url, public_id: result.public_id });
  });

  streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server listening on port ${port}`));
