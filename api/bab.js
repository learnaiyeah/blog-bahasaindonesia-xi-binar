import { getSession } from './_auth.js';
import { getDaftarBab, saveDaftarBab } from './_config.js';

/**
 * Endpoint Pengaturan Bab KTI
 * GET: Mengembalikan daftar bab
 * POST: Mengubah daftar dan judul bab (Hanya Peran Guru)
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.status(200).json({ bab: getDaftarBab() });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  // 1. Verifikasi Sesi & Peran
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.' });
  }

  if (session.peran !== 'guru') {
    return res.status(403).json({ error: 'Hanya peran Guru yang berhak mengatur bab tugas.' });
  }

  // 2. Validasi Body
  const { bab } = req.body || {};
  if (!Array.isArray(bab) || bab.length === 0) {
    return res.status(400).json({ error: 'Daftar bab harus berupa kumpulan teks dan minimal memiliki 1 bab.' });
  }

  const cleanBab = bab.map(b => String(b).trim()).filter(Boolean);
  if (cleanBab.length === 0) {
    return res.status(400).json({ error: 'Nama bab tidak boleh kosong.' });
  }

  for (const b of cleanBab) {
    if (b.length > 100) {
      return res.status(400).json({ error: `Judul bab "${b}" melebihi batas maksimal 100 karakter.` });
    }
  }

  // Cek keunikan nama bab (case-insensitive)
  const seen = new Set();
  for (const b of cleanBab) {
    const lower = b.toLowerCase();
    if (seen.has(lower)) {
      return res.status(400).json({ error: `Terdapat judul bab ganda: "${b}". Setiap bab harus memiliki judul unik.` });
    }
    seen.add(lower);
  }

  try {
    const updated = saveDaftarBab(cleanBab);
    return res.status(200).json({
      success: true,
      message: 'Pengaturan bab berhasil disimpan',
      bab: updated
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal menyimpan pengaturan bab' });
  }
}
