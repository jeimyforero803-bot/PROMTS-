import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// API proxy to Gemini — key stays server-side only
app.post('/api/generate', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  try {
    const { contents, config } = req.body;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: contents }] }],
          generationConfig: {
            responseMimeType: config?.responseMimeType,
            responseSchema: config?.responseSchema,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // Extract text from Gemini response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text });
  } catch (err) {
    console.error('Gemini proxy error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// SPA fallback — all routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ZALVAJE PROMTS running on port ${PORT}`);
});
