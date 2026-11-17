import http from 'node:http';
import assert from 'node:assert';
import configHandler from '../api/config.js';
import loginHandler from '../api/login.js';
import logoutHandler from '../api/logout.js';
import sesiHandler from '../api/sesi.js';
import submitHandler from '../api/submit.js';
import nilaiHandler from '../api/nilai.js';
import tugasHandler from '../api/tugas.js';
import hapusHandler from '../api/hapus.js';
import babHandler from '../api/bab.js';
import passwordHandler from '../api/password.js';
import backupHandler from '../api/backup.js';
import resetHandler from '../api/reset.js';
import { resetLoginRateLimit, resetPasswordStore } from '../api/_auth.js';

process.env.SESSION_SECRET = 'super_secret_session_key_for_testing_purposes_12345';
process.env.GURU_PASSWORD = 'passwordGuru123';
process.env.PENGAWAS_PASSWORD = 'passwordPengawas456';
resetPasswordStore();

console.log('--- Memulai Pengujian Integrasi HTTP API ---');

// Helper untuk membuat server lokal pengujian
function createTestServer() {
  return http.createServer(async (req, res) => {
    // Helper status & json seperti di Vercel Serverless
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return res;
    };

    // Parse body jika ada
    let rawBody = '';
    for await (const chunk of req) {
      rawBody += chunk;
    }
    if (rawBody) {
      try {
        req.body = JSON.parse(rawBody);
      } catch {
        req.body = rawBody;
      }
    }

    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    try {
      if (pathname === '/api/config') return await configHandler(req, res);
      if (pathname === '/api/login') return await loginHandler(req, res);
      if (pathname === '/api/logout') return await logoutHandler(req, res);
      if (pathname === '/api/sesi') return await sesiHandler(req, res);
      if (pathname === '/api/submit') return await submitHandler(req, res);
      if (pathname === '/api/nilai') return await nilaiHandler(req, res);
      if (pathname === '/api/tugas') return await tugasHandler(req, res);
      if (pathname === '/api/hapus') return await hapusHandler(req, res);
      if (pathname === '/api/bab') return await babHandler(req, res);
      if (pathname === '/api/password') return await passwordHandler(req, res);
      if (pathname === '/api/backup') return await backupHandler(req, res);
      if (pathname === '/api/reset') return await resetHandler(req, res);

      res.status(404).json({ error: 'Not found' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

const server = createTestServer();

server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Uji GET /api/config
    console.log('1. Uji GET /api/config (harus hanya XI-1 dan XI-2)...');
    const configRes = await fetch(`${baseUrl}/api/config`);
    assert.strictEqual(configRes.status, 200);
    const configData = await configRes.json();
    assert.deepStrictEqual(configData.kelas, ['XI-1', 'XI-2'], 'Kelas harus hanya XI-1 dan XI-2');
    assert.ok(Array.isArray(configData.bab) && configData.bab.length > 0, 'Daftar bab harus berupa array tidak kosong');

    // Uji metode selain GET ditolak
    const postConfigRes = await fetch(`${baseUrl}/api/config`, { method: 'POST' });
    assert.strictEqual(postConfigRes.status, 405);

    // 2. Uji GET /api/sesi tanpa login (harus 401)
    console.log('2. Uji GET /api/sesi tanpa login...');
    const noAuthSesi = await fetch(`${baseUrl}/api/sesi`);
    assert.strictEqual(noAuthSesi.status, 401, 'Harus 401 jika belum login');

    // 3. Uji GET /api/tugas tanpa login (harus 401)
    console.log('3. Uji GET /api/tugas tanpa login...');
    const noAuthTugas = await fetch(`${baseUrl}/api/tugas`);
    assert.strictEqual(noAuthTugas.status, 401, 'Harus 401 jika belum login');

    // 4. Uji POST /api/login password salah
    console.log('4. Uji POST /api/login dengan password salah...');
    resetLoginRateLimit('127.0.0.1');
    const wrongLoginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peran: 'guru', password: 'salah' })
    });
    assert.strictEqual(wrongLoginRes.status, 401);
    const wrongLoginData = await wrongLoginRes.json();
    assert.strictEqual(wrongLoginData.error, 'Password salah');

    // 5. Uji POST /api/login peran tidak valid
    console.log('5. Uji POST /api/login peran tidak valid...');
    const invalidRoleRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peran: 'admin', password: '123' })
    });
    assert.strictEqual(invalidRoleRes.status, 400);

    // 6. Uji POST /api/login Guru berhasil
    console.log('6. Uji POST /api/login Guru berhasil...');
    resetLoginRateLimit('127.0.0.1');
    const guruLoginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peran: 'guru', password: 'passwordGuru123' })
    });
    assert.strictEqual(guruLoginRes.status, 200);
    const guruCookie = guruLoginRes.headers.get('set-cookie');
    assert.ok(guruCookie && guruCookie.includes('session='), 'Harus mengembalikan cookie session');

    // 7. Uji GET /api/sesi dengan cookie Guru
    console.log('7. Uji GET /api/sesi dengan cookie Guru...');
    const guruSesiRes = await fetch(`${baseUrl}/api/sesi`, {
      headers: { Cookie: guruCookie }
    });
    assert.strictEqual(guruSesiRes.status, 200);
    const guruSesiData = await guruSesiRes.json();
    assert.strictEqual(guruSesiData.peran, 'guru');

    // 8. Uji POST /api/login Pengawas berhasil
    console.log('8. Uji POST /api/login Pengawas berhasil...');
    const pengawasLoginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peran: 'pengawas', password: 'passwordPengawas456' })
    });
    assert.strictEqual(pengawasLoginRes.status, 200);
    const pengawasCookie = pengawasLoginRes.headers.get('set-cookie');
    assert.ok(pengawasCookie && pengawasCookie.includes('session='));

    // 9. Uji GET /api/sesi dengan cookie Pengawas
    console.log('9. Uji GET /api/sesi dengan cookie Pengawas...');
    const pengawasSesiRes = await fetch(`${baseUrl}/api/sesi`, {
      headers: { Cookie: pengawasCookie }
    });
    assert.strictEqual(pengawasSesiRes.status, 200);
    const pengawasSesiData = await pengawasSesiRes.json();
    assert.strictEqual(pengawasSesiData.peran, 'pengawas');

    // 10. Uji POST /api/nilai dengan peran Pengawas (HARUS DITOLAK 403!)
    console.log('10. Uji POST /api/nilai oleh Pengawas (harus 403 Forbidden)...');
    const pengawasNilaiRes = await fetch(`${baseUrl}/api/nilai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: pengawasCookie
      },
      body: JSON.stringify({
        id: '12345678-1234-1234-1234-123456789abc',
        nilai: 90,
        catatan: 'Catatan pengawas'
      })
    });
    assert.strictEqual(pengawasNilaiRes.status, 403, 'Pengawas harus mendapat 403 Forbidden saat menilai!');
    const pengawasNilaiData = await pengawasNilaiRes.json();
    assert.ok(pengawasNilaiData.error.includes('Hanya guru'));

    // 11. Uji POST /api/nilai tanpa login (harus 401)
    console.log('11. Uji POST /api/nilai tanpa login (harus 401)...');
    const noAuthNilaiRes = await fetch(`${baseUrl}/api/nilai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: '12345678-1234-1234-1234-123456789abc',
        nilai: 90
      })
    });
    assert.strictEqual(noAuthNilaiRes.status, 401);

    // 12. Uji validasi input pada POST /api/nilai (oleh Guru)
    console.log('12. Uji validasi nilai di luar batas (oleh Guru)...');
    const overGradeRes = await fetch(`${baseUrl}/api/nilai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: guruCookie
      },
      body: JSON.stringify({
        id: '12345678-1234-1234-1234-123456789abc',
        nilai: 150 // Melebihi 100
      })
    });
    assert.strictEqual(overGradeRes.status, 400);

    // 13. Uji POST /api/hapus
    console.log('13. Uji endpoint POST /api/hapus...');
    // Tanpa login -> 401
    const noAuthHapusRes = await fetch(`${baseUrl}/api/hapus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: '12345678-1234-1234-1234-123456789abc' })
    });
    assert.strictEqual(noAuthHapusRes.status, 401, 'Hapus tanpa login harus 401');

    // Pengawas mencoba menghapus -> 403
    const pengawasHapusRes = await fetch(`${baseUrl}/api/hapus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: pengawasCookie
      },
      body: JSON.stringify({ id: '12345678-1234-1234-1234-123456789abc' })
    });
    assert.strictEqual(pengawasHapusRes.status, 403, 'Hapus oleh pengawas harus 403 Forbidden');

    // Guru dengan ID tidak valid -> 400
    const badIdHapusRes = await fetch(`${baseUrl}/api/hapus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: guruCookie
      },
      body: JSON.stringify({ id: 'bukan-uuid' })
    });
    assert.strictEqual(badIdHapusRes.status, 400);

    // Pengawas mencoba hapus siswa -> 403 Forbidden
    const pengawasHapusSiswaRes = await fetch(`${baseUrl}/api/hapus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: pengawasCookie
      },
      body: JSON.stringify({ id: 'a1b2c3d4-e5f6-4a5b-8c9d-111111111111', hapusSiswa: true })
    });
    assert.strictEqual(pengawasHapusSiswaRes.status, 403, 'Pengawas dilarang menghapus siswa (403)');

    // 14. Uji validasi pada POST /api/submit
    console.log('14. Uji validasi POST /api/submit (kelas XI-1, XI-2, catatan siswa)...');

    // Kelas XI-3 harus DITOLAK
    const xi3ClassRes = await fetch(`${baseUrl}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: 'Candra',
        kelas: 'XI-3', // Kelas XI-3 tidak diizinkan
        bab: 'Bab 1',
        fileUrl: 'https://store123.public.blob.vercel-storage.com/file/123/tugas.pdf',
        fileNama: 'tugas.pdf',
        fileTipe: 'application/pdf'
      })
    });
    assert.strictEqual(xi3ClassRes.status, 400, 'Kelas XI-3 harus ditolak dengan status 400');

    // Kelas lama X-1 harus DITOLAK
    const oldClassRes = await fetch(`${baseUrl}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: 'Budi',
        kelas: 'X-1', // Kelas lama
        bab: 'Bab 1',
        fileUrl: 'https://store123.public.blob.vercel-storage.com/file/123/tugas.pdf',
        fileNama: 'tugas.pdf',
        fileTipe: 'application/pdf'
      })
    });
    assert.strictEqual(oldClassRes.status, 400, 'Kelas lama X-1 harus ditolak');

    // Catatan siswa melebihi 300 karakter harus DITOLAK
    const longNoteSiswa = 'A'.repeat(301);
    const longNoteRes = await fetch(`${baseUrl}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: 'Ahmad',
        kelas: 'XI-1',
        bab: 'Bab 1',
        catatanSiswa: longNoteSiswa,
        fileUrl: 'https://store123.public.blob.vercel-storage.com/file/123/tugas.pdf',
        fileNama: 'tugas.pdf',
        fileTipe: 'application/pdf'
      })
    });
    assert.strictEqual(longNoteRes.status, 400, 'Catatan siswa > 300 karakter harus ditolak');

    // Nama melebihi 60 karakter
    const longNama = 'A'.repeat(61);
    const longNamaRes = await fetch(`${baseUrl}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: longNama,
        kelas: 'XI-1',
        bab: 'Bab 1',
        fileUrl: 'https://store123.public.blob.vercel-storage.com/file/123/tugas.pdf',
        fileNama: 'tugas.pdf',
        fileTipe: 'application/pdf'
      })
    });
    assert.strictEqual(longNamaRes.status, 400);

    // Domain fileUrl bukan Vercel Blob
    const evilDomainRes = await fetch(`${baseUrl}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: 'Ahmad',
        kelas: 'XI-1',
        bab: 'Bab 1',
        fileUrl: 'https://evil-site.com/malicious.pdf',
        fileNama: 'tugas.pdf',
        fileTipe: 'application/pdf'
      })
    });
    assert.strictEqual(evilDomainRes.status, 400);

    // 15. Uji endpoint /api/bab (Pengaturan Bab oleh Guru)
    console.log('15. Uji endpoint /api/bab (Pengaturan Bab oleh Guru)...');
    // a. GET /api/bab tanpa login (publik)
    const getBabRes = await fetch(`${baseUrl}/api/bab`);
    assert.strictEqual(getBabRes.status, 200);
    const getBabData = await getBabRes.json();
    assert.ok(Array.isArray(getBabData.bab));

    // b. POST /api/bab tanpa login (harus 401)
    const postBabNoLogin = await fetch(`${baseUrl}/api/bab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bab: ['Bab 1: Pendahuluan', 'Bab 2: Kajian Pustaka'] })
    });
    assert.strictEqual(postBabNoLogin.status, 401);

    // c. POST /api/bab oleh Pengawas (harus 403 Forbidden)
    const postBabPengawas = await fetch(`${baseUrl}/api/bab`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: pengawasCookie
      },
      body: JSON.stringify({ bab: ['Bab 1: Pendahuluan'] })
    });
    assert.strictEqual(postBabPengawas.status, 403);

    // d. POST /api/bab oleh Guru (berhasil)
    const postBabGuru = await fetch(`${baseUrl}/api/bab`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: guruCookie
      },
      body: JSON.stringify({ bab: ['Bab 1: Pendahuluan', 'Bab 2: Landasan Teori', 'Bab 3: Metode Penelitian'] })
    });
    assert.strictEqual(postBabGuru.status, 200);
    const postBabGuruData = await postBabGuru.json();
    assert.strictEqual(postBabGuruData.success, true);
    assert.strictEqual(postBabGuruData.bab.length, 3);

    // Kembalikan ke default ['Bab 1', 'Bab 2'] untuk kestabilan
    await fetch(`${baseUrl}/api/bab`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: guruCookie
      },
      body: JSON.stringify({ bab: ['Bab 1', 'Bab 2'] })
    });

    // 16. Uji POST /api/password (Ubah Kata Sandi Guru dan Pengawas)
    console.log('16. Uji POST /api/password...');
    // a. Tanpa sesi login
    const noAuthPass = await fetch(`${baseUrl}/api/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passwordLama: 'xxx', passwordBaru: 'barubaru123', konfirmasiPassword: 'barubaru123' })
    });
    assert.strictEqual(noAuthPass.status, 401);

    // b. Kata sandi lama salah
    const wrongOldPass = await fetch(`${baseUrl}/api/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: guruCookie },
      body: JSON.stringify({ passwordLama: 'passwordSalah', passwordBaru: 'guruBaru123', konfirmasiPassword: 'guruBaru123' })
    });
    assert.strictEqual(wrongOldPass.status, 400);

    // c. Konfirmasi tidak cocok
    const mismatchPass = await fetch(`${baseUrl}/api/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: guruCookie },
      body: JSON.stringify({ passwordLama: 'passwordGuru123', passwordBaru: 'guruBaru123', konfirmasiPassword: 'guruBaruBeda' })
    });
    assert.strictEqual(mismatchPass.status, 400);

    // d. Kata sandi baru terlalu pendek (< 6 char)
    const shortPass = await fetch(`${baseUrl}/api/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: guruCookie },
      body: JSON.stringify({ passwordLama: 'passwordGuru123', passwordBaru: '123', konfirmasiPassword: '123' })
    });
    assert.strictEqual(shortPass.status, 400);

    // e. Guru mengubah kata sandi berhasil
    const changePassGuru = await fetch(`${baseUrl}/api/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: guruCookie },
      body: JSON.stringify({ passwordLama: 'passwordGuru123', passwordBaru: 'guruBaru123', konfirmasiPassword: 'guruBaru123' })
    });
    assert.strictEqual(changePassGuru.status, 200);
    const changePassGuruData = await changePassGuru.json();
    assert.strictEqual(changePassGuruData.success, true);

    // f. Login guru dengan kata sandi lama ditolak
    resetLoginRateLimit('127.0.0.1');
    const oldLoginFail = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peran: 'guru', password: 'passwordGuru123' })
    });
    assert.strictEqual(oldLoginFail.status, 401);

    // g. Login guru dengan kata sandi baru berhasil
    resetLoginRateLimit('127.0.0.1');
    const newLoginSuccess = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peran: 'guru', password: 'guruBaru123' })
    });
    assert.strictEqual(newLoginSuccess.status, 200);
    const newGuruCookie = newLoginSuccess.headers.get('set-cookie').split(';')[0];

    // h. Kembalikan kata sandi guru ke default untuk kestabilan uji
    await fetch(`${baseUrl}/api/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: newGuruCookie },
      body: JSON.stringify({ passwordLama: 'guruBaru123', passwordBaru: 'passwordGuru123', konfirmasiPassword: 'passwordGuru123' })
    });

    // i. Pengawas mengubah kata sandi berhasil
    const changePassPengawas = await fetch(`${baseUrl}/api/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: pengawasCookie },
      body: JSON.stringify({ passwordLama: 'passwordPengawas456', passwordBaru: 'pengawasBaru456', konfirmasiPassword: 'pengawasBaru456' })
    });
    assert.strictEqual(changePassPengawas.status, 200);

    // j. Login pengawas dengan kata sandi baru berhasil
    resetLoginRateLimit('127.0.0.1');
    const newPengawasLogin = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peran: 'pengawas', password: 'pengawasBaru456' })
    });
    assert.strictEqual(newPengawasLogin.status, 200);
    const newPengawasCookie = newPengawasLogin.headers.get('set-cookie').split(';')[0];

    // k. Kembalikan kata sandi pengawas ke default
    await fetch(`${baseUrl}/api/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: newPengawasCookie },
      body: JSON.stringify({ passwordLama: 'pengawasBaru456', passwordBaru: 'passwordPengawas456', konfirmasiPassword: 'passwordPengawas456' })
    });
    resetPasswordStore();

    // 17. Uji GET /api/backup & POST /api/reset (Cadangkan dan Bersihkan Data Tugas)
    console.log('17. Uji GET /api/backup dan POST /api/reset...');
    // a. GET /api/backup tanpa login -> 401
    const noAuthBackup = await fetch(`${baseUrl}/api/backup`);
    assert.strictEqual(noAuthBackup.status, 401);

    // b. GET /api/backup oleh Pengawas -> 403
    const pengawasBackup = await fetch(`${baseUrl}/api/backup`, {
      headers: { cookie: pengawasCookie }
    });
    assert.strictEqual(pengawasBackup.status, 403);

    // c. GET /api/backup oleh Guru -> 200
    const guruBackup = await fetch(`${baseUrl}/api/backup`, {
      headers: { cookie: guruCookie }
    });
    assert.strictEqual(guruBackup.status, 200);
    const backupJson = await guruBackup.json();
    assert.strictEqual(backupJson.app, 'Portal KTI SMK Bina Rahayu');
    assert.ok(Array.isArray(backupJson.babDetail));

    // d. POST /api/reset tanpa login -> 401
    const noAuthReset = await fetch(`${baseUrl}/api/reset`, { method: 'POST' });
    assert.strictEqual(noAuthReset.status, 401);

    // e. POST /api/reset oleh Pengawas -> 403
    const pengawasReset = await fetch(`${baseUrl}/api/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: pengawasCookie },
      body: JSON.stringify({ konfirmasi: 'RESET', password: 'passwordPengawas456' })
    });
    assert.strictEqual(pengawasReset.status, 403);

    // f. POST /api/reset oleh Guru dengan kata konfirmasi salah -> 400
    const wrongWordReset = await fetch(`${baseUrl}/api/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: guruCookie },
      body: JSON.stringify({ konfirmasi: 'salah', password: 'passwordGuru123' })
    });
    assert.strictEqual(wrongWordReset.status, 400);

    // g. POST /api/reset oleh Guru dengan password salah -> 400
    const wrongPassReset = await fetch(`${baseUrl}/api/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: guruCookie },
      body: JSON.stringify({ konfirmasi: 'RESET', password: 'passwordSalah' })
    });
    assert.strictEqual(wrongPassReset.status, 400);

    // h. POST /api/reset oleh Guru berhasil -> 200
    const validReset = await fetch(`${baseUrl}/api/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: guruCookie },
      body: JSON.stringify({ konfirmasi: 'RESET', password: 'passwordGuru123', scope: 'semua' })
    });
    assert.strictEqual(validReset.status, 200);
    const validResetData = await validReset.json();
    assert.strictEqual(validResetData.success, true);

    // 18. Uji POST /api/logout
    console.log('18. Uji POST /api/logout...');
    const logoutRes = await fetch(`${baseUrl}/api/logout`, { method: 'POST' });
    assert.strictEqual(logoutRes.status, 200);
    const logoutCookie = logoutRes.headers.get('set-cookie');
    assert.ok(logoutCookie.includes('Max-Age=0'));

    console.log('\n--- SEMUA PENGUJIAN INTEGRASI BERHASIL (100% PASS) ---');
  } finally {
    server.close();
  }
});
