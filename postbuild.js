// postbuild.js
import fs from 'fs';
import path from 'path';

// The content for the new package.json
const packageJsonContent = JSON.stringify({ type: 'module' });

// The path to the output directory
const outputPath = path.resolve(process.cwd(), 'dist-server');
const packageJsonPath = path.join(outputPath, 'package.json');

// Check if the output directory exists, create it if not
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath, { recursive: true });
}

// Write the package.json file
fs.writeFileSync(packageJsonPath, packageJsonContent, 'utf8');

console.log('✅ Created package.json in dist-server for ES Module support.');