module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, prompt } = req.body || {};
  if (!imageBase64 || !prompt) return res.status(400).json({ error: 'Image and prompt are required.' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured. Please set GEMINI_API_KEY in your Vercel environment variables.' });
  }

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  // Temporary debug — lists available models
  const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const listData = await listRes.json();
  const allModels = (listData.models||[]).map(m=>m.name);
  return res.json({ error: 'DEBUG — available models: ' + allModels.join(', ') });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
          }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT']
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Gemini API error.' });
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inline_data?.mime_type?.startsWith('image/'));

    if (!imagePart) {
      return res.status(500).json({ error: 'Gemini did not return an image. Try rephrasing the prompt.' });
    }

    return res.json({
      imageBase64: `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
