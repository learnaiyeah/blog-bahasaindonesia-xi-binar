import crypto from 'node:crypto';

export const COOKIE_NAME = 'session';
export const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 jam

// Memori lokal untuk membatasi percobaan login gagal per IP.
// Catatan: Pada Vercel Serverless Functions, memori ini tidak dibagikan antar instans,
// namun efektif memperlambat serangan brute-force pada instans yang sama.
const failedLoginAttempts = new Map();

/**
 * Membersihkan catatan percobaan login yang sudah lebih dari 10 menit.
 */
function cleanupExpiredAttempts() {
  const now = Date.now();
  for (const [ip, data] of failedLoginAttempts.entries()) {
    if (now - data.firstFailedAt > 10 * 60 * 1000) {
      failedLoginAttempts.delete(ip);
    }
  }
}

/**
 * Memeriksa apakah IP sedang diblokir karena terlalu banyak percobaan gagal.
 * @param {string} ip
 * @returns {{ allowed: boolean, message?: string }}
 */
export function checkLoginRateLimit(ip) {
  cleanupExpiredAttempts();
  const data = failedLoginAttempts.get(ip);
  if (!data) {
    return { allowed: true };
  }

  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 menit
  if (data.count >= 5) {
    const elapsed = now - data.firstFailedAt;
    if (elapsed < windowMs) {
      const sisaMenit = Math.ceil((windowMs - elapsed) / 60000);
      return {
        allowed: false,
        message: `Terlalu banyak percobaan gagal dari IP ini. Silakan coba lagi dalam ${sisaMenit} menit.`
      };
    } else {
      // Periode blokir 10 menit telah berlalu
      failedLoginAttempts.delete(ip);
      return { allowed: true };
    }
  }

  return { allowed: true };
}

/**
 * Mencatat kegagalan login dan menambahkan jeda 1 detik untuk menghambat brute-force.
 * @param {string} ip
 */
export async function recordLoginFailure(ip) {
  const now = Date.now();
  const data = failedLoginAttempts.get(ip) || { count: 0, firstFailedAt: now };
  data.count += 1;
  data.lastFailedAt = now;
  failedLoginAttempts.set(ip, data);

  // Tambahkan jeda 1 detik setiap kegagalan
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Menghapus catatan kegagalan saat login berhasil.
 * @param {string} ip
 */
export function resetLoginRateLimit(ip) {
  failedLoginAttempts.delete(ip);
}

/**
 * Mengambil IP klien dari header permintaan.
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Membandingkan kata sandi secara aman dari timing attack.
 * Menggunakan SHA-256 terlebih dahulu agar kedua buffer memiliki panjang sama persis (32 byte).
 * @param {string} inputPassword
 * @param {string} expectedPassword
 * @returns {boolean}
 */
export function verifyPassword(inputPassword, expectedPassword) {
  if (typeof inputPassword !== 'string' || typeof expectedPassword !== 'string') {
    return false;
  }
  if (inputPassword.length === 0 || expectedPassword.length === 0) {
    return false;
  }

  const hashA = crypto.createHash('sha256').update(inputPassword, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(expectedPassword, 'utf8').digest();

  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Membuat token sesi yang ditandatangani HMAC-SHA256.
 * Format token: base64url(payload).base64url(signature)
 * @param {'guru' | 'pengawas'} peran
 * @returns {string}
 */
export function createSessionToken(peran) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET belum dikonfigurasi di environment variables.');
  }

  const exp = Date.now() + SESSION_DURATION_SECONDS * 1000;
  const payload = JSON.stringify({ peran, exp });
  const payloadB64 = Buffer.from(payload, 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Memverifikasi token sesi dan mengembalikan data sesi jika valid.
 * @param {string} token
 * @returns {{ peran: 'guru' | 'pengawas', exp: number } | null}
 */
export function verifySessionToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payloadB64, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const data = JSON.parse(jsonStr);

    if (!data || !data.peran || !data.exp) {
      return null;
    }

    if (data.peran !== 'guru' && data.peran !== 'pengawas') {
      return null;
    }

    if (Date.now() > data.exp) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Mengurai header Cookie dari permintaan.
 * @param {import('http').IncomingMessage} req
 * @returns {Record<string, string>}
 */
export function parseCookies(req) {
  const header = req.headers?.cookie;
  if (!header) return {};
  const cookies = {};
  const pairs = header.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

/**
 * Mengambil sesi yang sedang aktif dari permintaan.
 * @param {import('http').IncomingMessage} req
 * @returns {{ peran: 'guru' | 'pengawas', exp: number } | null}
 */
export function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Menghasilkan header Set-Cookie untuk login sesi baru.
 * @param {string} token
 * @returns {string}
 */
export function buildSessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DURATION_SECONDS}`;
}

/**
 * Menghasilkan header Set-Cookie untuk menghapus sesi (logout).
 * @returns {string}
 */
export function buildLogoutCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
