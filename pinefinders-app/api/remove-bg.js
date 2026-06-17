module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64 } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'No image provided.' });

  const apiKey = process.env.REMOVEBG_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Remove.bg API key not configured. Please set REMOVEBG_API_KEY in your Vercel environment variables.' });
  }

  // Strip the data URI prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  try {
    const FormData = (await import('node:stream')).PassThrough; // trigger ESM check
    // Use built-in fetch + FormData (available in Node 18+)
    const form = new globalThis.FormData();
    form.append('image_base64', base64Data);
    form.append('size', 'auto');
    form.append('format', 'png');
    form.append('bg_color', 'ffffff'); // white background

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: form
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'Remove.bg error: ' + errText.slice(0, 200) });
    }

    const arrayBuffer = await response.arrayBuffer();
    const resultBase64 = 'data:image/png;base64,' + Buffer.from(arrayBuffer).toString('base64');

    return res.json({ imageBase64: resultBase64 });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
