// DEPRECATED: Not used anymore. Reverted to Google Vertex AI. Safe to delete this file.
// Test script to diagnose Hugging Face API issues
require('dotenv').config();
const fs = require('fs');

const API_KEY = process.env.HUGGINGFACE_API_KEY;

console.log('🔍 Testing Hugging Face API...');
console.log('API Key:', API_KEY ? `${API_KEY.substring(0, 10)}...` : 'NOT FOUND');

// Test 1: Check API key validity
async function testAPIKey() {
  console.log('\n📝 Test 1: Checking API key validity...');
  try {
    const response = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Key is valid!');
      console.log('   User:', data.name || data.fullname);
      console.log('   Type:', data.type);
      return true;
    } else {
      console.log('❌ API Key is invalid or expired');
      console.log('   Status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Error checking API key:', error.message);
    return false;
  }
}

// Test 2: Try different models
async function testModel(modelName) {
  console.log(`\n🧪 Testing model: ${modelName}`);
  
  // Create a tiny test image (1x1 red pixel PNG)
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  const imageBuffer = Buffer.from(testImageBase64, 'base64');
  
  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${modelName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'image/png',
        },
        body: imageBuffer,
      }
    );
    
    const resultText = await response.text();
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('   ✅ Success!');
      console.log('   Response:', resultText.substring(0, 200));
      return true;
    } else {
      console.log(`   ❌ Failed`);
      console.log('   Error:', resultText.substring(0, 200));
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error:`, error.message);
    return false;
  }
}

// Test 3: List available models
async function listRecommendedModels() {
  console.log('\n📋 Recommended Image-to-Text models:');
  const models = [
    'Salesforce/blip-image-captioning-large',
    'Salesforce/blip-image-captioning-base',
    'nlpconnect/vit-gpt2-image-captioning',
    'microsoft/git-base',
    'microsoft/git-large',
    'ydshieh/vit-gpt2-coco-en',
  ];
  
  console.log(models.map(m => `   - ${m}`).join('\n'));
  return models;
}

// Run all tests
async function runTests() {
  const keyValid = await testAPIKey();
  
  if (!keyValid) {
    console.log('\n❌ Cannot proceed - API key is invalid');
    console.log('   Get a new key at: https://huggingface.co/settings/tokens');
    return;
  }
  
  const models = await listRecommendedModels();
  
  console.log('\n🔄 Testing models (this may take a while)...');
  
  for (const model of models) {
    const success = await testModel(model);
    if (success) {
      console.log(`\n✅ WORKING MODEL FOUND: ${model}`);
      break;
    }
    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

runTests().catch(console.error);
