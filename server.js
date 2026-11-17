import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import dotenv from 'dotenv';
import cors from 'cors';
import { fileURLToPath } from 'url';

import {
  KELAS,
  BAB,
  getDaftarBab,
  getDaftarBabDetail,
  saveDaftarBab,
  MAX_NAMA_LENGTH,
  MAX_CATATAN_LENGTH,
  MAX_CATATAN_SISWA_LENGTH,
  MAX_FILE_SIZE_BYTES
} from './api/_config.js';

import {
  COOKIE_NAME,
  createSessionToken,
  buildSessionCookie,
  buildLogoutCookie,
  verifyPassword,
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
  getClientIp,
  getSession,
  getPassword,
  savePassword
} from './api/_auth.js';

import { getPool, initDatabase, isDbConnected } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Setup direktori uploads fisik di server lokal
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Konfigurasi Multer untuk penyimpanan berkas lokal
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 40) || 'tugas';
    const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    cb(null, `${base}_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const allowedMime = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const allowedExt = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMime.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipe file tidak didukung. Hanya PDF, DOC, atau DOCX yang diizinkan.'));
    }
  }
});

// Helper menghapus file fisik di folder uploads
function deleteLocalFile(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return;
  try {
    const cleanPath = fileUrl.replace(/^\/uploads\//, '');
    const fullPath = path.join(uploadsDir, cleanPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error(`Gagal menghapus file fisik ${fileUrl}:`, err.message);
  }
}

// Middleware dasar
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sajikan folder uploads, Assets, dan folder public secara statis
app.use('/uploads', express.static(uploadsDir));
app.use('/Assets', express.static(path.join(__dirname, 'Assets')));
app.use(express.static(path.join(__dirname, 'public')));

// Routing halaman utama
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/siswa', (req, res) => res.sendFile(path.join(__dirname, 'public', 'siswa.html')));
app.get('/masuk', (req, res) => res.sendFile(path.join(__dirname, 'public', 'masuk.html')));
app.get('/daftar', (req, res) => res.sendFile(path.join(__dirname, 'public', 'daftar.html')));

// ============================================================
// API ROUTES
// ============================================================

// 1. GET /api/config
app.get('/api/config', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json({
    kelas: KELAS,
    bab: getDaftarBab(),
    babDetail: getDaftarBabDetail()
  });
});

// 1b. GET & POST /api/bab (Pengaturan Bab KTI & Deadline)
app.get('/api/bab', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({
    bab: getDaftarBab(),
    babDetail: getDaftarBabDetail()
  });
});

app.post('/api/bab', async (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.' });
  }

  if (session.peran !== 'guru') {
    return res.status(403).json({ error: 'Hanya peran Guru yang berhak mengatur bab tugas.' });
  }

  const inputList = req.body?.bab || req.body?.babDetail;
  if (!Array.isArray(inputList) || inputList.length === 0) {
    return res.status(400).json({ error: 'Daftar bab harus berupa kumpulan teks atau objek bab dan minimal memiliki 1 bab.' });
  }

  const cleanItems = [];
  const seen = new Set();

  for (const item of inputList) {
    let judul = '';
    let deadlineAktif = false;
    let deadline = null;

    if (typeof item === 'string') {
      judul = item.trim();
    } else if (item && typeof item === 'object') {
      judul = String(item.judul || '').trim();
      deadlineAktif = Boolean(item.deadlineAktif);
      deadline = item.deadline ? String(item.deadline).trim() : null;
    }

    if (!judul) {
      return res.status(400).json({ error: 'Nama bab tidak boleh kosong.' });
    }

    if (judul.length > 100) {
      return res.status(400).json({ error: `Judul bab "${judul}" melebihi batas maksimal 100 karakter.` });
    }

    const lower = judul.toLowerCase();
    if (seen.has(lower)) {
      return res.status(400).json({ error: `Terdapat judul bab ganda: "${judul}". Setiap bab harus memiliki judul unik.` });
    }
    seen.add(lower);

    if (deadlineAktif && deadline) {
      const dt = new Date(deadline);
      if (isNaN(dt.getTime())) {
        return res.status(400).json({ error: `Format tanggal deadline untuk "${judul}" tidak valid.` });
      }
    }

    cleanItems.push({
      judul,
      deadlineAktif,
      deadline: deadlineAktif ? deadline : null
    });
  }

  try {
    const updated = saveDaftarBab(cleanItems);
    const detail = getDaftarBabDetail();

    // Simpan ke MySQL jika terhubung
    if (isDbConnected()) {
      const pool = getPool();
      await pool.query(
        'INSERT INTO `pengaturan` (`kunci`, `nilai`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `nilai` = ?',
        ['bab', JSON.stringify(detail), JSON.stringify(detail)]
      ).catch(e => console.warn('[MySQL Warning] Gagal menyimpan pengaturan bab ke DB:', e.message));
    }

    return res.status(200).json({
      success: true,
      message: 'Pengaturan bab dan deadline berhasil disimpan',
      bab: updated,
      babDetail: detail
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal menyimpan pengaturan bab' });
  }
});

// 2. POST /api/upload (Mengunggah berkas ke server sekolah)
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File terlalu besar, maksimal 10 MB' });
      }
      return res.status(400).json({ error: err.message || 'Gagal mengunggah file' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({
      ok: true,
      url: fileUrl,
      downloadUrl: fileUrl,
      pathname: req.file.filename,
      fileNama: req.file.originalname,
      fileTipe: req.file.mimetype
    });
  });
});

// 3. POST /api/submit (Menyimpan data tugas ke MySQL)
app.post('/api/submit', async (req, res) => {
  const { id: requestedId, nama, kelas, bab, fileUrl, fileNama, fileTipe, catatanSiswa } = req.body || {};

  // Validasi Nama
  if (!nama || typeof nama !== 'string' || !nama.trim()) {
    return res.status(400).json({ error: 'Nama lengkap wajib diisi' });
  }
  const cleanNama = nama.trim();
  if (cleanNama.length > MAX_NAMA_LENGTH) {
    return res.status(400).json({ error: `Nama maksimal ${MAX_NAMA_LENGTH} karakter` });
  }

  // Validasi Kelas & Bab
  if (!KELAS.includes(kelas)) {
    return res.status(400).json({ error: 'Pilihan kelas tidak valid' });
  }
  if (!getDaftarBab().includes(bab)) {
    return res.status(400).json({ error: 'Pilihan bab tidak valid' });
  }

  // Validasi Catatan Siswa
  let cleanCatatanSiswa = '';
  if (catatanSiswa !== undefined && catatanSiswa !== null) {
    if (typeof catatanSiswa !== 'string') {
      return res.status(400).json({ error: 'Catatan siswa harus berupa teks' });
    }
    cleanCatatanSiswa = catatanSiswa.trim();
    if (cleanCatatanSiswa.length > MAX_CATATAN_SISWA_LENGTH) {
      return res.status(400).json({ error: `Catatan siswa maksimal ${MAX_CATATAN_SISWA_LENGTH} karakter` });
    }
  }

  // Validasi File
  if (!fileUrl || typeof fileUrl !== 'string') {
    return res.status(400).json({ error: 'URL file tugas wajib ada' });
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const id = (requestedId && UUID_REGEX.test(requestedId)) ? requestedId : crypto.randomUUID();
  const kunciNama = cleanNama.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '') || 'siswa';

  let versi = 1;
  let revisi = false;

  try {
    if (isDbConnected()) {
      const pool = getPool();
      const [rows] = await pool.query(
        'SELECT MAX(versi) AS maxVersi FROM tugas WHERE kelas = ? AND bab = ? AND kunci_nama = ?',
        [kelas, bab, kunciNama]
      );
      const currentMax = rows[0]?.maxVersi || 0;
      versi = currentMax + 1;
      revisi = versi > 1;

      await pool.query(
        `INSERT INTO tugas (
          id, nama, kelas, bab, kunci_nama, file_url, file_nama, file_tipe,
          catatan_siswa, nilai, catatan, dikirim_pada, dinilai_pada, versi, revisi
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, '', NOW(), NULL, ?, ?)`,
        [
          id,
          cleanNama,
          kelas,
          bab,
          kunciNama,
          fileUrl,
          fileNama || 'tugas.pdf',
          fileTipe || 'application/pdf',
          cleanCatatanSiswa,
          versi,
          revisi ? 1 : 0
        ]
      );
    }

    return res.status(201).json({
      ok: true,
      tugas: {
        id,
        nama: cleanNama,
        kelas,
        bab,
        fileUrl,
        fileNama: fileNama || 'tugas.pdf',
        fileTipe: fileTipe || 'application/pdf',
        catatanSiswa: cleanCatatanSiswa,
        dikirimPada: new Date().toISOString(),
        nilai: null,
        catatan: '',
        dinilaiPada: null,
        versi,
        revisi
      }
    });
  } catch (err) {
    console.error('Error saat submit tugas ke MySQL:', err);
    return res.status(500).json({ error: 'Gagal menyimpan rekaman tugas ke database' });
  }
});

// 4. POST /api/login
app.post('/api/login', async (req, res) => {
  const ip = getClientIp(req);
  const limitCheck = checkLoginRateLimit(ip);
  if (!limitCheck.allowed) {
    return res.status(429).json({ error: limitCheck.message });
  }

  const { peran, password } = req.body || {};
  if (peran !== 'guru' && peran !== 'pengawas') {
    await recordLoginFailure(ip);
    return res.status(400).json({ error: 'Peran tidak valid' });
  }

  const expectedPassword = getPassword(peran);

  if (!verifyPassword(password, expectedPassword)) {
    await recordLoginFailure(ip);
    return res.status(401).json({ error: 'Kata sandi salah. Silakan coba lagi.' });
  }

  resetLoginRateLimit(ip);
  const token = createSessionToken(peran);
  res.setHeader('Set-Cookie', buildSessionCookie(token));
  return res.status(200).json({ ok: true, peran, redirect: '/daftar' });
});

// 5. POST /api/logout
app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', buildLogoutCookie());
  return res.status(200).json({ ok: true });
});

app.all('/api/login', (req, res, next) => {
  if (req.query?.action === 'logout' || req.body?.action === 'logout') {
    res.setHeader('Set-Cookie', buildLogoutCookie());
    return res.status(200).json({ ok: true });
  }
  next();
});

// 6. GET /api/sesi
app.get('/api/sesi', (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Tidak ada sesi aktif' });
  }
  return res.status(200).json({ peran: session.peran });
});

// 6b. POST /api/password (Ubah Kata Sandi Guru & Pengawas)
app.post('/api/password', async (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.' });
  }

  const peran = session.peran;
  if (peran !== 'guru' && peran !== 'pengawas') {
    return res.status(403).json({ error: 'Peran tidak memiliki hak akses untuk mengubah kata sandi.' });
  }

  const { passwordLama, passwordBaru, konfirmasiPassword } = req.body || {};

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

  const currentPassword = getPassword(peran);
  if (!verifyPassword(passwordLama, currentPassword)) {
    return res.status(400).json({ error: 'Kata sandi saat ini (lama) tidak sesuai.' });
  }

  try {
    savePassword(peran, passwordBaru);

    // Simpan ke MySQL jika terhubung
    if (isDbConnected()) {
      const pool = getPool();
      const dbKey = peran === 'guru' ? 'password_guru' : 'password_pengawas';
      await pool.query(
        'INSERT INTO `pengaturan` (`kunci`, `nilai`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `nilai` = ?',
        [dbKey, passwordBaru, passwordBaru]
      ).catch(e => console.warn('[MySQL Warning] Gagal menyimpan kata sandi ke DB:', e.message));
    }

    const labelPeran = peran === 'guru' ? 'Guru' : 'Pengawas';
    return res.status(200).json({
      success: true,
      message: `Kata sandi untuk peran ${labelPeran} berhasil diperbarui.`
    });
  } catch (err) {
    console.error('Error saat menyimpan kata sandi:', err);
    return res.status(500).json({ error: err.message || 'Gagal menyimpan kata sandi baru.' });
  }
});

// 6c. GET /api/backup (Cadangkan Data Tugas - Khusus Guru)
app.get('/api/backup', async (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Tidak diizinkan. Silakan masuk terlebih dahulu.' });
  }
  if (session.peran !== 'guru') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya guru yang dapat mengunduh cadangan data.' });
  }

  try {
    let allTugas = [];
    if (isDbConnected()) {
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM tugas ORDER BY dikirim_pada DESC');
      allTugas = rows.map((r) => ({
        id: r.id,
        nama: r.nama,
        kelas: r.kelas,
        bab: r.bab,
        kunciNama: r.kunci_nama,
        fileUrl: r.file_url,
        fileNama: r.file_nama,
        fileTipe: r.file_tipe,
        catatanSiswa: r.catatan_siswa || '',
        nilai: r.nilai !== null ? Number(r.nilai) : null,
        catatan: r.catatan || '',
        dikirimPada: r.dikirim_pada ? new Date(r.dikirim_pada).toISOString() : new Date().toISOString(),
        dinilaiPada: r.dinilai_pada ? new Date(r.dinilai_pada).toISOString() : null,
        versi: r.versi,
        revisi: Boolean(r.revisi)
      }));
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
});

// 6d. POST /api/reset (Reset / Bersihkan Data Tugas - Khusus Guru)
app.post('/api/reset', async (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Tidak diizinkan. Silakan masuk terlebih dahulu.' });
  }
  if (session.peran !== 'guru') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya guru yang dapat me-reset data tugas.' });
  }

  const { konfirmasi, password, scope = 'semua' } = req.body || {};

  if (konfirmasi !== 'RESET') {
    return res.status(400).json({ error: 'Ketik kata RESET dengan huruf besar untuk mengonfirmasi penghapusan data.' });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Kata sandi guru wajib diisi untuk verifikasi keamanan.' });
  }

  if (!verifyPassword(password, getPassword('guru'))) {
    return res.status(400).json({ error: 'Kata sandi guru tidak sesuai.' });
  }

  if (scope !== 'semua' && scope !== 'XI-1' && scope !== 'XI-2') {
    return res.status(400).json({ error: 'Pilihan cakupan kelas tidak valid.' });
  }

  try {
    let deletedCount = 0;
    if (isDbConnected()) {
      const pool = getPool();
      if (scope === 'semua') {
        const [rows] = await pool.query('SELECT file_url FROM tugas');
        for (const r of rows) {
          deleteLocalFile(r.file_url);
        }
        deletedCount = rows.length;
        await pool.query('DELETE FROM tugas');
      } else {
        const [rows] = await pool.query('SELECT file_url FROM tugas WHERE kelas = ?', [scope]);
        for (const r of rows) {
          deleteLocalFile(r.file_url);
        }
        deletedCount = rows.length;
        await pool.query('DELETE FROM tugas WHERE kelas = ?', [scope]);
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
    return res.status(500).json({ error: err.message || 'Gagal membersihkan data tugas' });
  }
});

// 7. GET /api/tugas (Guru & Pengawas)
app.get('/api/tugas', async (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Tidak diizinkan. Silakan masuk terlebih dahulu.' });
  }

  try {
    let rawList = [];
    if (isDbConnected()) {
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM tugas ORDER BY dikirim_pada DESC');
      rawList = rows.map((r) => ({
        id: r.id,
        nama: r.nama,
        kelas: r.kelas,
        bab: r.bab,
        kunciNama: r.kunci_nama,
        fileUrl: r.file_url,
        fileNama: r.file_nama,
        fileTipe: r.file_tipe,
        catatanSiswa: r.catatan_siswa || '',
        nilai: r.nilai !== null ? Number(r.nilai) : null,
        catatan: r.catatan || '',
        dikirimPada: r.dikirim_pada ? new Date(r.dikirim_pada).toISOString() : new Date().toISOString(),
        dinilaiPada: r.dinilai_pada ? new Date(r.dinilai_pada).toISOString() : null,
        versi: r.versi,
        revisi: Boolean(r.revisi)
      }));
    }

    // Kelompokkan per nama, kelas, dan bab
    const grouped = {};
    for (const item of rawList) {
      const key = `${item.kelas.toLowerCase()}_${item.bab.toLowerCase()}_${item.kunciNama || item.nama.toLowerCase().replace(/\s+/g, '_')}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    }

    const result = [];
    for (const key in grouped) {
      const list = grouped[key];
      // Urutkan dari versi tertinggi / waktu terbaru
      list.sort((a, b) => b.versi - a.versi || new Date(b.dikirimPada) - new Date(a.dikirimPada));
      const latest = list[0];
      const previous = list.slice(1);

      let statusNilai = 'belum';
      let labelStatus = 'Belum dinilai';
      let nilaiLama = null;
      let versiNilaiLama = null;

      if (latest.nilai !== null && latest.nilai !== undefined) {
        statusNilai = 'sudah';
        labelStatus = 'Sudah dinilai';
      } else {
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

    // Urutkan hasil akhir berdasarkan waktu kirim versi terbaru
    result.sort((a, b) => new Date(b.dikirimPada) - new Date(a.dikirimPada));
    return res.status(200).json({ tugas: result });
  } catch (err) {
    console.error('Error saat mengambil daftar tugas dari MySQL:', err);
    return res.status(500).json({ error: 'Gagal mengambil data tugas dari database' });
  }
});

