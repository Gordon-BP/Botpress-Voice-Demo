// api/upload.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// Disable the default body parser so we can read raw audio
export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // Assemble the raw request body into a Buffer
  const buffer: Buffer = await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  try {
    const cfResp = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCT_ID}/ai/run/@cf/openai/whisper`,
      buffer,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`,
        },
      },
    );

    res.status(200).json(cfResp.data); // { success: true, result: { text: … } }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
