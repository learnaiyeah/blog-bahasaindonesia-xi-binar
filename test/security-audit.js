import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('--- Memulai Audit Keamanan dan Frontend ---');

// 1. Audit vercel.json
console.log('1. Memeriksa konfigurasi vercel.json...');
const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
assert.strictEqual(vercelConfig.cleanUrls, true, 'cleanUrls harus true');
const headersObj = vercelConfig.headers[0].headers;
const headerKeys = headersObj.map(h => h.key);
assert.ok(headerKeys.includes('X-Content-Type-Options'), 'X-Content-Type-Options harus ada');
assert.ok(headerKeys.includes('Referrer-Policy'), 'Referrer-Policy harus ada');
assert.ok(headerKeys.includes('X-Frame-Options'), 'X-Frame-Options harus ada');

// 2. Audit XSS pada file public/
console.log('2. Memeriksa celah keamanan XSS pada file HTML dan JS di public/...');
const filesToCheck = ['public/daftar.html', 'public/siswa.html', 'public/app.js'];

for (const file of filesToCheck) {
  const content = fs.readFileSync(file, 'utf8');
  // Pastikan tidak ada interpolasi innerHTML dengan data siswa (misalnya innerHTML = item.nama atau innerHTML = `${...nama}`)
  const dangerousPatterns = [
    /innerHTML\s*=\s*.*nama/i,
    /innerHTML\s*=\s*.*catatan/i,
    /innerHTML\s*=\s*.*file/i,
    /innerHTML\s*=\s*`.*?\$\{.*?nama.*?\}.*?`/i
  ];

  for (const pattern of dangerousPatterns) {
    assert.strictEqual(
      pattern.test(content),
      false,
      `Ditemukan potensi celah XSS pada ${file} dengan pola: ${pattern}`
    );
  }
}

// 3. Periksa Office viewer URL di daftar.html
console.log('3. Memeriksa Office Online Viewer di public/daftar.html...');
const daftarHtml = fs.readFileSync('public/daftar.html', 'utf8');
assert.ok(
  daftarHtml.includes('https://view.officeapps.live.com/op/embed.aspx?src='),
  'Harus menggunakan Office Viewer https://view.officeapps.live.com/op/embed.aspx?src='
);
assert.ok(
  daftarHtml.includes('Buka di tab baru'),
  'Harus menyediakan tombol cadangan Buka di tab baru'
);

// 4. Periksa tautan peran di index.html
console.log('4. Memeriksa tautan tiga peran di public/index.html...');
const indexHtml = fs.readFileSync('public/index.html', 'utf8');
assert.ok(indexHtml.includes('href="/siswa"'), 'Tombol Siswa harus mengarah ke /siswa');
assert.ok(indexHtml.includes('href="/masuk?peran=guru"'), 'Tombol Guru harus mengarah ke /masuk?peran=guru');
assert.ok(indexHtml.includes('href="/masuk?peran=pengawas"'), 'Tombol Pengawas harus mengarah ke /masuk?peran=pengawas');

// 5. Periksa README.md memuat seluruh poin yang diwajibkan
console.log('5. Memeriksa kelengkapan dokumentasi README.md...');
const readmeContent = fs.readFileSync('README.md', 'utf8');
assert.ok(readmeContent.includes('GitHub'), 'README harus memuat panduan GitHub');
assert.ok(readmeContent.includes('Vercel'), 'README harus memuat panduan Vercel');
assert.ok(readmeContent.includes('Blob'), 'README harus memuat panduan Vercel Blob');
assert.ok(readmeContent.includes('GURU_PASSWORD'), 'README harus memuat GURU_PASSWORD');
assert.ok(readmeContent.includes('PENGAWAS_PASSWORD'), 'README harus memuat PENGAWAS_PASSWORD');
assert.ok(readmeContent.includes('SESSION_SECRET'), 'README harus memuat SESSION_SECRET');
assert.ok(readmeContent.includes('Redeploy'), 'README harus memuat panduan Redeploy');
assert.ok(readmeContent.includes('viewer Word butuh URL publik') || readmeContent.includes('URL yang dapat diakses secara publik'), 'README harus mencantumkan catatan viewer Word URL publik');
assert.ok(readmeContent.includes('Keterbatasan Serverless') || readmeContent.includes('tidak berbagi memori'), 'README harus mencantumkan catatan keterbatasan memori rate limit serverless');
assert.ok(readmeContent.includes('XI-1') && readmeContent.includes('XI-2'), 'README harus memuat kelas XI-1 dan XI-2');
assert.ok(readmeContent.includes('revisi') || readmeContent.includes('Revisi'), 'README harus memuat panduan revisi');
assert.ok(readmeContent.includes('hapus') || readmeContent.includes('Hapus'), 'README harus memuat fitur hapus');
assert.ok(readmeContent.includes('Data Uji Lama') || readmeContent.includes('membersihkan'), 'README harus memuat cara membersihkan data uji lama');
assert.ok(readmeContent.includes('kuota') || readmeContent.includes('Hobby Plan'), 'README harus mencantumkan batas kuota gratis');

console.log('\n--- SEMUA AUDIT KEAMANAN DAN KELENGKAPAN BERHASIL (100% PASS) ---');
