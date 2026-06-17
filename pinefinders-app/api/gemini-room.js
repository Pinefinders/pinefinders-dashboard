module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, backdropBase64, prompt } = req.body || {};
  if (!imageBase64 || !prompt) return res.status(400).json({ error: 'Image and prompt are required.' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured. Please set GEMINI_API_KEY in your Vercel environment variables.' });
  }

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

  // Build parts: prompt text + furniture image + optional showroom backdrop
  const parts = [
    { text: prompt },
    { inline_data: { mime_type: mimeType, data: base64Data } }
  ];

  if (backdropBase64) {
    const backdropData = backdropBase64.replace(/^data:image\/\w+;base64,/, '');
    const backdropMime = backdropBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    parts.push({ inline_data: { mime_type: backdropMime, data: backdropData } });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
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
    const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/') || p.inline_data?.mime_type?.startsWith('image/'));

    if (!imagePart) {
      return res.status(500).json({ error: 'Gemini did not return an image. Try rephrasing the prompt.' });
    }

    const imgData = imagePart.inlineData || imagePart.inline_data;
    return res.json({
      imageBase64: `data:${imgData.mimeType || imgData.mime_type};base64,${imgData.data}`
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
