import multer from 'multer';
import { put } from '@vercel/blob';
import { ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE_BYTES } from './_config.js';

// Setup multer memory storage untuk Serverless Function Vercel
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES // 10 MB
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_CONTENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipe file tidak didukung. Hanya PDF, DOC, atau DOCX yang diizinkan.'));
    }
  }
});

// Middleware helper untuk membungkus multer ke promise
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

// Konfigurasi agar Vercel Serverless Function tidak mem-parse body otomatis
// sehingga stream multipart/form-data dapat diproses utuh oleh multer
export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  try {
    // 1. Ekstraksi file dari form-data multipart
    await runMiddleware(req, res, upload.single('file'));

    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada berkas file yang diunggah' });
    }

    const file = req.file;
    const rawPathname = (req.body && req.body.pathname) ? String(req.body.pathname).trim() : '';

    // 2. Tentukan target pathname di storage
    let targetPath = rawPathname;
    if (!targetPath || !targetPath.startsWith('file/')) {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._\-]/g, '_');
      targetPath = `file/${Date.now()}_${safeName}`;
    }

    // 3. Simpan ke Vercel Blob (atau fallback jika token tidak ada)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blobResult = await put(targetPath, file.buffer, {
        access: 'public',
        contentType: file.mimetype,
        addRandomSuffix: false
      });

      return res.status(200).json({
        ok: true,
        url: blobResult.url,
        downloadUrl: blobResult.downloadUrl || blobResult.url,
        pathname: blobResult.pathname || targetPath,
        fileNama: file.originalname,
        fileTipe: file.mimetype
      });
    } else {
      // Fallback untuk pengetesan lokal tanpa token BLOB
      return res.status(200).json({
        ok: true,
        url: `/uploads/${file.originalname}`,
        downloadUrl: `/uploads/${file.originalname}`,
        pathname: targetPath,
        fileNama: file.originalname,
        fileTipe: file.mimetype
      });
    }
  } catch (error) {
    console.error('Error saat upload file:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Ukuran file terlalu besar, maksimal 10 MB' });
    }
    return res.status(400).json({ error: error.message || 'Gagal memproses unggahan berkas' });
  }
}
