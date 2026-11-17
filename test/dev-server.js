import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import configHandler from '../api/config.js';
import loginHandler from '../api/login.js';
import sesiHandler from '../api/sesi.js';
import submitHandler from '../api/submit.js';
import nilaiHandler from '../api/nilai.js';
import tugasHandler from '../api/tugas.js';
import uploadHandler from '../api/upload.js';
import hapusHandler from '../api/hapus.js';
import { getSession } from '../api/_auth.js';

// Default env variables untuk local testing jika belum ada
process.env.GURU_PASSWORD = process.env.GURU_PASSWORD || 'guru123';
process.env.PENGAWAS_PASSWORD = process.env.PENGAWAS_PASSWORD || 'pengawas123';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'local_development_secret_key_1234567890_abcdef';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

// Penyimpanan lokal sementara saat dijalankan di komputer (tanpa Vercel Blob)
const localUploadsDir = path.join(process.cwd(), '.local-data');
if (!fs.existsSync(localUploadsDir)) {
  fs.mkdirSync(localUploadsDir, { recursive: true });
}

// Data awal contoh untuk kelas XI-1 dan XI-2
let localTugasList = [
  {
    id: 'a1b2c3d4-e5f6-4a5b-8c9d-111111111111',
    nama: 'Budi Santoso',
    kelas: 'XI-1',
    bab: 'Bab 1',
    fileUrl: '/local-blob/file/contoh-tugas-budi.pdf',
    fileNama: 'Tugas_Bab1_Budi.pdf',
    fileTipe: 'application/pdf',
    dikirimPada: new Date(Date.now() - 3600000 * 2).toISOString(),
    nilai: 85,
    catatan: 'Analisis masalah sangat baik. Pertahankan!',
    catatanSiswa: 'Mohon masukannya Bu Ulfa, terima kasih.',
    dinilaiPada: new Date(Date.now() - 3600000).toISOString(),
    versi: 1,
    revisi: false,
    statusNilai: 'sudah',
    labelStatus: 'Sudah dinilai',
    nilaiLama: null,
    versiNilaiLama: null,
    versiSebelumnya: []
  },
  {
    id: 'b2c3d4e5-f6a7-4b6c-9d0e-222222222222',
    nama: 'Siti Rahma',
    kelas: 'XI-2',
    bab: 'Bab 2',
    fileUrl: '/local-blob/file/contoh-tugas-siti.docx',
    fileNama: 'Laporan_Bab2_Siti.docx',
    fileTipe: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    dikirimPada: new Date(Date.now() - 1800000).toISOString(),
    nilai: null,
    catatan: '',
    catatanSiswa: 'Sudah saya sesuaikan dengan petunjuk di Bab 2.',
    dinilaiPada: null,
    versi: 1,
    revisi: false,
    statusNilai: 'belum',
    labelStatus: 'Belum dinilai',
    nilaiLama: null,
    versiNilaiLama: null,
    versiSebelumnya: []
  }
];

