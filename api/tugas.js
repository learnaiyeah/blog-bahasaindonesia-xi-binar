import { list } from '@vercel/blob';
import { getSession } from './_auth.js';

/**
 * Menormalkan string untuk pengelompokan (huruf kecil dan spasi dirapikan).
 * @param {string} nama
 * @param {string} kelas
 * @param {string} bab
 * @returns {string}
 */
export function normalizeKey(nama, kelas, bab) {
  const n = (nama || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const k = (kelas || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const b = (bab || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${n}|${k}|${b}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  // 1. Verifikasi autentikasi sesi (Hanya Guru dan Pengawas)
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Tidak diizinkan. Silakan masuk terlebih dahulu.' });
  }

  try {
    // 2. Ambil semua file metadata tugas di folder tugas/
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

    // Filter hanya file JSON
    const jsonBlobs = allBlobs.filter((b) => b.pathname.endsWith('.json'));

    // 3. Baca konten setiap file JSON dengan no-store dan query acak untuk melewati cache CDN
    const fetchPromises = jsonBlobs.map(async (blob) => {
      try {
        const cacheBustUrl = `${blob.url}?t=${Date.now()}_${Math.random()}`;
        const resp = await fetch(cacheBustUrl, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data;
      } catch (err) {
        console.error(`Gagal membaca rekaman tugas dari ${blob.pathname}:`, err);
        return null;
      }
    });

    const records = (await Promise.all(fetchPromises)).filter(Boolean);

    // 4. Kelompokkan rekaman berdasarkan nama, kelas, dan bab (huruf kecil, spasi dirapikan)
    const groups = new Map();
    for (const record of records) {
      const key = normalizeKey(record.nama, record.kelas, record.bab);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(record);
    }

    // 5. Urutkan tiap grup dari terlama ke terbaru untuk memastikan nomor versi konsisten
    const result = [];
    for (const [, groupList] of groups.entries()) {
      groupList.sort((a, b) => new Date(a.dikirimPada).getTime() - new Date(b.dikirimPada).getTime());

      // Pastikan field versi ada pada tiap rekaman
      groupList.forEach((item, idx) => {
        if (!item.versi) {
          item.versi = idx + 1;
        }
        item.revisi = item.versi > 1;
      });

      // Urutkan grup secara descending (versi terbaru di indeks 0)
      groupList.sort((a, b) => new Date(b.dikirimPada).getTime() - new Date(a.dikirimPada).getTime());
      const latest = groupList[0];
      const previous = groupList.slice(1);

      // Hitung status nilai: "Belum dinilai", "Sudah dinilai", "Perlu dinilai ulang"
      let statusNilai = 'belum';
      let labelStatus = 'Belum dinilai';
      let nilaiLama = null;
      let versiNilaiLama = null;

      if (latest.nilai !== null && latest.nilai !== undefined) {
        statusNilai = 'sudah';
        labelStatus = 'Sudah dinilai';
      } else {
        // Versi terbaru belum dinilai, periksa apakah versi sebelumnya sudah pernah dinilai
        const gradedPrev = previous.find((p) => p.nilai !== null && p.nilai !== undefined);
        if (gradedPrev) {
          statusNilai = 'perlu_ulang';
          labelStatus = 'Perlu dinilai ulang';
          nilaiLama = gradedPrev.nilai;
          versiNilaiLama = gradedPrev.versi;
        } else {
          statusNilai = 'belum';
          labelStatus = 'Belum dinilai';
        }
      }

      result.push({
        ...latest,
        statusNilai,
        labelStatus,
        nilaiLama,
        versiNilaiLama,
        versiSebelumnya: previous
      });
    }

    // 6. Urutkan daftar utama berdasarkan waktu kirim rekaman terbaru (descending)
    result.sort((a, b) => new Date(b.dikirimPada).getTime() - new Date(a.dikirimPada).getTime());

    return res.status(200).json({
      tugas: result
    });
  } catch (error) {
    console.error('Error saat mengambil daftar tugas dari Blob:', error);
    return res.status(500).json({ error: 'Gagal mengambil daftar tugas' });
  }
}
