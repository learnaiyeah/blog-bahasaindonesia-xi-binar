import { handleUpload } from '@vercel/blob/client';
import { ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE_BYTES } from './_config.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Format JSON pada body tidak valid' });
    }
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname /*, clientPayload */) => {
        // Validasi direktori target agar hanya mengunggah ke path file/
        if (!pathname.startsWith('file/')) {
          throw new Error('Path upload tidak diizinkan');
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE_BYTES,
          addRandomSuffix: true
        };
      },
      onUploadCompleted: async () => {
        // Client menyelesaikan metadata pengiriman melalui POST /api/submit
      }
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Gagal memproses token unggah' });
  }
}
