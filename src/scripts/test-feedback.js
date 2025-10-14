// Quick E2E POST test to the local feedback server
// Usage: node src/scripts/test-feedback.js

(async () => {
  const fetchAny = async (url, opts) => {
    if (typeof fetch !== 'undefined') return fetch(url, opts);
    const { default: nodeFetch } = await import('node-fetch');
    return nodeFetch(url, opts);
  };

  const url = 'http://localhost:5000/api/feedback';
  const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  const body = { imageBase64, category: 'Aesthetic vibe' };

  try {
    const res = await fetchAny(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  } catch (e) {
    console.error('Test request failed:', e.message || e);
    process.exitCode = 1;
  }
})();
