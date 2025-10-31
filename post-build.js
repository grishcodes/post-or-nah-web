import { writeFileSync } from 'fs';
import { resolve } from 'path';

// This script creates a tiny package.json file in the dist-server folder
// to tell Node.js that all .js files inside are CommonJS modules.
const packageJsonContent = JSON.stringify({ type: 'commonjs' }, null, 2);
const outputPath = resolve(process.cwd(), 'dist-server', 'package.json');

try {
  writeFileSync(outputPath, packageJsonContent, 'utf8');
  console.log('Successfully created dist-server/package.json to set CommonJS module type.');
} catch (error) {
  console.error('Failed to create package.json in dist-server:', error);
  process.exit(1); // Exit with an error code
}