import { list, del } from '@vercel/blob';
import { getSession } from './_auth.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  // 1. Verifikasi autentikasi sesi
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Tidak diizinkan. Silakan masuk terlebih dahulu.' });
  }

  // 2. Hanya peran guru yang diizinkan menghapus. Pengawas mendapat 403.
  if (session.peran !== 'guru') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya guru yang dapat menghapus tugas.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Format JSON body tidak valid' });
    }
  }

  const { id, hapusSiswa } = body || {};

  // 3. Validasi ID
  if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'ID tugas tidak valid' });
  }

  try {
    // 4. Cari file blob metadata JSON berdasarkan ID
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

    // 5. Baca data JSON untuk mendapatkan data tugas
    const cacheBustUrl = `${targetBlob.url}?t=${Date.now()}_${Math.random()}`;
    const readResp = await fetch(cacheBustUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!readResp.ok) {
      return res.status(404).json({ error: 'Gagal membaca rekaman tugas yang akan dihapus' });
    }

    const tugasData = await readResp.json();

    // JIKA GURU MEMILIH HAPUS SELURUH SISWA (BESERTA SEMUA VERSINYA)
    if (hapusSiswa) {
      const cleanKelas = (tugasData.kelas || '').trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
      const cleanBab = (tugasData.bab || '').trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
      const kunciNama = (tugasData.nama || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '') || 'siswa';
      const studentPrefix = `tugas/${cleanKelas}/${cleanBab}/${kunciNama}/`;

      // Kumpulkan semua blob rekaman milik siswa ini
      let studentBlobs = allBlobs.filter(b => b.pathname.startsWith(studentPrefix) && b.pathname.endsWith('.json'));
      if (!studentBlobs.some(b => b.url === targetBlob.url)) {
        studentBlobs.push(targetBlob);
      }

      let deletedCount = 0;
      for (const b of studentBlobs) {
        try {
          const vUrl = `${b.url}?t=${Date.now()}_${Math.random()}`;
          const vResp = await fetch(vUrl, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
          });
          if (vResp.ok) {
            const vData = await vResp.json();
            if (vData.fileUrl) {
              try {
                await del(vData.fileUrl);
              } catch (fErr) {
                console.error('Gagal menghapus file tugas fisik:', fErr);
              }
            }
          }
        } catch (rErr) {
          console.error('Gagal membaca blob versi:', rErr);
        }

        try {
          await del(b.url);
          deletedCount++;
        } catch (jErr) {
          console.error('Gagal menghapus file JSON blob:', jErr);
          return res.status(500).json({ error: 'Gagal menghapus sebagian rekaman data siswa dari penyimpanan' });
        }
      }

      return res.status(200).json({
        ok: true,
        message: `Seluruh data siswa "${tugasData.nama}" (${deletedCount} tugas/revisi) berhasil dihapus.`
      });
    }

    // JIKA HANYA MENGHAPUS SATU VERSI TUGAS TERTENTU
    const fileUrl = tugasData.fileUrl;

    // 6. Hapus file tugas fisik di Blob (jangan berpura-pura berhasil jika gagal)
    if (fileUrl) {
      try {
        await del(fileUrl);
      } catch (fileErr) {
        console.error('Gagal menghapus file tugas fisik di Blob:', fileErr);
        return res.status(500).json({ error: 'Gagal menghapus berkas fisik tugas dari penyimpanan' });
      }
    }

    // 7. Hapus file JSON rekaman di Blob
    try {
      await del(targetBlob.url);
    } catch (jsonErr) {
      console.error('Gagal menghapus file JSON rekaman di Blob:', jsonErr);
      return res.status(500).json({ error: 'Gagal menghapus rekaman data tugas dari penyimpanan' });
    }

    return res.status(200).json({
      ok: true,
      message: 'Tugas dan berkas berhasil dihapus'
    });
  } catch (error) {
    console.error('Error saat proses penghapusan tugas:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server saat menghapus tugas' });
  }
}
