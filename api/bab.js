import { getSession } from './_auth.js';
import { getDaftarBab, getDaftarBabDetail, saveDaftarBab } from './_config.js';

/**
 * Endpoint Pengaturan Bab KTI & Deadline
 * GET: Mengembalikan daftar bab (nama) dan babDetail (nama + deadline)
 * POST: Mengubah daftar bab, judul, dan batas waktu pengumpulan (Hanya Peran Guru)
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.status(200).json({
      bab: getDaftarBab(),
      babDetail: getDaftarBabDetail()
    });
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

  // 2. Validasi Body (bisa berupa array of string atau array of objects)
  const inputList = req.body?.bab || req.body?.babDetail;
  if (!Array.isArray(inputList) || inputList.length === 0) {
    return res.status(400).json({ error: 'Daftar bab harus berupa kumpulan teks atau data bab dan minimal memiliki 1 bab.' });
  }

  const cleanItems = [];
  const seen = new Set();

  for (const item of inputList) {
    let judul = '';
    let deadlineAktif = false;
    let deadline = null;

    if (typeof item === 'string') {
      judul = item.trim();
    } else if (item && typeof item === 'object') {
      judul = String(item.judul || '').trim();
      deadlineAktif = Boolean(item.deadlineAktif);
      deadline = item.deadline ? String(item.deadline).trim() : null;
    }

    if (!judul) {
      return res.status(400).json({ error: 'Nama bab tidak boleh kosong.' });
    }

    if (judul.length > 100) {
      return res.status(400).json({ error: `Judul bab "${judul}" melebihi batas maksimal 100 karakter.` });
    }

    const lower = judul.toLowerCase();
    if (seen.has(lower)) {
      return res.status(400).json({ error: `Terdapat judul bab ganda: "${judul}". Setiap bab harus memiliki judul unik.` });
    }
    seen.add(lower);

    if (deadlineAktif && deadline) {
      const dt = new Date(deadline);
      if (isNaN(dt.getTime())) {
        return res.status(400).json({ error: `Format tanggal deadline untuk "${judul}" tidak valid.` });
      }
    }

    cleanItems.push({
      judul,
      deadlineAktif,
      deadline: deadlineAktif ? deadline : null
    });
  }

  try {
    const updated = saveDaftarBab(cleanItems);
    return res.status(200).json({
      success: true,
      message: 'Pengaturan bab dan deadline berhasil disimpan',
      bab: updated,
      babDetail: getDaftarBabDetail()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal menyimpan pengaturan bab' });
  }
}
