# 📚 Portal Pembelajaran & Penilaian KTI Bahasa Indonesia - SMK Bina Rahayu
### Pengampu: Ibu Ulfa • Kelas XI (XI-1 & XI-2)

Aplikasi web portal pembelajaran dan sistem penilaian Karya Tulis Ilmiah (KTI) Bahasa Indonesia yang dirancang khusus untuk kebutuhan pembelajaran di **SMK Bina Rahayu**. Sistem ini menyediakan alur kerja terpadu untuk pengumpulan naskah tugas siswa, pemeriksaan dan penilaian langsung oleh Guru, pemantauan oleh Pengawas Sekolah, pengaturan bab dan batas waktu pengumpulan (*deadline*) dinamis, hingga fitur ubah kata sandi mandiri yang tersimpan secara persisten.

Repositori Resmi GitHub: [https://github.com/learnaiyeah/blog-bahasaindonesia-xi-binar](https://github.com/learnaiyeah/blog-bahasaindonesia-xi-binar)

---

## 📑 Daftar Isi
1. [Spesifikasi Teknis & Fitur Sistem](#-spesifikasi-teknis--fitur-sistem)
2. [Panduan Deploy ke Server Sekolah via SSH (Langkah Lengkap)](#-panduan-deploy-ke-server-sekolah-via-ssh-langkah-lengkap)
3. [Panduan Pemeliharaan & Update Kode di Server Sekolah](#-panduan-pemeliharaan--update-kode-di-server-sekolah)
4. [Panduan Alternatif Deploy ke Vercel Cloud + Blob Storage](#-panduan-alternatif-deploy-ke-vercel-cloud--blob-storage)
5. [Fitur Lengkap & Alur Kerja Tiga Peran](#-fitur-lengkap--alur-kerja-tiga-peran)
6. [Struktur Path Penyimpanan & Cara Kerja Revisi](#-struktur-path-penyimpanan--cara-kerja-revisi)
7. [Fitur Penghapusan Tugas & Siswa oleh Guru](#-fitur-penghapusan-tugas--siswa-oleh-guru)
8. [Cara Mengubah Kelas, Bab, dan Kata Sandi](#-cara-mengubah-kelas-bab-dan-kata-sandi)
9. [Cara Membersihkan Data Uji Lama](#-cara-membersihkan-data-uji-lama)
10. [Panduan Menguji Ketiga Peran Pengguna](#-panduan-menguji-ketiga-peran-pengguna)
11. [Catatan Keamanan dan Keterbatasan Sistem](#-catatan-keamanan-dan-keterbatasan-sistem)

---

## ⚙️ Spesifikasi Teknis & Fitur Sistem

### 1. Spesifikasi Perangkat Lunak (Software Stack)
- **Runtime Environment**: Node.js v18.x - v24.x LTS.
- **Backend Framework**:
  - Mode Server Mandiri (On-Premise / VPS): **Express.js** dengan Multer untuk manajemen unggah berkas fisik ke folder lokal `/uploads`.
  - Mode Cloud (Serverless): **Vercel Serverless Functions** dengan `@vercel/blob` untuk penyimpanan cloud terdistribusi.
- **Basis Data (Database)**:
  - **MySQL 8.0+ / MariaDB 10.5+**: Menyimpan seluruh rekaman tugas siswa, penilaian, catatan revisi, batas waktu (*deadline*), riwayat versi, serta pengaturan sistem (`tugas_sekolah.tugas` dan `tugas_sekolah.pengaturan`).
  - **Fallback Storage**: `database/bab.json` & `database/passwords.json` untuk redundansi data saat dijalankan tanpa server database terpisah.
- **Frontend & Antarmuka Pengguna (UI/UX)**:
  - Desain antarmuka modern bernuansa akademis dengan identitas SMK Bina Rahayu (logo sekolah, navigasi bersih, dan tipografi rapi).
  - **Dynamic Island Floating Navbar**: Bilah navigasi melayang berbentuk kapsul elegan terinspirasi Apple Dynamic Island dengan latar gelap obsidian (`dark slate glassmorphism`), bayangan melayang (*floating shadow*), logo melingkar, serta penataan tombol aksi yang terpadu dan estetik.
  - **Tata Letak Adaptif Responsif**:
    - **Layar Desktop / Laptop**: Mengoptimalkan layar lebar (*landscape*) dengan sistem *split-screen*: sisi kiri menampilkan dokumen naskah secara penuh dan sisi kanan menampilkan formulir penilaian & riwayat versi.
    - **Layar Mobile / Smartphone**: Mengoptimalkan ruang vertikal (*portrait*) secara efisien dengan *Tab Switcher* (`📄 Naskah Siswa` vs `📝 Penilaian & Riwayat`) serta kartu ringkas yang nyaman disentuh.
- **Pratinjau Dokumen KTI Langsung di Browser**:
  - **PDF**: Ditampilkan langsung di peramban menggunakan native PDF viewer iframe.
  - **Microsoft Word (.docx)**: Dirender langsung di browser siswa dan guru menggunakan pustaka *client-side* `docx-preview.js` tanpa perlu unduh berkas.
  - **Microsoft Word (.doc cadangan)**: Terintegrasi dengan layanan resmi *Microsoft Office Online Viewer* (`https://view.officeapps.live.com/op/embed.aspx?src=`) serta tombol cadangan "Buka di tab baru".
- **Keamanan Siber & Integritas Data**:
  - **Rate Limiting Login**: Maksimal 5 kali kegagalan login dalam 10 menit per IP, dilengkapi jeda waktu keamanan 1 detik untuk menangkal serangan *brute-force*.
  - **Cookie Sesi Aman**: Berbasis token kriptografi HMAC-SHA256 dengan atribut `HttpOnly`, `Secure`, dan `SameSite=Strict`.
  - **Timing-Safe Comparison**: Menggunakan `crypto.timingSafeEqual` untuk mencegah celah *timing attack* pada pencocokan kata sandi.
  - **Sanitasi Berkas & XSS Safe**: Perlindungan dari bahaya *path traversal*, penamaan berkas acak yang aman, dan pencegahan injeksi skrip HTML/JS.

---

## 🚀 Panduan Deploy ke Server Sekolah via SSH (Langkah Lengkap)

Panduan ini ditujukan bagi Guru atau Pengelola IT Sekolah untuk memasang dan menjalankan aplikasi ini pada **komputer server fisik sekolah** atau **VPS sekolah** (Ubuntu/Debian) menggunakan jalur akses **SSH** (*Secure Shell*).

### 1. Kebutuhan Server Sekolah
- **Sistem Operasi**: Linux Ubuntu Server (20.04 / 22.04 / 24.04 LTS disarankan) atau Debian.
- **Akses Jaringan**: IP Server Sekolah (misal `192.168.1.50` di jaringan lokal, atau IP Publik sekolah).
- **Akun Login SSH**: Username dan Password (atau SSH Key) dari server sekolah.
- **Node.js**: Versi 18 ke atas.
- **MySQL / MariaDB**: Server database aktif di server.

---

### 2. Langkah 1: Masuk ke Server Sekolah Melalui SSH

Buka Terminal (di Linux/macOS) atau Command Prompt / PowerShell / PuTTY (di Windows), lalu hubungkan ke server sekolah:

```bash
ssh username@ip-server-sekolah
# Contoh:
# ssh admin@192.168.1.50
# Atau jika server menggunakan port khusus:
# ssh -p 2222 admin@server.binarahayu.sch.id
```
Ketik `yes` jika muncul konfirmasi sidik jari SSH (*fingerprint*), lalu masukkan kata sandi server Anda.

---

### 3. Langkah 2: Memasang Node.js & MySQL (Jika Belum Ada di Server)

Jalankan perintah berikut di dalam terminal SSH untuk memasang paket yang dibutuhkan:

```bash
# Perbarui daftar paket server
sudo apt update && sudo apt upgrade -y

# Pasang Node.js 20 LTS & Git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Pasang MySQL Server
sudo apt install -y mysql-server

# Pasang Process Manager PM2 (agar web berjalan terus di latar belakang)
sudo npm install -g pm2
```

---

### 4. Langkah 3: Mengunggah Berkas Proyek ke Server Sekolah

Ada dua cara untuk menaruh file proyek di server:

#### Opsi A: Mengambil Langsung dari GitHub (Sangat Disarankan & Praktis)
Karena kode proyek sudah berada di GitHub, Anda bisa langsung melakukan kloning di server:
```bash
# Masuk ke direktori web server sekolah (misalnya /var/www)
cd /var/www

# Kloning repositori GitHub
sudo git clone https://github.com/learnaiyeah/blog-bahasaindonesia-xi-binar.git blog-kti

# Masuk ke folder proyek
cd blog-kti

# Berikan izin akses folder ke user SSH Anda
sudo chown -R $USER:$USER /var/www/blog-kti
```

#### Opsi B: Mengunggah Berkas dari Laptop via SCP
Jika server sekolah tidak memiliki akses langsung ke internet untuk git clone, buka jendela terminal baru di laptop Anda (bukan di sesi SSH), lalu kirim berkas menggunakan perintah `scp`:
```bash
# Dijalankan dari folder proyek di komputer/laptop Anda:
scp -r * username@ip-server-sekolah:/var/www/blog-kti/
```

---

### 5. Langkah 4: Memasang Dependensi Proyek

Di dalam sesi terminal SSH, jalankan instalasi paket dependensi:
```bash
cd /var/www/blog-kti
npm install --production
```

---

### 6. Langkah 5: Menyiapkan Database MySQL

1. Masuk ke konsol MySQL di server:
   ```bash
   sudo mysql -u root -p
   ```
2. Buat database baru bernama `tugas_sekolah`:
   ```sql
   CREATE DATABASE IF NOT EXISTS tugas_sekolah CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   EXIT;
   ```
3. Impor struktur tabel dari berkas `schema.sql` yang sudah disediakan:
   ```bash
   mysql -u root -p tugas_sekolah < database/schema.sql
   ```
   *(Catatan: Aplikasi juga memiliki kecerdasan auto-create table saat pertama kali dijalankan).*

---

### 7. Langkah 6: Mengatur File Konfigurasi Lingkungan (`.env`)

Salin template konfigurasi dan sesuaikan kredensial server sekolah:
```bash
cp .env.example .env
nano .env
```
Sesuaikan isian variabel berikut:
```ini
# Port web yang akan digunakan aplikasi
PORT=3000

# Konfigurasi Koneksi MySQL Server Sekolah
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password_mysql_server_sekolah
DB_NAME=tugas_sekolah

# Kata sandi awal masuk akun Guru dan Pengawas
GURU_PASSWORD=guru123
PENGAWAS_PASSWORD=pengawas123

# Kunci rahasia pengaman sesi login (string acak panjang)
SESSION_SECRET=kunci_rahasia_sekolah_acak_panjang_minimal_32_karakter_abcdef123456789
```
*Tekan `Ctrl + O` lalu `Enter` untuk menyimpan, kemudian tekan `Ctrl + X` untuk keluar dari nano.*

Pastikan folder berkas unggahan memiliki izin tulis:
```bash
mkdir -p uploads database
chmod 775 uploads
```

---

### 8. Langkah 7: Menjalankan Server dengan PM2 (Background Daemon)

Agar aplikasi web tetap aktif terus menerus meskipun jendela terminal SSH ditutup, dan otomatis berjalan kembali jika server restart/reboot, gunakan **PM2**:

```bash
# Jalankan aplikasi server
pm2 start server.js --name "blog-kti"

# Periksa status aplikasi
pm2 status

# Aktifkan service auto-start saat komputer server booting
pm2 startup
# (Jika terminal mengeluarkan instruksi perintah sudo, salin dan jalankan perintah tersebut)

# Simpan konfigurasi proses saat ini
pm2 save
```

Sekarang sistem web pengumpulan tugas sudah aktif di: `http://ip-server-sekolah:3000`

---

### 9. Langkah 8: Menghubungkan Domain Sekolah & SSL HTTPS (Nginx)

Agar alamat web sekolah terlihat resmi dan profesional (misalnya `https://tugas.binarahayu.sch.id`), pasang Nginx sebagai *reverse proxy*:

1. Pasang Nginx:
   ```bash
   sudo apt install -y nginx
   ```
2. Buat berkas konfigurasi baru:
   ```bash
   sudo nano /etc/nginx/sites-available/blog-kti
   ```
   Tempelkan konfigurasi berikut:
   ```nginx
   server {
       listen 80;
       server_name tugas.binarahayu.sch.id; # Ganti dengan domain sekolah atau IP server

       client_max_body_size 15M; # Batas maksimum berkas tugas naskah KTI (15 MB)

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
3. Aktifkan konfigurasi dan muat ulang Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/blog-kti /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```
4. Pasang sertifikat SSL gratis (Let's Encrypt HTTPS):
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d tugas.binarahayu.sch.id
   ```

Aplikasi pengumpulan tugas sekarang siap diakses oleh siswa dan guru melalui protokol aman **HTTPS**!

---

## 🔄 Panduan Pemeliharaan & Update Kode di Server Sekolah

Jika ada pembaruan kode atau perbaikan fitur baru di masa mendatang, guru atau tim IT sekolah cukup membuka SSH dan menjalankan 3 perintah cepat ini:

```bash
# 1. Masuk ke folder proyek di server sekolah
cd /var/www/blog-kti

# 2. Tarik pembaruan kode terbaru dari repositori GitHub
git pull origin main

# 3. Pasang dependensi baru jika ada, lalu restart aplikasi
npm install --production
pm2 restart blog-kti
```
Proses pembaruan selesai dalam hitungan detik tanpa memutus koneksi database atau menghapus tugas yang sudah terkumpul!

---

## ☁️ Panduan Alternatif Deploy ke Vercel Cloud + Blob Storage

Jika sekolah ingin alternatif hosting *cloud serverless* gratis tanpa memelihara server fisik, aplikasi ini juga 100% kompatibel dengan Vercel:

### Bagaimana Vercel Menjadi Database?
Pada mode Vercel, sistem memanfaatkan **Vercel Blob Storage** sebagai basis data cloud terpadu:
- Berkas dokumen fisik disimpan di path `file/{id}/{namaFileAman}`.
- Metadata tugas (nilai, catatan, riwayat versi) disimpan di path `tugas/{kelas}/{bab}/{kunciNama}/{id}.json`.
- Pengaturan bab & batas waktu pengumpulan disimpan di `pengaturan/bab.json`.
- Kata sandi Guru dan Pengawas yang diubah dinamis disimpan di `pengaturan/passwords.json`.

### 1. Unggah ke Repositori GitHub
Pastikan seluruh kode terbaru sudah di-commit dan di-push ke repositori GitHub Anda.

### 2. Hubungkan Proyek ke Vercel
1. Buka [Dashboard Vercel](https://vercel.com/dashboard).
2. Klik tombol **Add New...** > **Project** lalu impor repositori GitHub Anda.
3. Klik tombol **Deploy**.

### 3. Buat dan Hubungkan Vercel Blob Storage
1. Di halaman proyek Vercel, buka tab **Storage**.
2. Klik **Connect Store** > pilih **Blob**.
3. Beri nama store (misal `store-tugas-siswa`) dan pilih akses **Public** (akses public diperlukan agar dokumen Word dapat dipratinjau melalui Office Online Viewer).
4. Klik **Create** dan hubungkan (*Connect*) ke proyek Anda. Vercel secara otomatis menambahkan `BLOB_READ_WRITE_TOKEN`.

### 4. Tambahkan Environment Variables di Vercel
Buka menu **Settings** > **Environment Variables** pada dashboard Vercel, lalu tambahkan:

| Nama Variabel | Nilai Contoh | Keterangan |
| :--- | :--- | :--- |
| `GURU_PASSWORD` | `ulfahayati` (atau `guru123`) | Kata sandi masuk Guru awal |
| `PENGAWAS_PASSWORD` | `pengawas123` | Kata sandi masuk Pengawas awal |
| `SESSION_SECRET` | *(string acak minimal 32 karakter)* | Kunci HMAC sesi cookie |

*Untuk membuat `SESSION_SECRET` acak, jalankan di terminal laptop:*
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Melakukan Redeploy di Vercel
Setelah menambahkan variabel lingkungan:
1. Buka tab **Deployments** di Vercel.
2. Klik tombol opsi (`...`) pada deployment terbaru, lalu pilih **Redeploy**.
3. Sistem cloud siap digunakan dan langsung aktif online!

---

## 👥 Fitur Lengkap & Alur Kerja Tiga Peran

### 1. Peran Siswa (Pengumpulan Naskah KTI)
- **Halaman**: `/siswa`
- **Pilihan Kelas**: Hanya menampilkan kelas aktif **XI-1** dan **XI-2** (server memvalidasi ketat).
- **Pilihan Bab**: Menyesuaikan secara dinamis dengan bab yang sedang aktif diatur oleh guru.
- **Pesan / Catatan Siswa**: Siswa dapat menyertakan pesan/catatan opsional untuk guru (maksimal 300 karakter).
- **Indikator Batas Waktu**: Jika guru mengaktifkan deadline pada bab tertentu, siswa akan melihat pengingat tanggal dan batas jam pengumpulan.
- **Revisi Naskah**: Siswa dapat mengirimkan perbaikan berkali-kali. Sistem secara otomatis menaikkan nomor versi (Versi 1, Versi 2, dst.) tanpa menghapus riwayat naskah sebelumnya.

### 2. Peran Guru (Ibu Ulfa - Penilaian & Pengelolaan)
- **Halaman**: `/masuk?peran=guru` -> diarahkan ke `/daftar`
- **Tampilan Berkas Langsung**: Pratinjau PDF dan dokumen Word (.docx) secara utuh langsung di layar peramban.
- **Penilaian & Catatan Guru**: Memberikan nilai angka (0 - 100) dan catatan evaluasi/arahan revisi yang dapat dibaca siswa.
- **Manajemen Bab & Batas Waktu**: Tombol **"Atur Bab KTI"** memungkinkan guru mengatur jumlah bab, mengubah judul bab, serta mengaktifkan/menonaktifkan tanggal & jam deadline per bab.
- **Status Keterlambatan Otomatis**: Naskah yang dikirim melewati batas waktu akan ditandai badge **"⏱ Terlambat (x jam)"**, sedangkan yang tepat waktu bertanda **"✓ Tepat Waktu"**.
- **Cadangkan Data (Backup 1-Klik)**: Tombol **"Cadangkan"** untuk mengunduh seluruh arsip data tugas, riwayat revisi, nilai, dan catatan guru ke dalam berkas JSON mandiri untuk keperluan migrasi atau arsip sekolah.
- **Reset / Bersihkan Data Tugas**: Tombol **"Reset Data"** dengan proteksi ganda (konfirmasi teks `"RESET"` dan verifikasi kata sandi guru) untuk membersihkan seluruh data tugas atau per kelas tertentu.
- **Penghapusan Tugas & Siswa**: Guru dapat menghapus versi tugas tertentu atau menghapus seluruh data siswa jika diperlukan.
- **Ubah Kata Sandi Mandiri**: Guru dapat mengubah kata sandi masuk secara mandiri melalui tombol **"Ubah Sandi"** di header aplikasi dan tersimpan persisten.

### 3. Peran Pengawas (Pemantauan Mutu Pendidikan)
- **Halaman**: `/masuk?peran=pengawas` -> diarahkan ke `/daftar`
- **Akses Baca Penuh**: Membaca naskah siswa, melihat riwayat revisi, memantau nilai yang diberikan guru, serta membaca catatan guru dan siswa.
- **Proteksi Antarmuka**: Seluruh tombol interaktif pengeditan nilai, catatan guru, tombol simpan, tombol hapus tugas, dan tombol atur bab **tidak dirender sama sekali** di antarmuka pengawas.
- **Ubah Kata Sandi Mandiri**: Pengawas dapat mengubah kata sandi akunnya sendiri kapan saja melalui tombol **"Ubah Sandi"**.

---

## 📁 Struktur Path Penyimpanan & Cara Kerja Revisi

### 1. Struktur Path Berkas & Metadata
- **Berkas Fisik**: Disimpan di folder `/uploads/{nama_unik}.pdf` (Server Mandiri) atau `file/{id}/{namaFileAman}` (Vercel Blob).
- **Metadata Tugas**: Disimpan di tabel database MySQL `tugas` dengan kolom lengkap (ID UUID, nama, kelas, bab, kunci_nama, nilai, catatan, versi, revisi, dikirim_pada, dinilai_pada).
- **Format Kunci Nama**: Nama siswa dinormalkan (misal `Budi Santoso` -> `budi_santoso`) agar identifikasi revisi akurat.

### 2. Tiga Status Penilaian Naskah
- **Belum dinilai**: Versi terbaru belum dinilai dan belum ada riwayat nilai sebelumnya.
- **Sudah dinilai**: Naskah versi terbaru telah diberi nilai dan catatan oleh guru.
- **Perlu dinilai ulang**: Siswa baru saja mengirimkan naskah revisi baru setelah naskah versi sebelumnya pernah dinilai guru. Guru akan melihat nilai lama sebagai bahan pertimbangan evaluasi.

---

## 🗑️ Fitur Penghapusan Tugas & Siswa oleh Guru

1. **Hapus Versi Tertentu**: Guru dapat membuka detail tugas siswa, lalu mengklik tombol **Hapus** pada versi yang salah di bagian riwayat versi.
2. **Hapus Seluruh Data Siswa**: Guru dapat mengklik tombol **Hapus Siswa** di tabel utama atau header panel detail untuk menghapus seluruh rekaman beserta semua berkas fisiknya.
3. Server menghapus rekaman di database sekaligus menghapus file fisik di penyimpanan lokal atau cloud.

---

## 🔐 Cara Mengubah Kelas, Bab, dan Kata Sandi

### 1. Mengubah Judul & Batas Waktu Bab (Praktis via Web)
Guru dapat langsung mengklik tombol **"Atur Bab KTI"** di header atas dashboard Guru. Di jendela modal yang muncul, Guru dapat menambah bab baru, mengedit nama bab, mengaktifkan/mematikan deadline, dan mengatur tanggal batas waktu tanpa perlu menyentuh kode program.

### 2. Mengubah Kelas Aktif di Kode
Buka berkas `api/_config.js`:
```javascript
export const KELAS = ['XI-1', 'XI-2'];
```
Ubah daftar kelas sesuai kebutuhan, lalu simpan berkas.

### 3. Mengubah Kata Sandi Masuk
- **Cara Praktis (Langsung via Web)**: Masuk sebagai Guru atau Pengawas, klik tombol **"Ubah Sandi"** di pojok kanan atas bilah header, masukkan kata sandi lama, kata sandi baru (minimal 6 karakter), dan konfirmasi. Kata sandi baru otomatis tersimpan secara persisten di database.
- **Cara Konfigurasi Server**: Ubah nilai `GURU_PASSWORD` atau `PENGAWAS_PASSWORD` pada berkas `.env` (di server sekolah) atau di menu *Settings > Environment Variables* (pada dashboard Vercel lalu lakukan **Redeploy**).

---

## 🧹 Cara Membersihkan Data Uji Lama

Jika Anda ingin membersihkan data uji coba lama:
- **Pada Server Mandiri MySQL**:
  ```bash
  mysql -u root -p -e "TRUNCATE TABLE tugas_sekolah.tugas;"
  rm -rf /var/www/blog-kti/uploads/*
  ```
- **Pada Dashboard Vercel Blob**:
  1. Buka tab **Storage** > pilih Blob Store Anda.
  2. Buka tab **Browser**, centang file/folder lama yang ingin dihapus, lalu klik tombol merah **Delete**.

---

## 🧪 Panduan Menguji Ketiga Peran Pengguna

### 1. Uji Siswa
- Buka `/siswa`, pastikan dropdown kelas memuat **XI-1** dan **XI-2**.
- Isi nama `Ahmad Fauzi`, pilih kelas `XI-1`, pilih bab, sertakan catatan singkat, dan unggah berkas tugas.
- Klik kirim hingga muncul pesan sukses. Coba kirimkan kembali untuk memverifikasi pesan revisi otomatis.

### 2. Uji Guru
- Masuk ke `/masuk?peran=guru` menggunakan kata sandi guru (`guru123`).
- Klik baris siswa, periksa tampilan naskah Word/PDF di layar kiri, isi nilai `85` dan catatan guru di layar kanan, lalu klik simpan.
- Coba tombol **"Atur Bab KTI"** dan **"Ubah Sandi"**.

### 3. Uji Pengawas
- Masuk ke `/masuk?peran=pengawas` menggunakan kata sandi pengawas (`pengawas123`).
- Buka detail siswa dan pastikan seluruh nilai dan naskah terlihat jelas, namun tidak ada formulir nilai atau tombol hapus yang muncul.

---

## 🛡️ Catatan Keamanan dan Keterbatasan Sistem

### 1. Pembaca Dokumen Microsoft Word (Office Online Viewer)
Untuk pratinjau dokumen Microsoft Word (.doc), sistem menyediakan integrasi resmi *Microsoft Office Online Viewer* (`https://view.officeapps.live.com`).
> **Penting**: Dikarenakan viewer Word butuh URL publik, jadi siapa pun yang tahu URL sebuah file bisa membukanya. Namun, URL file dibuat menggunakan akhiran acak (*random suffix*) yang sangat panjang sehingga tidak dapat ditebak oleh pihak luar. Selalu sediakan tombol "Buka di tab baru" sebagai cadangan apabila jaringan sekolah memblokir akses ke domain Microsoft Office. Pada mode dokumen `.docx`, sistem menggunakan pembaca internal langsung di browser sehingga tidak memerlukan koneksi ke luar.

### 2. Pembatasan Percobaan Login (*Rate Limiting*)
Sistem secara otomatis membatasi percobaan login yang salah: jika terjadi 5 kali kegagalan memasukkan kata sandi dari satu alamat IP dalam kurun waktu 10 menit, sistem akan memblokir sementara percobaan login berikutnya selama 10 menit, serta memberikan jeda waktu 1 detik setiap kegagalan.
> **Keterbatasan Serverless**: Karena Vercel Serverless Functions berjalan secara dinamis di *cloud* dan tidak berbagi memori antar-server, pencatatan kegagalan ini disimpan di memori instans yang sedang aktif. Meskipun demikian, jeda 1 detik dan memori lokal tetap efektif mencegah serangan coba-coba otomatis (*brute-force* cepat). Pada server mandiri sekolah (Express.js), memori ini tersimpan konsisten di satu server aktif.

### 3. Kuota Gratis Vercel Blob (*Hobby Plan*)
Jika memilih menggunakan hosting Vercel, paket gratis (*Hobby Plan*) mencakup:
- **Penyimpanan Total**: Hingga 1 GB data.
- **Operasi Unggah / Tulis (*Simple Put*)**: Hingga 10.000 operasi per bulan.
- **Operasi Baca / Unduh (*Read*)**: Hingga 50.000 operasi per bulan.
- **Transfer Data (*Bandwidth*)**: Hingga 10 GB per bulan.
*(Pada server mandiri sekolah berbasis MySQL, batas penyimpanan hanya dibatasi oleh kapasitas harddisk server sekolah Anda sendiri tanpa kuota bulanan).*

---
&copy; 2026 SMK Bina Rahayu • Blog Pembelajaran Bahasa Indonesia • Pengampu: Bu Ulfa
