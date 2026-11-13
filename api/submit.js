import crypto from 'node:crypto';
import { put, list } from '@vercel/blob';
import { KELAS, BAB, MAX_NAMA_LENGTH, MAX_CATATAN_SISWA_LENGTH, ALLOWED_CONTENT_TYPES } from './_config.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Membersihkan nama file dari karakter berbahaya dan path traversal.
 * @param {string} rawName
 * @returns {string}
 */
export function sanitizeFileName(rawName) {
  if (typeof rawName !== 'string' || !rawName.trim()) {
    return 'dokumen_tugas.bin';
  }

  // Hapus path direktori (path traversal) jika ada
  const trimmed = rawName.trim();
  const withoutPath = trimmed.replace(/^.*[\\\/]/, '');

  const lastDot = withoutPath.lastIndexOf('.');
  const ext = (lastDot !== -1 ? withoutPath.slice(lastDot) : '').toLowerCase();
  const base = lastDot !== -1 ? withoutPath.slice(0, lastDot) : withoutPath;

  // Ganti karakter selain huruf, angka, tanda hubung, dan underscore dengan underscore
  const safeBase = base
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);

  const finalBase = safeBase || 'tugas';
  return `${finalBase}${ext}`;
}

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
      return res.status(400).json({ error: 'Format JSON body tidak valid' });
    }
  }

  const { id: requestedId, nama, kelas, bab, fileUrl, fileNama, fileTipe, catatanSiswa } = body || {};

  // 1. Validasi Nama
  if (typeof nama !== 'string' || !nama.trim()) {
    return res.status(400).json({ error: 'Nama lengkap wajib diisi' });
  }
  const cleanNama = nama.trim();
  if (cleanNama.length > MAX_NAMA_LENGTH) {
    return res.status(400).json({ error: `Nama maksimal ${MAX_NAMA_LENGTH} karakter` });
  }

  // 2. Validasi Kelas
  if (!KELAS.includes(kelas)) {
    return res.status(400).json({ error: 'Pilihan kelas tidak valid' });
  }

  // 3. Validasi Bab
  if (!BAB.includes(bab)) {
    return res.status(400).json({ error: 'Pilihan bab tidak valid' });
  }

  // 4. Validasi Tipe File
  if (!ALLOWED_CONTENT_TYPES.includes(fileTipe)) {
    return res.status(400).json({ error: 'Tipe file tidak didukung. Hanya PDF, DOC, atau DOCX yang diizinkan.' });
  }

  // 5. Validasi Catatan Siswa (Opsional, Maks 300 karakter)
  let cleanCatatanSiswa = '';
  if (catatanSiswa !== undefined && catatanSiswa !== null) {
    if (typeof catatanSiswa !== 'string') {
      return res.status(400).json({ error: 'Catatan siswa harus berupa teks' });
    }
    cleanCatatanSiswa = catatanSiswa.trim();
    if (cleanCatatanSiswa.length > MAX_CATATAN_SISWA_LENGTH) {
      return res.status(400).json({ error: `Catatan siswa maksimal ${MAX_CATATAN_SISWA_LENGTH} karakter` });
    }
  }

  // 6. Validasi URL File dari Vercel Blob proyek ini
  if (typeof fileUrl !== 'string' || !fileUrl.trim()) {
    return res.status(400).json({ error: 'URL file tugas wajib ada' });
  }

  try {
    const parsedUrl = new URL(fileUrl);
    const isAllowedLocal = !process.env.BLOB_READ_WRITE_TOKEN && (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1');
    if (!isAllowedLocal) {
      if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.public.blob.vercel-storage.com')) {
        return res.status(400).json({ error: 'URL file harus berasal dari Vercel Blob storage resmi' });
      }
    }
  } catch {
    return res.status(400).json({ error: 'Format URL file tidak valid' });
  }

  // 7. Bersihkan nama file
  const safeFilename = sanitizeFileName(fileNama);

  // 8. Siapkan ID unik (gunakan UUID dari klien jika valid untuk menyelaraskan path file, atau buat baru)
  const id = (typeof requestedId === 'string' && UUID_REGEX.test(requestedId))
    ? requestedId
    : crypto.randomUUID();

  // 9. Hitung versi pengiriman berdasarkan kombinasi kelas, bab, dan kunci nama siswa
  const cleanKelas = kelas.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
  const cleanBab = bab.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
  const kunciNama = cleanNama.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '') || 'siswa';
  const prefix = `tugas/${cleanKelas}/${cleanBab}/${kunciNama}/`;

  let versi = 1;
  try {
    const existing = await list({ prefix });
    const existingCount = (existing.blobs || []).filter(b => b.pathname.endsWith('.json')).length;
    versi = existingCount + 1;
  } catch (err) {
    // Jika list gagal atau mode offline tanpa token, versi default 1
    console.warn('Gagal membaca prefix tugas untuk versi:', err?.message);
  }

  const revisi = versi > 1;

  const tugas = {
    id,
    nama: cleanNama,
    kelas,
    bab,
    fileUrl,
    fileNama: safeFilename,
    fileTipe,
    dikirimPada: new Date().toISOString(),
    nilai: null,
    catatan: '', // Catatan dari guru
    catatanSiswa: cleanCatatanSiswa, // Catatan dari siswa
    dinilaiPada: null,
    versi,
    revisi
  };

  const jsonPath = `${prefix}${id}.json`;

  try {
    // Simpan data tugas di Blob: tugas/{kelas}/{bab}/{kunciNama}/{id}.json
    await put(jsonPath, JSON.stringify(tugas), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: 0
    });

    return res.status(201).json({
      ok: true,
      tugas
    });
  } catch (error) {
    console.error('Error saat menyimpan tugas ke Blob:', error);
    return res.status(500).json({ error: 'Gagal menyimpan rekaman tugas ke penyimpanan' });
  }
}
