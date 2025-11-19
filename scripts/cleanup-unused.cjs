// Cleanup script: deletes unused/dev files safely
// Run: node scripts/cleanup-unused.cjs
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const targets = [
  'stripe-checkout-server.cjs',
  'test-vertex-ai.cjs',
  'test-hf-api.cjs',
  'test-new-endpoint.cjs',
  'search-models.cjs',
  path.join('src','scripts','test-feedback.js'),
  path.join('src','scripts','test-url-feedback.js'),
  path.join('src','pages','LoginPage.jsx'),
];

let removed = 0;
for (const rel of targets) {
  const full = path.join(repoRoot, rel);
  try {
    if (fs.existsSync(full)) {
      fs.rmSync(full, { force: true });
      console.log('Deleted', rel);
      removed++;
    } else {
      // console.log('Not found', rel);
    }
  } catch (e) {
    console.warn('Could not delete', rel, e.message);
  }
}

if (removed === 0) {
  console.log('No matching files to delete.');
} else {
  console.log(`Cleanup complete. Removed ${removed} file(s).`);
}
