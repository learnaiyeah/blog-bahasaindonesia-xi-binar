import assert from 'node:assert';
import crypto from 'node:crypto';
import {
  createSessionToken,
  verifySessionToken,
  verifyPassword,
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
  parseCookies,
  buildSessionCookie,
  buildLogoutCookie
} from '../api/_auth.js';
import { KELAS, BAB, getDaftarBabDetail, saveDaftarBab, MAX_NAMA_LENGTH, MAX_CATATAN_LENGTH, MAX_CATATAN_SISWA_LENGTH } from '../api/_config.js';
import { sanitizeFileName } from '../api/submit.js';
import { normalizeKey } from '../api/tugas.js';
import { cekStatusDeadline, hitungSisaWaktuDeadline } from '../public/app.js';

// Setup environment variables for test
process.env.SESSION_SECRET = 'test_secret_for_unit_tests_1234567890_abcdef';
process.env.GURU_PASSWORD = 'guruPassword123';
process.env.PENGAWAS_PASSWORD = 'pengawasPassword456';

console.log('--- Memulai Pengujian Unit Backend ---');

// 1. Uji _auth.js - Password Verification
console.log('1. Menguji verifikasi kata sandi (timingSafeEqual)...');
assert.strictEqual(verifyPassword('guruPassword123', 'guruPassword123'), true, 'Password cocok harus bernilai true');
assert.strictEqual(verifyPassword('salahPassword', 'guruPassword123'), false, 'Password salah harus bernilai false');
assert.strictEqual(verifyPassword('', 'guruPassword123'), false, 'Password kosong harus bernilai false');
assert.strictEqual(verifyPassword('guruPassword123', ''), false, 'Expected password kosong harus bernilai false');

// 2. Uji _auth.js - Sesi Token HMAC-SHA256
console.log('2. Menguji pembuatan dan verifikasi token sesi HMAC-SHA256...');
const guruToken = createSessionToken('guru');
const sessionData = verifySessionToken(guruToken);
assert.ok(sessionData, 'Token valid harus berhasil diverifikasi');
assert.strictEqual(sessionData.peran, 'guru', 'Peran harus berupa guru');
assert.ok(sessionData.exp > Date.now(), 'Waktu kedaluwarsa harus di masa depan');

const pengawasToken = createSessionToken('pengawas');
const pengawasData = verifySessionToken(pengawasToken);
assert.strictEqual(pengawasData.peran, 'pengawas', 'Peran harus berupa pengawas');

// Token dipalsukan / rusak
const tamperedToken = guruToken + 'tamper';
assert.strictEqual(verifySessionToken(tamperedToken), null, 'Token yang dipalsukan harus ditolak');
assert.strictEqual(verifySessionToken('bukan_token_valid'), null, 'String acak harus ditolak');
assert.strictEqual(verifySessionToken(''), null, 'Token kosong harus ditolak');

// 3. Uji _auth.js - Rate Limiting Login
console.log('3. Menguji batas percobaan login (Rate Limiting)...');
const testIp = '192.168.1.100';
resetLoginRateLimit(testIp);

let rateCheck = checkLoginRateLimit(testIp);
assert.strictEqual(rateCheck.allowed, true, 'Percobaan awal harus diizinkan');

// Simulasikan 5 kali kegagalan
for (let i = 0; i < 4; i++) {
  // Tanpa sleep di loop unit test untuk kecepatan pengujian
  await recordLoginFailure(testIp);
  assert.strictEqual(checkLoginRateLimit(testIp).allowed, true, `Percobaan ke-${i+1} harus masih diizinkan`);
}
// Kegagalan ke-5
await recordLoginFailure(testIp);
const blockedCheck = checkLoginRateLimit(testIp);
assert.strictEqual(blockedCheck.allowed, false, 'Setelah 5 kali gagal, IP harus diblokir sementara');
assert.ok(blockedCheck.message.includes('Terlalu banyak percobaan gagal'), 'Pesan blokir harus jelas');

// Reset rate limit
resetLoginRateLimit(testIp);
assert.strictEqual(checkLoginRateLimit(testIp).allowed, true, 'Setelah reset, IP harus diizinkan kembali');

// 4. Uji _auth.js - Cookies
console.log('4. Menguji parser dan builder cookie...');
const cookieStr = buildSessionCookie(guruToken);
assert.ok(cookieStr.includes('HttpOnly'), 'Cookie harus HttpOnly');
assert.ok(cookieStr.includes('Secure'), 'Cookie harus Secure');
assert.ok(cookieStr.includes('SameSite=Strict'), 'Cookie harus SameSite=Strict');