// 8. POST /api/nilai (Hanya Guru)
app.post('/api/nilai', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Belum masuk' });
  if (session.peran !== 'guru') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya guru yang dapat memberikan nilai.' });
  }

  const { id, nilai, catatan } = req.body || {};
  const numNilai = Number(nilai);
  if (isNaN(numNilai) || numNilai < 0 || numNilai > 100) {
    return res.status(400).json({ error: 'Nilai harus berupa angka antara 0 sampai 100' });
  }

  const cleanCatatan = catatan ? String(catatan).trim().slice(0, MAX_CATATAN_LENGTH) : '';

  try {
    if (isDbConnected()) {
      const pool = getPool();
      await pool.query(
        'UPDATE tugas SET nilai = ?, catatan = ?, dinilai_pada = NOW() WHERE id = ?',
        [numNilai, cleanCatatan, id]
      );
      const [rows] = await pool.query('SELECT * FROM tugas WHERE id = ?', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Tugas tidak ditemukan' });
      const r = rows[0];
      return res.status(200).json({
        ok: true,
        tugas: {
          id: r.id,
          nilai: Number(r.nilai),
          catatan: r.catatan,
          dinilaiPada: r.dinilai_pada ? new Date(r.dinilai_pada).toISOString() : new Date().toISOString()
        }
      });
    }

    return res.status(200).json({
      ok: true,
      tugas: { id, nilai: numNilai, catatan: cleanCatatan, dinilaiPada: new Date().toISOString() }
    });
  } catch (err) {
    console.error('Error saat menyimpan nilai ke MySQL:', err);
    return res.status(500).json({ error: 'Gagal menyimpan nilai ke database' });
  }
});

