// Test posting imageUrl + vibes to local server
(async () => {
  const fetchAny = async (url, opts) => {
    if (typeof fetch !== 'undefined') return fetch(url, opts);
    const { default: nodeFetch } = await import('node-fetch');
    return nodeFetch(url, opts);
  };

  const url = 'http://localhost:5000/api/feedback';
  const imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/JPEG_example_flower.jpg';
  const body = { imageUrl, vibes: ['Aesthetic vibe', 'Classy core'] };

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
