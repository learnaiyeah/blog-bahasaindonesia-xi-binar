import { list, put } from '@vercel/blob';
import { getSession } from './_auth.js';
import { MAX_CATATAN_LENGTH } from './_config.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  // 1. Verifikasi sesi
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Tidak diizinkan. Silakan masuk terlebih dahulu.' });
  }

  // 2. Hanya peran guru yang diizinkan memberi nilai. Pengawas harus mendapat 403.
  if (session.peran !== 'guru') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya guru yang dapat memberikan atau mengubah nilai.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Format JSON body tidak valid' });
    }
  }

  const { id, nilai, catatan } = body || {};

  // 3. Validasi ID
  if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'ID tugas tidak valid' });
  }

  // 4. Validasi Nilai (angka 0 sampai 100)
  const nilaiNum = Number(nilai);
  if (nilai === null || nilai === undefined || isNaN(nilaiNum) || nilaiNum < 0 || nilaiNum > 100) {
    return res.status(400).json({ error: 'Nilai harus berupa angka antara 0 sampai 100' });
  }

  // 5. Validasi Catatan (maksimal 500 karakter)
  const cleanCatatan = (typeof catatan === 'string') ? catatan.trim() : '';
  if (cleanCatatan.length > MAX_CATATAN_LENGTH) {
    return res.status(400).json({ error: `Catatan maksimal ${MAX_CATATAN_LENGTH} karakter` });
  }

  try {
    // 6. Cari lokasi file blob rekaman tugas berdasarkan ID
    let allBlobs = [];
    let cursor;
    let hasMore = true;

    while (hasMore) {
      const response = await list({
        prefix: 'tugas/',
        cursor,
        limit: 1000
      });
      allBlobs = allBlobs.concat(response.blobs);
      hasMore = response.hasMore;
      cursor = response.cursor;
    }

    const targetBlob = allBlobs.find((b) => b.pathname.endsWith(`/${id}.json`));
    if (!targetBlob || !targetBlob.url) {
      return res.status(404).json({ error: 'Rekaman tugas tidak ditemukan' });
    }

    const pathname = targetBlob.pathname;

    // 7. Baca JSON lama dengan query acak dan no-store untuk menghindari cache CDN lama
    const cacheBustUrl = `${targetBlob.url}?t=${Date.now()}_${Math.random()}`;
    const readResp = await fetch(cacheBustUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!readResp.ok) {
      return res.status(404).json({ error: 'Gagal mengambil isi file tugas' });
    }

    const tugasData = await readResp.json();

    // 8. Perbarui nilai, catatan, dan dinilaiPada
    tugasData.nilai = Math.round(nilaiNum * 100) / 100; // Simpan hingga 2 desimal jika ada
    tugasData.catatan = cleanCatatan;
    tugasData.dinilaiPada = new Date().toISOString();

    // 9. Tulis ulang dengan allowOverwrite: true dan cacheControlMaxAge: 0
    await put(pathname, JSON.stringify(tugasData), {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true,
      addRandomSuffix: false,
      cacheControlMaxAge: 0
    });

    // 10. Kembalikan rekaman terbaru agar layar guru langsung menampilkan nilai yang baru disimpan
    return res.status(200).json({
      ok: true,
      tugas: tugasData
    });
  } catch (error) {
    console.error('Error saat menyimpan nilai ke Blob:', error);
    return res.status(500).json({ error: 'Gagal menyimpan nilai ke penyimpanan' });
  }
}
