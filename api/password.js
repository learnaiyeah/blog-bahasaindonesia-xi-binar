import { getSession, getPassword, savePassword, verifyPassword, syncPasswordsFromBlob } from './_auth.js';

/**
 * Endpoint Ubah Kata Sandi (Guru dan Pengawas)
 * POST /api/password
 * Body: { passwordLama, passwordBaru, konfirmasiPassword }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  // 1. Verifikasi Sesi
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.' });
  }

  const peran = session.peran;
  if (peran !== 'guru' && peran !== 'pengawas') {
    return res.status(403).json({ error: 'Peran tidak memiliki hak akses untuk mengubah kata sandi.' });
  }

  // 2. Baca Body
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Format JSON body tidak valid' });
    }
  }

  const { passwordLama, passwordBaru, konfirmasiPassword } = body || {};

  // 3. Validasi Input
  if (!passwordLama || typeof passwordLama !== 'string') {
    return res.status(400).json({ error: 'Kata sandi saat ini (lama) wajib diisi.' });
  }

  if (!passwordBaru || typeof passwordBaru !== 'string') {
    return res.status(400).json({ error: 'Kata sandi baru wajib diisi.' });
  }

  if (passwordBaru.length < 6) {
    return res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
  }

  if (passwordBaru.length > 100) {
    return res.status(400).json({ error: 'Kata sandi baru maksimal 100 karakter.' });
  }

  if (passwordBaru !== konfirmasiPassword) {
    return res.status(400).json({ error: 'Konfirmasi kata sandi baru tidak cocok.' });
  }

  if (passwordBaru === passwordLama) {
    return res.status(400).json({ error: 'Kata sandi baru tidak boleh sama dengan kata sandi lama.' });
  }

  // 4. Verifikasi Kata Sandi Lama (sinkronkan dari Blob jika ada)
  await syncPasswordsFromBlob();
  const currentPassword = getPassword(peran);
  if (!verifyPassword(passwordLama, currentPassword)) {
    return res.status(400).json({ error: 'Kata sandi saat ini (lama) tidak sesuai.' });
  }

  // 5. Simpan Kata Sandi Baru
  try {
    await savePassword(peran, passwordBaru);
    const labelPeran = peran === 'guru' ? 'Guru' : 'Pengawas';
    return res.status(200).json({
      success: true,
      message: `Kata sandi untuk peran ${labelPeran} berhasil diperbarui.`
    });
  } catch (err) {
    console.error('Error saat menyimpan kata sandi:', err);
    return res.status(500).json({ error: err.message || 'Gagal menyimpan kata sandi baru.' });
  }
}
