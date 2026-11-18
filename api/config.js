import { KELAS, getDaftarBab, getDaftarBabDetail, syncBabFromBlob } from './_config.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Sinkronkan daftar bab persisten dari Vercel Blob jika token aktif
  await syncBabFromBlob();

  // Mengembalikan daftar kelas dan bab yang aktif beserta konfigurasi deadline
  return res.status(200).json({
    kelas: KELAS,
    bab: getDaftarBab(),
    babDetail: getDaftarBabDetail()
  });
}
