// DEPRECATED: Not used anymore. Reverted to Google Vertex AI. Safe to delete this file.
// Find working Hugging Face models
require('dotenv').config();

const API_KEY = process.env.HUGGINGFACE_API_KEY;

async function searchModels() {
  console.log('🔍 Searching for available image-captioning models...\n');
  
  try {
    // Search for image-to-text models
    const response = await fetch(
      'https://huggingface.co/api/models?pipeline_tag=image-to-text&sort=downloads&direction=-1&limit=20',
      {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
      }
    );
    
    if (!response.ok) {
      console.log('❌ Failed to search models:', response.status);
      return;
    }
    
    const models = await response.json();
    console.log(`✅ Found ${models.length} popular image-to-text models:\n`);
    
    for (const model of models.slice(0, 10)) {
      console.log(`📦 ${model.id}`);
      console.log(`   Downloads: ${model.downloads || 'N/A'}`);
      console.log(`   Likes: ${model.likes || 0}`);
      
      // Check if it has inference API enabled
      if (model.inference !== undefined) {
        console.log(`   Inference API: ${model.inference}`);
      }
      console.log('');
    }
    
    // Try to test one with actual inference
    console.log('\n🧪 Testing top model with actual request...');
    await testModelInference(models[0].id);
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function testModelInference(modelId) {
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  const imageBuffer = Buffer.from(testImageBase64, 'base64');
  
  console.log(`Testing: ${modelId}`);
  
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${modelId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: imageBuffer,
    }
  );
  
  console.log(`Status: ${response.status}`);
  const text = await response.text();
  console.log(`Response: ${text.substring(0, 300)}`);
}

searchModels().catch(console.error);
