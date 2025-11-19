// Quick test script to diagnose Vertex AI connection
const { VertexAI } = require('@google-cloud/vertexai');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Set credentials path
const credentialsPath = path.resolve(process.cwd(), 'gcloud-credentials.json');
process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

console.log('=== Vertex AI Connection Test ===');
console.log('Project:', process.env.GCLOUD_PROJECT);
console.log('Credentials file:', credentialsPath);
console.log('Credentials exist:', fs.existsSync(credentialsPath));
console.log('');

const project = process.env.GCLOUD_PROJECT;

if (!project) {
  console.error('❌ GCLOUD_PROJECT not set in .env');
  process.exit(1);
}

async function testVertexAI() {
  const modelNames = [
    'gemini-2.0-flash',
    'gemini-2.0-pro',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ];
  const locations = ['us-central1', 'us-east5', 'us-east4'];
  
  console.log('Testing different regions and models...');
  console.log('');
  
  for (const location of locations) {
    console.log(`📍 Region: ${location}`);
    
    try {
      const vertexAI = new VertexAI({ project, location });
      
      for (const modelName of modelNames) {
        try {
          console.log(`  Testing ${modelName}...`);
          const model = vertexAI.getGenerativeModel({ model: modelName });
          
          const result = await model.generateContent({
            contents: [{
              role: 'user',
              parts: [{ text: 'Say "Hello" and nothing else.' }]
            }]
          });
          
          const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
          
          console.log(`  ✅ SUCCESS with ${modelName} in ${location}!`);
          console.log(`  Response: ${text}`);
          console.log('');
          console.log('🎉 Your Vertex AI is working!');
          console.log('');
          console.log('Update your .env file:');
          console.log(`  GCLOUD_LOCATION="${location}"`);
          console.log('');
          console.log('Update server.ts line 52:');
          console.log(`  const model = '${modelName}';`);
          return;
          
        } catch (modelError) {
          console.log(`  ❌ ${modelName} failed: ${modelError.message.substring(0, 100)}...`);
        }
      }
    } catch (regionError) {
      console.log(`  ❌ Region ${location} failed`);
    }
    console.log('');
  }
  
  console.error('❌ No working region/model combination found');
  console.error('');
  console.error('This usually means:');
  console.error('  1. Vertex AI API is not fully enabled yet (wait 5 minutes)');
  console.error('  2. Need to accept Generative AI Terms of Service');
  console.error('  3. Billing is not enabled on your project');
  console.error('');
  console.error('Try this:');
  console.error('  1. Visit: https://console.cloud.google.com/vertex-ai/generative/language?project=' + project);
  console.error('  2. Accept any Terms of Service prompts');
  console.error('  3. Wait 2-3 minutes and run this test again');
  process.exit(1);
}

async function oldTestVertexAI() {
  try {
    console.log('Initializing Vertex AI client...');
    const vertexAI = new VertexAI({ project, location: 'us-central1' });
    
    console.log('Getting generative model...');
    const model = vertexAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    console.log('Sending test request to Gemini...');
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: 'Say "Hello, world!" and nothing else.' }]  
      }]
    });
    
    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    
    console.log('✅ SUCCESS! Gemini responded:', text);
    console.log('');
    console.log('Your Vertex AI setup is working correctly! 🎉');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('');
    
    if (error.message?.includes('403')) {
      console.error('This is a PERMISSION ERROR (403 Forbidden). Possible causes:');
      console.error('  1. Vertex AI API is not enabled in your Google Cloud project');
      console.error('  2. Service account lacks "Vertex AI User" role');
      console.error('');
      console.error('How to fix:');
      console.error('  Step 1: Enable Vertex AI API');
      console.error('    → https://console.cloud.google.com/apis/library/aiplatform.googleapis.com?project=' + project);
      console.error('');
      console.error('  Step 2: Grant permissions to service account');
      console.error('    → https://console.cloud.google.com/iam-admin/iam?project=' + project);
      console.error('    → Find your service account email');
      console.error('    → Add role: "Vertex AI User"');
      
    } else if (error.message?.includes('404')) {
      console.error('This is a NOT FOUND ERROR (404). Possible causes:');
      console.error('  1. Project ID is wrong');
      console.error('  2. Location/region is wrong');
      console.error('  3. Model name is incorrect');
      
    } else if (error.message?.includes('401') || error.message?.includes('unauthenticated')) {
      console.error('This is an AUTHENTICATION ERROR. Possible causes:');
      console.error('  1. Credentials file is invalid or corrupted');
      console.error('  2. Service account key has been deleted or revoked');
      console.error('  3. Wrong credentials file path');
      
    } else {
      console.error('Full error details:');
      console.error(error);
    }
    
    process.exit(1);
  }
}

testVertexAI();
