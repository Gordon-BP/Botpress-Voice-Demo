// api/tts.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { text } = req.body as { text: string };

  try {
    const mp3 = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      {
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.5 },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          Accept: 'audio/mpeg',
        },
        responseType: 'arraybuffer',
      },
    );

    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(mp3.data));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
