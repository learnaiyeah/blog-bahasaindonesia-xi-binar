import { getSession, getPassword, verifyPassword } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  // 1. Verifikasi Sesi - Hanya Guru yang berhak me-reset data
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Tidak diizinkan. Silakan masuk terlebih dahulu.' });
  }
  if (session.peran !== 'guru') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya guru yang dapat me-reset data tugas.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Format JSON body tidak valid' });
    }
  }

  const { konfirmasi, password, scope = 'semua' } = body || {};

  // 2. Validasi Konfirmasi Teks
  if (konfirmasi !== 'RESET') {
    return res.status(400).json({ error: 'Ketik kata RESET dengan huruf besar untuk mengonfirmasi penghapusan data.' });
  }

  // 3. Verifikasi Kata Sandi Guru
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Kata sandi guru wajib diisi untuk verifikasi keamanan.' });
  }

  const currentGuruPassword = getPassword('guru');
  if (!verifyPassword(password, currentGuruPassword)) {
    return res.status(400).json({ error: 'Kata sandi guru tidak sesuai.' });
  }

  // 4. Validasi Scope
  if (scope !== 'semua' && scope !== 'XI-1' && scope !== 'XI-2') {
    return res.status(400).json({ error: 'Pilihan cakupan kelas tidak valid.' });
  }

  try {
    let deletedCount = 0;

    // Jika di Vercel Blob
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { list, del } = await import('@vercel/blob');
      const prefix = scope === 'semua' ? 'tugas/' : `tugas/${scope}/`;

      let allBlobs = [];
      let cursor;
      let hasMore = true;

      while (hasMore) {
        const response = await list({
          prefix,
          cursor,
          limit: 1000
        });
        allBlobs = allBlobs.concat(response.blobs);
        hasMore = response.hasMore;
        cursor = response.cursor;
      }

      if (allBlobs.length > 0) {
        const jsonBlobs = allBlobs.filter(b => b.pathname.endsWith('.json'));
        const fileUrlsToDelete = [];

        for (const jb of jsonBlobs) {
          try {
            const resp = await fetch(jb.url, { cache: 'no-store' });
            if (resp.ok) {
              const data = await resp.json();
              if (data && data.fileUrl) {
                fileUrlsToDelete.push(data.fileUrl);
              }
            }
          } catch {}
        }

        const urlsToDelete = allBlobs.map(b => b.url).concat(fileUrlsToDelete);
        const uniqueUrls = [...new Set(urlsToDelete)];

        for (let i = 0; i < uniqueUrls.length; i += 100) {
          const chunk = uniqueUrls.slice(i, i + 100);
          await del(chunk);
        }
        deletedCount = jsonBlobs.length;
      }
    }

    const scopeDesc = scope === 'semua' ? 'seluruh kelas (XI-1 & XI-2)' : `kelas ${scope}`;
    return res.status(200).json({
      success: true,
      message: `Data tugas untuk ${scopeDesc} berhasil dibersihkan (${deletedCount} rekaman dihapus).`,
      deletedCount
    });
  } catch (err) {
    console.error('Error saat mereset data:', err);
    return res.status(500).json({ error: 'Gagal membersihkan data tugas' });
  }
}
