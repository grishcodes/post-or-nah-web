// DEPRECATED: Not used anymore. Reverted to Google Vertex AI. Safe to delete this file.
// Test new HF Inference API endpoint
require('dotenv').config();
const fs = require('fs');

const API_KEY = process.env.HUGGINGFACE_API_KEY;

async function testNewEndpoint() {
  console.log('🧪 Testing new Inference Endpoint format...\n');
  
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  const imageBuffer = Buffer.from(testImageBase64, 'base64');
  
  // Try new serverless endpoint
  const url = 'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base';
  
  console.log(`URL: ${url}`);
  console.log(`Method: POST`);
  console.log(`Body: Binary image data (${imageBuffer.length} bytes)\n`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'x-wait-for-model': 'true',  // Wait for model to load
      },
      body: imageBuffer,
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
    
    const contentType = response.headers.get('content-type');
    console.log(`\nContent-Type: ${contentType}\n`);
    
    const responseText = await response.text();
    console.log(`Response Body:`);
    console.log(responseText);
    
    if (response.ok) {
      console.log('\n✅ SUCCESS! This endpoint works!');
      try {
        const json = JSON.parse(responseText);
        console.log('Parsed JSON:', JSON.stringify(json, null, 2));
      } catch (e) {
        console.log('(Not JSON response)');
      }
    } else {
      console.log('\n❌ Failed');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log(error);
  }
}

testNewEndpoint();