// 9. POST /api/hapus (Hanya Guru - Hapus versi atau seluruh data siswa)
app.post('/api/hapus', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Tidak diizinkan. Silakan masuk terlebih dahulu.' });
  if (session.peran !== 'guru') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya guru yang dapat menghapus tugas.' });
  }

  const { id, hapusSiswa } = req.body || {};
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID tugas tidak valid' });
  }

  try {
    if (isDbConnected()) {
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM tugas WHERE id = ?', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Rekaman tugas tidak ditemukan' });
      const target = rows[0];

      if (hapusSiswa) {
        // Hapus seluruh versi siswa ini
        const [studentFiles] = await pool.query(
          'SELECT file_url FROM tugas WHERE kelas = ? AND bab = ? AND kunci_nama = ?',
          [target.kelas, target.bab, target.kunci_nama]
        );
        for (const f of studentFiles) {
          deleteLocalFile(f.file_url);
        }
        await pool.query(
          'DELETE FROM tugas WHERE kelas = ? AND bab = ? AND kunci_nama = ?',
          [target.kelas, target.bab, target.kunci_nama]
        );
        return res.status(200).json({
          ok: true,
          message: `Seluruh data siswa "${target.nama}" berhasil dihapus`
        });
      } else {
        // Hapus 1 versi saja
        deleteLocalFile(target.file_url);
        await pool.query('DELETE FROM tugas WHERE id = ?', [id]);
        return res.status(200).json({ ok: true, message: 'Tugas berhasil dihapus' });
      }
    }

    return res.status(200).json({ ok: true, message: 'Tugas berhasil dihapus' });
  } catch (err) {
    console.error('Error saat menghapus tugas dari MySQL:', err);
    return res.status(500).json({ error: 'Gagal menghapus data tugas dari database' });
  }
});

// Jalankan server
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Server Pengumpulan Tugas Sekolah Aktif!`);
    console.log(`📡 URL Lokal:   http://localhost:${PORT}`);
    console.log(`📂 Folder File: ${uploadsDir}`);
    console.log(`💾 Database:    ${isDbConnected() ? 'MySQL (Terhubung)' : 'Menunggu Koneksi MySQL'}`);
    console.log(`=======================================================`);
  });
}

startServer();

export default app;