const reqMock = { headers: { cookie: `session=${encodeURIComponent(guruToken)}; other=123` } };
const parsed = parseCookies(reqMock);
assert.strictEqual(parsed.session, guruToken, 'Cookie session harus terurai dengan benar');

const logoutCookie = buildLogoutCookie();
assert.ok(logoutCookie.includes('Max-Age=0'), 'Logout cookie harus Max-Age=0');

// 5. Uji _config.js
console.log('5. Menguji konfigurasi kelas dan bab...');
assert.deepStrictEqual(KELAS, ['XI-1', 'XI-2'], 'KELAS harus hanya XI-1 dan XI-2');
assert.ok(Array.isArray(BAB) && BAB.length > 0, 'BAB harus berupa array tidak kosong');
assert.strictEqual(MAX_NAMA_LENGTH, 60, 'Maksimal nama 60 karakter');
assert.strictEqual(MAX_CATATAN_LENGTH, 500, 'Maksimal catatan guru 500 karakter');
assert.strictEqual(MAX_CATATAN_SISWA_LENGTH, 300, 'Maksimal catatan siswa 300 karakter');

// 6. Uji submit.js - Sanitasi Nama File
console.log('6. Menguji sanitasi nama file...');
assert.strictEqual(sanitizeFileName('tugas-bab1.pdf'), 'tugas-bab1.pdf', 'Nama file standar harus tetap utuh');
assert.strictEqual(sanitizeFileName('../../../etc/passwd.docx'), 'passwd.docx', 'Path traversal harus dibersihkan');
assert.strictEqual(sanitizeFileName('Tugas Siswa #1 (Revisi & Final).doc'), 'Tugas_Siswa_1_Revisi_Final.doc', 'Karakter khusus berbahaya harus diganti');
assert.strictEqual(sanitizeFileName('<script>alert(1)</script>.pdf'), 'script.pdf', 'Tag HTML dengan slash harus dibersihkan bersama path');
assert.strictEqual(sanitizeFileName('<script>alert(1).pdf'), 'script_alert_1.pdf', 'Karakter khusus berbahaya harus diganti');

// 7. Uji tugas.js - Normalisasi Pengelompokan
console.log('7. Menguji fungsi normalisasi pengelompokan tugas...');
const key1 = normalizeKey('Budi Santoso', 'X-1', 'Bab 1');
const key2 = normalizeKey('  budi   santoso  ', 'x-1', 'bab 1');
assert.strictEqual(key1, key2, 'Variasi spasi dan huruf besar/kecil harus dinormalkan ke grup yang sama');

// 8. Uji Fitur Deadline dan Status Keterlambatan
console.log('8. Menguji fitur deadline dan kalkulasi keterlambatan...');
// a. Deadline tidak aktif / null
const statusNoDl = cekStatusDeadline('2026-11-20T10:00:00.000Z', null, false);
assert.strictEqual(statusNoDl.adaDeadline, false, 'Harus tidak ada deadline jika deadlineAktif false');

// b. Pengiriman Tepat Waktu (sebelum deadline)
const deadlineTime = '2026-11-20T23:59:00.000Z';
const onTimeSubmission = '2026-11-20T20:00:00.000Z';
const statusOnTime = cekStatusDeadline(onTimeSubmission, deadlineTime, true);
assert.strictEqual(statusOnTime.adaDeadline, true);
assert.strictEqual(statusOnTime.lewatDeadline, false);
assert.strictEqual(statusOnTime.selisihText, 'Tepat Waktu');

// c. Pengiriman Terlambat (lewat dari deadline)
const lateSubmission = '2026-11-21T02:30:00.000Z'; // 2 jam 31 menit lewat
const statusLate = cekStatusDeadline(lateSubmission, deadlineTime, true);
assert.strictEqual(statusLate.adaDeadline, true);
assert.strictEqual(statusLate.lewatDeadline, true);
assert.ok(statusLate.selisihText.includes('Terlambat'), 'Teks harus memuat keterangan Terlambat');
assert.ok(statusLate.selisihText.includes('jam'), 'Teks harus memuat selisih jam keterlambatan');

// d. Konfigurasi Bab Detail dengan Deadline
const initialDetail = getDaftarBabDetail();
assert.ok(Array.isArray(initialDetail) && initialDetail.length > 0);
assert.ok('judul' in initialDetail[0] && 'deadlineAktif' in initialDetail[0]);

console.log('\n--- SEMUA PENGUJIAN UNIT BERHASIL (100% PASS) ---');
