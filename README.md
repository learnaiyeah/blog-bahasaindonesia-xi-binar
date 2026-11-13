# Panduan Aplikasi Pengumpulan dan Penilaian Tugas Siswa

Aplikasi web sederhana dan aman untuk mengumpulkan tugas siswa, memeriksa dan memberi nilai oleh Guru, serta memantau tugas oleh Pengawas. Semua data dan file tugas disimpan secara terpusat di **Vercel Blob Storage** tanpa memerlukan database terpisah.

---

## Daftar Isi
1. [Panduan Deploy ke Server Mandiri Sekolah (MySQL + Domain Sendiri)](#panduan-deploy-ke-server-mandiri-sekolah-mysql--domain-sendiri)
2. [Fitur Utama & Pembaruan Sistem](#fitur-utama--pembaruan-sistem)
3. [Panduan Alternatif Deploy ke Vercel Cloud](#panduan-alternatif-deploy-ke-vercel-cloud)
4. [Struktur Path Penyimpanan & Cara Kerja Revisi](#struktur-path-penyimpanan--cara-kerja-revisi)
5. [Fitur Penghapusan Tugas oleh Guru](#fitur-penghapusan-tugas-oleh-guru)
6. [Cara Mengubah Kelas, Bab, dan Kata Sandi](#cara-mengubah-kelas-bab-dan-kata-sandi)
7. [Panduan Menguji Ketiga Peran Pengguna](#panduan-menguji-ketiga-peran-pengguna)
8. [Catatan Keamanan dan Keterbatasan Sistem](#catatan-keamanan-dan-keterbatasan-sistem)

---

## Panduan Deploy ke Server Mandiri Sekolah (MySQL + Domain Sendiri)

Sistem ini mendukung deployment penuh pada **server mandiri sekolah** (On-Premise / VPS Linux seperti Ubuntu, Debian, atau Windows Server) menggunakan **Node.js Express** dan database **MySQL / MariaDB**. Berkas tugas disimpan langsung di penyimpanan server sekolah (`/uploads`), dan sistem siap dihubungkan ke domain sekolah sendiri (misalnya `https://tugas.sekolahku.sch.id`).

### 1. Kebutuhan Server
- **Sistem Operasi**: Ubuntu Server 20.04/22.04/24.04 LTS, Debian, CentOS, atau Windows Server.
- **Node.js**: Versi 18.x ke atas (disarankan versi LTS terbaru).
- **Database**: MySQL 8.0+ atau MariaDB 10.5+.
- **Web Server / Reverse Proxy**: Nginx (disarankan) atau Apache.

### 2. Langkah Instalasi di Server Sekolah

#### a. Salin Berkas Proyek & Pasang Dependensi
```bash
# Masuk ke folder proyek
cd "BLOG Pembelajaran Bu Ulfa"

# Pasang semua paket dependensi
npm install
```

#### b. Konfigurasi Database MySQL
1. Buka MySQL di server:
   ```bash
   mysql -u root -p
   ```
2. Impor skema database dari file `database/schema.sql`:
   ```bash
   mysql -u root -p < database/schema.sql
   ```
   *(Catatan: Aplikasi juga memiliki fitur auto-create table saat pertama kali dijalankan).*

#### c. Atur Environment Variables (`.env`)
Salin berkas `.env.example` menjadi `.env`, lalu sesuaikan kredensial server dan database Anda:
```ini
# Port server aplikasi web
PORT=3000

# Konfigurasi Database MySQL Sekolah
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password_mysql_sekolah
DB_NAME=tugas_sekolah

# Kata sandi akses web
GURU_PASSWORD=guru123
PENGAWAS_PASSWORD=pengawas123

# Kunci tanda tangan cookie sesi (HMAC-SHA256)
SESSION_SECRET=kunci_rahasia_sekolah_acak_panjang_minimal_32_karakter_abcdef123456789
```

#### d. Menjalankan Server Aplikasi
Jalankan aplikasi dengan perintah:
```bash
npm start
```
Untuk server produksi agar aplikasi tetap aktif terus menerus (*background process*) dan otomatis berjalan kembali saat server restart, gunakan **PM2**:
```bash
# Pasang PM2 secara global jika belum ada
npm install -g pm2

# Jalankan server
pm2 start server.js --name "tugas-sekolah"

# Simpan proses agar otomatis aktif saat server restart
pm2 startup
pm2 save
```

---

### 3. Menghubungkan Domain Sekolah & SSL (HTTPS) dengan Nginx

Jika sekolah Anda memiliki domain sendiri (misalnya `tugas.sekolahku.sch.id`), arahkan DNS record A domain tersebut ke alamat IP publik server sekolah Anda.

Kemudian buat konfigurasi reverse proxy Nginx di server (`/etc/nginx/sites-available/tugas-sekolah`):

```nginx
server {
    server_name tugas.sekolahku.sch.id;

    # Batas ukuran unggah berkas (maksimal 15 MB)
    client_max_body_size 15M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktifkan konfigurasi dan pasang sertifikat SSL gratis (Let's Encrypt):
```bash
sudo ln -s /etc/nginx/sites-available/tugas-sekolah /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Pasang SSL gratis HTTPS
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d tugas.sekolahku.sch.id
```

Setelah langkah ini selesai, website pengumpulan tugas sudah aktif penuh di domain resmi sekolah Anda dengan protokol aman **HTTPS**!

---

## Panduan Alternatif Deploy ke Vercel Cloud

---

## Fitur Utama & Pembaruan Sistem

- **Daftar Kelas Aktif**:
  - Kelas resmi yang aktif saat ini adalah **XI-1** dan **XI-2** (dikonfigurasi di `api/_config.js`). Server menolak kiriman di luar kedua kelas ini.
- **Catatan dari Siswa untuk Guru**:
  - Siswa dapat menyertakan pesan/catatan opsional (maksimal 300 karakter) dengan indikator penghitung karakter. Catatan ini tersimpan di field `catatanSiswa` dan tampil di panel detail untuk Guru dan Pengawas.
- **Sistem Revisi Tugas Otomatis**:
  - Siswa yang mengirim ulang tugas dengan kombinasi **nama, kelas, dan bab yang sama** otomatis dicatat sebagai **revisi** dengan nomor versi yang berurutan (Versi 1, Versi 2, dst.).
  - Rekaman versi lama **tidak ditimpa dan tidak dihapus**.
  - Di halaman daftar, hanya satu baris per siswa per bab yang ditampilkan, yaitu **versi terbaru**.
  - Jika versi sebelumnya sudah pernah dinilai oleh guru lalu siswa mengirimkan revisi baru yang belum dinilai, statusnya otomatis menjadi **"Perlu dinilai ulang"**, dan nilai lama ditampilkan sebagai bahan acuan guru.
  - Guru memberikan nilai pada versi terbaru. Versi lama dapat dilihat pratinjaunya sebagai riwayat.
- **Fitur Hapus Tugas dan Hapus Siswa oleh Guru**:
  - Guru dapat menghapus versi tugas tertentu melalui endpoint `POST /api/hapus`.
  - Guru juga dapat menghapus **seluruh data siswa beserta seluruh riwayat revisinya** melalui tombol **"Hapus Siswa"** yang tersedia di kolom aksi tabel dan pada header panel detail.
  - Server menghapus file rekaman JSON sekaligus file fisik tugas di Vercel Blob menggunakan fungsi `del`.
  - Dilengkapi dialog konfirmasi pencegahan ketidaksengajaan.
  - Jika versi terbaru dihapus, versi sebelumnya otomatis naik menjadi versi terbaru di daftar. Jika seluruh versi atau siswa dihapus, baris siswa otomatis hilang dari tabel tanpa memuat ulang halaman.
  - Pengawas tidak memiliki akses ke fitur ini (server membalas 403, dan elemen tombol tidak dirender sama sekali di antarmuka pengawas).
- **Tampilan Khusus Pengawas**:
  - Pengawas memiliki akses membaca penuh: pratinjau dokumen (PDF & Word), riwayat versi, nilai, catatan guru, dan catatan siswa.
  - Pengawas **tidak melihat formulir nilai, isian catatan, tombol simpan, maupun tombol hapus**. Seluruh elemen interaktif tersebut **tidak dirender sama sekali** di halaman Pengawas (bukan sekadar disembunyikan CSS).
  - Server secara ketat menolak permintaan pengawas ke `POST /api/nilai` dan `POST /api/hapus` dengan kode `403 Forbidden`.
- **Unduh Rekap Nilai (CSV)**:
  - Berisi versi terbaru setiap siswa, dengan kolom: `Nama, Kelas, Bab, Versi, Waktu Kirim, Status, Nilai, Catatan Guru, Catatan Siswa`.

---

## Persiapan Awal

Sebelum memulai, pastikan Anda telah memiliki:
1. Akun di [GitHub](https://github.com) (gratis).
2. Akun di [Vercel](https://vercel.com) (gratis, masuk menggunakan akun GitHub Anda).
3. Komputer dengan Git dan Node.js terpasang (jika ingin menjalankan atau menguji di komputer lokal).

---

## Langkah 1: Mengunggah Proyek ke GitHub

1. Buka situs [GitHub](https://github.com) dan masuk ke akun Anda.
2. Klik tombol **New** untuk membuat repositori baru, misalnya `portal-tugas-siswa`.
3. Buka terminal atau Command Prompt di folder proyek ini, lalu jalankan:

```bash
git init
git add .
git commit -m "Pembaruan sistem pengumpulan tugas: revisi, catatan siswa, dan hapus tugas"
git branch -M main
git remote add origin https://github.com/USERNAME-ANDA/portal-tugas-siswa.git
git push -u origin main
```
*(Sesuaikan `USERNAME-ANDA` dengan nama pengguna GitHub Anda).*

---

## Langkah 2: Mengimpor Proyek ke Vercel

1. Buka [Dashboard Vercel](https://vercel.com/dashboard).
2. Klik tombol **Add New...** > **Project**.
3. Pilih repositori `portal-tugas-siswa` dan klik **Import**.
4. Biarkan konfigurasi default (Framework: Other, Root Directory: `./`), lalu klik **Deploy**.

---

## Langkah 3: Membuat dan Menghubungkan Vercel Blob Storage

1. Di dashboard proyek Anda di Vercel, buka tab **Storage**.
2. Klik **Connect Store** atau **Create Database**, lalu pilih **Blob**.
3. Beri nama store (misalnya `store-tugas-siswa`) dan pilih akses **Public** (akses public diperlukan agar dokumen Word dapat dipratinjau melalui Office Online Viewer).
4. Klik **Create** dan hubungkan (*Connect*) ke proyek Anda.
5. Vercel secara otomatis menambahkan variabel lingkungan `BLOB_READ_WRITE_TOKEN`.

---

## Langkah 4: Mengatur Environment Variables

Di dashboard proyek Vercel Anda, buka menu **Settings** > **Environment Variables** dan tambahkan 3 variabel rahasia berikut:

| Nama Variabel | Nilai Contoh | Keterangan |
| :--- | :--- | :--- |
| `GURU_PASSWORD` | `GuruHebat2026!` | Kata sandi untuk Guru masuk ke sistem |
| `PENGAWAS_PASSWORD` | `PantauAman2026!` | Kata sandi untuk Pengawas memantau sistem |
| `SESSION_SECRET` | *(string acak minimal 32 karakter)* | Kunci rahasia untuk tanda tangan digital cookie sesi |

### Cara Membuat String Acak untuk `SESSION_SECRET`:
Jalankan perintah ini di terminal komputer Anda:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Salin string hasil keluaran tersebut dan tempelkan sebagai nilai `SESSION_SECRET`.

---

## Langkah 5: Melakukan Redeploy

Setelah menambahkan variabel lingkungan:
1. Buka tab **Deployments** di Vercel.
2. Klik tombol titik tiga (`...`) pada deployment terbaru, lalu pilih **Redeploy**.
3. Tunggu hingga proses selesai, maka aplikasi siap digunakan secara langsung.

---

## Struktur Path Penyimpanan & Cara Kerja Revisi

### 1. Struktur Path Blob
Agar perhitungan versi efisien dan pengelompokan data rapi, berkas disimpan dengan struktur path berikut:
- **Berkas Fisik Tugas**:
  `file/{id}/{namaFileAman}`
- **Metadata Rekaman Tugas**:
  `tugas/{kelas}/{bab}/{kunciNama}/{id}.json`

*Keterangan*:
- `{kelas}`: Nama kelas (misal: `XI-1`).
- `{bab}`: Nama bab pembelajaran (misal: `Bab_1`).
- `{kunciNama}`: Nama siswa yang telah dibersihkan huruf kecil dan spasinya (misal: `budi_santoso`).
- `{id}`: UUID unik per pengiriman (misal: `crypto.randomUUID()`).

### 2. Penghitungan Versi
Ketika siswa mengirimkan tugas, sistem menjalankan `list` dengan prefix `tugas/{kelas}/{bab}/{kunciNama}/`. Jumlah berkas JSON yang sudah ada menentukan nomor versi baru (`versi = totalBerkas + 1`). Jika versi lebih dari 1, `revisi` otomatis bernilai `true`.

### 3. Tiga Status Nilai
- **Belum dinilai**: Versi terbaru belum dinilai dan tidak ada versi lama yang pernah dinilai.
- **Sudah dinilai**: Versi terbaru telah diberikan nilai oleh guru.
- **Perlu dinilai ulang**: Versi terbaru belum dinilai, tetapi salah satu versi sebelumnya sudah pernah dinilai. Guru dapat melihat nilai versi lama tersebut sebagai referensi saat menilai versi revisi.

---

## Fitur Penghapusan Tugas oleh Guru

Guru dapat menghapus tugas yang salah kirim atau tidak diperlukan:
1. Klik baris tugas siswa untuk membuka panel detail.
2. Di kotak **Riwayat Versi Tugas**, setiap versi memiliki tombol merah **Hapus**.
3. Guru akan diminta konfirmasi: *"Hapus tugas ini? Tindakan ini tidak bisa dibatalkan."*
4. Server (`POST /api/hapus`) akan menghapus:
   - File JSON rekaman tugas di Blob.
   - File fisik tugas (.pdf / .docx) di Blob.
5. Jika versi terbaru dihapus, versi sebelumnya otomatis menjadi versi terbaru. Jika seluruh versi siswa pada bab tersebut dihapus, baris siswa tersebut otomatis hilang dari tabel.

---

## Cara Mengubah Kelas, Bab, dan Kata Sandi

### 1. Mengubah Kelas dan Bab
- **Mengatur Bab via Dashboard (Praktis):** Guru dapat mengatur jumlah dan judul bab langsung dari antarmuka web melalui tombol **"Atur Bab KTI"** di bilah atas dashboard Guru tanpa perlu mengedit kode.
- **Mengatur Kelas & Konfigurasi Kode:** Buka file `api/_config.js`:
```javascript
export const KELAS = ['XI-1', 'XI-2'];
export const BAB = ['Bab 1', 'Bab 2'];
```
Ubah sesuai kebutuhan, lalu simpan, commit, dan push kembali ke GitHub.

### 2. Mengubah Kata Sandi
Ubah `GURU_PASSWORD` atau `PENGAWAS_PASSWORD` di menu **Settings** > **Environment Variables** pada dashboard Vercel Anda, lalu lakukan **Redeploy**.

---

## Cara Membersihkan Data Uji Lama dari Dashboard Blob

Jika sebelum pembaruan ini Anda sudah sempat mengirimkan data uji dengan kelas lama (misal `X-1`, `X-2`, `X-3`) atau struktur path lama (`tugas/*.json`), Anda dapat membersihkannya langsung dari dashboard Vercel:

1. Buka proyek Anda di Vercel, lalu klik tab **Storage**.
2. Pilih Blob Store Anda (misalnya `store-tugas-siswa`).
3. Klik tab **Browser**. Anda akan melihat daftar folder dan berkas yang tersimpan.
4. Cari dan centang berkas atau folder lama yang ingin dihapus (misalnya file di folder `tugas/` atau `file/`).
5. Klik tombol **Delete** berwarna merah di bagian atas tabel dan konfirmasi penghapusan.
6. Data uji lama akan terhapus dan penyimpanan Anda kembali bersih.

---

## Panduan Menguji Ketiga Peran Pengguna

### 1. Siswa
- Buka `/siswa`. Pastikan dropdown kelas hanya menampilkan **XI-1** dan **XI-2**.
- Tulis nama (misal `Ahmad Fauzi`), pilih kelas `XI-1`, bab `Bab 1`, tulis catatan opsional, lalu unggah file PDF.
- Setelah terkirim, tampil pesan sukses "Tugas Berhasil Terkirim!".
- Kirim sekali lagi dengan nama, kelas, dan bab yang sama. Sistem akan menampilkan pesan: **"Revisi berhasil dikirim (versi ke-2)"**.

### 2. Guru
- Masuk ke `/masuk?peran=guru` dengan password guru.
- Di halaman `/daftar`, klik baris Ahmad Fauzi.
- Buka riwayat versi, baca catatan siswa, pratinjau tugas, masukkan nilai (misal `80`), lalu simpan.
- Jika siswa mengirimkan Versi 3, status di tabel otomatis berubah menjadi **"Perlu dinilai ulang (Nilai lama: 80)"**.
- Guru dapat mencoba tombol **Hapus** pada salah satu versi untuk menguji penghapusan.

### 3. Pengawas
- Masuk ke `/masuk?peran=pengawas` dengan password pengawas.
- Di halaman `/daftar`, buka panel detail tugas.
- Pengawas dapat membaca pratinjau berkas, riwayat versi, catatan siswa, dan nilai sebagai teks biasa.
- Formulir nilai, catatan guru, tombol simpan, dan tombol hapus **tidak muncul sama sekali**.

---

## Catatan Keamanan dan Keterbatasan Sistem

### 1. Pembaca Dokumen Microsoft Word (Office Online Viewer)
Untuk menampilkan dokumen Microsoft Word (.doc dan .docx) langsung di peramban tanpa software tambahan, aplikasi menggunakan layanan resmi *Microsoft Office Online Viewer* (`https://view.officeapps.live.com`).
> **Penting**: Dikarenakan viewer Word butuh URL publik, jadi siapa pun yang tahu URL sebuah file bisa membukanya. Namun, URL file dibuat menggunakan akhiran acak (*random suffix*) yang sangat panjang sehingga tidak dapat ditebak oleh pihak luar. Selalu sediakan tombol "Buka di tab baru" sebagai cadangan apabila jaringan siswa memblokir akses ke domain Microsoft Office.

### 2. Pembatasan Percobaan Login (*Rate Limiting*)
Aplikasi dilengkapi sistem pengamanan login: jika terjadi 5 kali kegagalan memasukkan kata sandi dari satu alamat IP dalam kurun waktu 10 menit, sistem akan memblokir sementara percobaan login berikutnya selama 10 menit, serta memberikan jeda waktu 1 detik setiap kegagalan.
> **Keterbatasan Serverless**: Karena Vercel Serverless Functions berjalan secara dinamis di *cloud* dan tidak berbagi memori antar-server, pencatatan kegagalan ini disimpan di memori instans yang sedang aktif. Meskipun demikian, jeda 1 detik dan memori lokal tetap efektif mencegah serangan coba-coba otomatis (*brute-force* cepat).

### 3. Kuota Gratis Vercel Blob (*Hobby Plan*)
Paket gratis Vercel (*Hobby Plan*) mencakup:
- **Penyimpanan Total**: Hingga 1 GB data.
- **Operasi Unggah / Tulis (*Simple Put*)**: Hingga 10.000 operasi per bulan.
- **Operasi Baca / Unduh (*Read*)**: Hingga 50.000 operasi per bulan.
- **Transfer Data (*Bandwidth*)**: Hingga 10 GB per bulan.
"# blog-bahasaindonesia-xi-binar" 
