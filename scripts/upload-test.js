// DEPRECATED: Old test script for a removed /api/upload endpoint. Safe to delete.
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

async function run() {
  const tmp = process.env.TEMP || '/tmp';
  const file = `${tmp}/test-dot.png`;
  if (!fs.existsSync(file)) {
    console.error('Test file not found:', file);
    process.exit(1);
  }

  const form = new FormData();
  form.append('file', fs.createReadStream(file));

  try {
  const headers = form.getHeaders();
  const res = await axios.post('http://localhost:5000/api/upload', form, { headers });
  console.log('Response:', res.data);
  } catch (err) {
    console.error('Upload failed', err);
  }
}

run();
