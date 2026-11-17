import {
  getClientIp,
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
  verifyPassword,
  createSessionToken,
  buildSessionCookie,
  getPassword,
  syncPasswordsFromBlob
} from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  const clientIp = getClientIp(req);

  // 1. Periksa batas percobaan login (maksimal 5 kali gagal dalam 10 menit)
  const rateLimitStatus = checkLoginRateLimit(clientIp);
  if (!rateLimitStatus.allowed) {
    return res.status(429).json({ error: rateLimitStatus.message });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Format JSON body tidak valid' });
    }
  }

  const { peran, password } = body || {};

  // 2. Validasi peran yang diminta
  if (peran !== 'guru' && peran !== 'pengawas') {
    return res.status(400).json({ error: 'Peran harus berupa "guru" atau "pengawas"' });
  }

  // 3. Ambil kata sandi rahasia dari passwords.json, Vercel Blob, atau environment variables
  await syncPasswordsFromBlob();
  const expectedPassword = getPassword(peran);

  if (!expectedPassword) {
    console.error(`Kata sandi untuk peran ${peran} belum diatur di environment variable.`);
    return res.status(500).json({ error: 'Kata sandi sistem belum dikonfigurasi oleh administrator' });
  }

  // 4. Periksa kecocokan kata sandi dengan timingSafeEqual
  const isMatch = verifyPassword(password, expectedPassword);

  if (!isMatch) {
    // Catat kegagalan dan berikan jeda 1 detik
    await recordLoginFailure(clientIp);
    return res.status(401).json({ error: 'Password salah' });
  }

  // 5. Berhasil: reset catatan kegagalan untuk IP ini
  resetLoginRateLimit(clientIp);

  try {
    const token = createSessionToken(peran);
    const cookieHeader = buildSessionCookie(token);

    res.setHeader('Set-Cookie', cookieHeader);
    return res.status(200).json({
      ok: true,
      peran
    });
  } catch (error) {
    console.error('Error saat membuat sesi login:', error);
    return res.status(500).json({ error: 'Gagal membuat sesi pengguna' });
  }
}
