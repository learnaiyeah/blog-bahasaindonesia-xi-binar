import { getSession } from './_auth.js';
import { getDaftarBabDetail, KELAS } from './_config.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  // 1. Verifikasi Sesi - Hanya Guru yang berhak mengunduh backup
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Tidak diizinkan. Silakan masuk terlebih dahulu.' });
  }
  if (session.peran !== 'guru') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya guru yang dapat mengunduh cadangan data.' });
  }

  try {
    let allTugas = [];

    // Jika di Vercel Blob
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { list } = await import('@vercel/blob');
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

      const jsonBlobs = allBlobs.filter((b) => b.pathname.endsWith('.json'));
      const fetchPromises = jsonBlobs.map(async (blob) => {
        try {
          const resp = await fetch(`${blob.url}?t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache, no-store' }
          });
          if (resp.ok) return await resp.json();
        } catch {}
        return null;
      });

      const results = await Promise.all(fetchPromises);
      allTugas = results.filter(Boolean);
    }

    const backupData = {
      app: 'Portal KTI SMK Bina Rahayu',
      versiSistem: '2.0.0',
      tanggalEkspor: new Date().toISOString(),
      waktuLokal: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
      pengampu: 'Ibu Ulfa',
      kelas: KELAS,
      babDetail: getDaftarBabDetail(),
      totalTugas: allTugas.length,
      tugas: allTugas
    };

    const filename = `backup_kti_smk_binarahayu_${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).json(backupData);
  } catch (err) {
    console.error('Error saat membuat backup:', err);
    return res.status(500).json({ error: 'Gagal membuat cadangan data' });
  }
}