const server = http.createServer(async (req, res) => {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return res;
  };

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  let pathname = parsedUrl.pathname;

  // Tangani upload PUT file lokal jika belum terhubung ke Vercel Blob
  if (pathname.startsWith('/local-blob/') && req.method === 'PUT') {
    const relPath = pathname.replace('/local-blob/', '');
    const targetFile = path.join(localUploadsDir, relPath);
    const targetDir = path.dirname(targetFile);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const fileStream = fs.createWriteStream(targetFile);
    req.pipe(fileStream);
    fileStream.on('finish', () => {
      const fullUrl = `http://${req.headers.host || 'localhost:3000'}${pathname}`;
      res.status(200).json({
        url: fullUrl,
        downloadUrl: fullUrl,
        pathname: relPath,
        contentType: req.headers['content-type'] || 'application/octet-stream'
      });
    });
    fileStream.on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
    return;
  }

  // Melayani file yang diunggah ke /local-blob/
  if (pathname.startsWith('/local-blob/') && req.method === 'GET') {
    const relPath = pathname.replace('/local-blob/', '');
    const targetFile = path.join(localUploadsDir, relPath);
    if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
      const ext = path.extname(targetFile).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream'
      });
      fs.createReadStream(targetFile).pipe(res);
      return;
    }
    // Jika file contoh dummy belum ada di disk, kirim respon teks placeholder
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Ini adalah berkas tugas contoh pratinjau mode lokal.');
    return;
  }

  // Baca body JSON jika ada
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

  // Routing API
  if (pathname.startsWith('/api/')) {
    try {
      if (pathname === '/api/config') return await configHandler(req, res);
      if (pathname === '/api/login') return await loginHandler(req, res);
      if (pathname === '/api/logout') return await loginHandler(Object.assign(req, { query: { action: 'logout' } }), res);
      if (pathname === '/api/sesi') return await sesiHandler(req, res);

      // Jika belum ada token Vercel Blob, gunakan mock lokal untuk upload & database tugas
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        if (pathname === '/api/upload') {
          return res.status(200).json({
            type: 'blob.generate-client-token',
            clientToken: 'local_mock_token_for_vscode_preview'
          });
        }

        if (pathname === '/api/submit') {
          const { id, nama, kelas, bab, fileUrl, fileNama, fileTipe, catatanSiswa } = req.body || {};
          if (!nama || !kelas || !bab || !fileUrl) {
            return res.status(400).json({ error: 'Data pengiriman tidak lengkap' });
          }

          const submissionId = id || crypto.randomUUID();

          // Cari apakah sudah pernah mengirim sebelumnya (revisi)
          const existingIdx = localTugasList.findIndex(
            t => t.nama.toLowerCase().trim().replace(/\s+/g, ' ') === nama.toLowerCase().trim().replace(/\s+/g, ' ') &&
                 t.kelas.toLowerCase().trim() === kelas.toLowerCase().trim() &&
                 t.bab.toLowerCase().trim() === bab.toLowerCase().trim()
          );

          let versi = 1;
          let oldRecord = null;
          let oldVersions = [];

          if (existingIdx !== -1) {
            oldRecord = localTugasList[existingIdx];
            oldVersions = [
              {
                id: oldRecord.id,
                nama: oldRecord.nama,
                kelas: oldRecord.kelas,
                bab: oldRecord.bab,
                fileUrl: oldRecord.fileUrl,
                fileNama: oldRecord.fileNama,
                fileTipe: oldRecord.fileTipe,
                dikirimPada: oldRecord.dikirimPada,
                nilai: oldRecord.nilai,
                catatan: oldRecord.catatan,
                catatanSiswa: oldRecord.catatanSiswa,
                dinilaiPada: oldRecord.dinilaiPada,
                versi: oldRecord.versi || 1
              },
              ...(oldRecord.versiSebelumnya || [])
            ];
            versi = oldVersions.length + 1;
          }

          const revisi = versi > 1;

          // Status nilai: jika versi sebelumnya sudah dinilai, status menjadi "perlu_ulang"
          let statusNilai = 'belum';
          let labelStatus = 'Belum dinilai';
          let nilaiLama = null;
          let versiNilaiLama = null;

          if (revisi) {
            const gradedPrev = oldVersions.find(v => v.nilai !== null && v.nilai !== undefined);
            if (gradedPrev) {
              statusNilai = 'perlu_ulang';
              labelStatus = 'Perlu dinilai ulang';
              nilaiLama = gradedPrev.nilai;
              versiNilaiLama = gradedPrev.versi;
            }
          }

          const newTugas = {
            id: submissionId,
            nama: nama.trim(),
            kelas,
            bab,
            fileUrl,
            fileNama: fileNama || 'tugas.pdf',
            fileTipe: fileTipe || 'application/pdf',
            dikirimPada: new Date().toISOString(),
            nilai: null,
            catatan: '',
            catatanSiswa: catatanSiswa || '',
            dinilaiPada: null,
            versi,
            revisi,
            statusNilai,
            labelStatus,
            nilaiLama,
            versiNilaiLama,
            versiSebelumnya: oldVersions
          };

          if (existingIdx !== -1) {
            localTugasList[existingIdx] = newTugas;
          } else {
            localTugasList.unshift(newTugas);
          }

          return res.status(201).json({ ok: true, tugas: newTugas });
        }

        if (pathname === '/api/tugas') {
          const session = getSession(req);
          if (!session) {
            return res.status(401).json({ error: 'Tidak diizinkan. Silakan masuk terlebih dahulu.' });
          }
          return res.status(200).json({ tugas: localTugasList });
        }

        if (pathname === '/api/nilai') {
          const session = getSession(req);
          if (!session) return res.status(401).json({ error: 'Belum masuk' });
          if (session.peran !== 'guru') {
            return res.status(403).json({ error: 'Akses ditolak. Hanya guru yang dapat memberikan nilai.' });
          }

          const { id, nilai, catatan } = req.body || {};
          let target = null;
          for (const item of localTugasList) {
            if (item.id === id) {
              target = item;
              target.statusNilai = 'sudah';
              target.labelStatus = 'Sudah dinilai';
              break;
            }
            if (item.versiSebelumnya) {
              const prev = item.versiSebelumnya.find(v => v.id === id);
              if (prev) {
                target = prev;
                break;
              }
            }
          }

          if (!target) return res.status(404).json({ error: 'Tugas tidak ditemukan' });

          target.nilai = Number(nilai);
          target.catatan = catatan ? String(catatan).trim() : '';
          target.dinilaiPada = new Date().toISOString();

          return res.status(200).json({ ok: true, tugas: target });
        }

        if (pathname === '/api/hapus') {
          const session = getSession(req);
          if (!session) return res.status(401).json({ error: 'Tidak diizinkan. Silakan masuk terlebih dahulu.' });
          if (session.peran !== 'guru') {
            return res.status(403).json({ error: 'Akses ditolak. Hanya guru yang dapat menghapus tugas.' });
          }

          const { id, hapusSiswa } = req.body || {};
          if (hapusSiswa) {
            let foundIdx = -1;
            let studentNama = '';
            for (let i = 0; i < localTugasList.length; i++) {
              const g = localTugasList[i];
              if (g.id === id || (g.versiSebelumnya && g.versiSebelumnya.some(v => v.id === id))) {
                foundIdx = i;
                studentNama = g.nama;
                break;
              }
            }
            if (foundIdx === -1) {
              return res.status(404).json({ error: 'Data siswa tidak ditemukan' });
            }
            localTugasList.splice(foundIdx, 1);
            return res.status(200).json({
              ok: true,
              message: `Seluruh data siswa "${studentNama}" berhasil dihapus`
            });
          }

          for (let i = 0; i < localTugasList.length; i++) {
            const g = localTugasList[i];
            if (g.id === id) {
              if (g.versiSebelumnya && g.versiSebelumnya.length > 0) {
                const prev = g.versiSebelumnya[0];
                const restPrev = g.versiSebelumnya.slice(1);
                let st = prev.nilai !== null ? 'sudah' : 'belum';
                let lbl = prev.nilai !== null ? 'Sudah dinilai' : 'Belum dinilai';
                let nLama = null;
                let vLama = null;
                if (st === 'belum') {
                  const gp = restPrev.find(p => p.nilai !== null);
                  if (gp) {
                    st = 'perlu_ulang';
                    lbl = 'Perlu dinilai ulang';
                    nLama = gp.nilai;
                    vLama = gp.versi;
                  }
                }
                localTugasList[i] = {
                  ...prev,
                  statusNilai: st,
                  labelStatus: lbl,
                  nilaiLama: nLama,
                  versiNilaiLama: vLama,
                  versiSebelumnya: restPrev
                };
              } else {
                localTugasList.splice(i, 1);
              }
              return res.status(200).json({ ok: true, message: 'Tugas berhasil dihapus' });
            }

            if (g.versiSebelumnya) {
              const vIdx = g.versiSebelumnya.findIndex(v => v.id === id);
              if (vIdx !== -1) {
                g.versiSebelumnya.splice(vIdx, 1);
                return res.status(200).json({ ok: true, message: 'Tugas berhasil dihapus' });
              }
            }
          }

          return res.status(404).json({ error: 'Tugas tidak ditemukan' });
        }
      }

      // Handler standar Vercel Blob (bila token terpasang)
      if (pathname === '/api/submit') return await submitHandler(req, res);
      if (pathname === '/api/nilai') return await nilaiHandler(req, res);
      if (pathname === '/api/tugas') return await tugasHandler(req, res);
      if (pathname === '/api/upload') return await uploadHandler(req, res);
      if (pathname === '/api/hapus') return await hapusHandler(req, res);

      return res.status(404).json({ error: 'API route not found' });
    } catch (err) {
      console.error('API Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // Routing file statis di folder public/ (dengan cleanUrls seperti Vercel)
  if (pathname === '/') pathname = '/index.html';
  if (!path.extname(pathname)) {
    const possibleHtml = path.join('public', pathname + '.html');
    if (fs.existsSync(possibleHtml)) {
      pathname = pathname + '.html';
    }
  }

  const filePath = path.join('public', pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY'
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Halaman tidak ditemukan');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Portal Pengumpulan Tugas berjalan di:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log(`======================================================`);
  console.log(`Akun Bawaan untuk Pengetesan Lokal:`);
  console.log(`- Password Guru    : ${process.env.GURU_PASSWORD}`);
  console.log(`- Password Pengawas: ${process.env.PENGAWAS_PASSWORD}`);
  console.log(`Tekan Ctrl + C di terminal untuk menghentikan server.`);
  console.log(`======================================================\n`);
});
