-- ============================================================
-- SKEMA DATABASE APLIKASI PENGUMPULAN TUGAS SEKOLAH
-- Basis Data: MySQL / MariaDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS `tugas_sekolah`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `tugas_sekolah`;

-- 1. Tabel Utama: tugas
-- Menyimpan semua riwayat tugas dan revisi tugas siswa
CREATE TABLE IF NOT EXISTS `tugas` (
  `id` VARCHAR(36) NOT NULL,
  `nama` VARCHAR(100) NOT NULL,
  `kelas` VARCHAR(20) NOT NULL,
  `bab` VARCHAR(50) NOT NULL,
  `kunci_nama` VARCHAR(100) NOT NULL,
  `file_url` VARCHAR(255) NOT NULL,
  `file_nama` VARCHAR(255) NOT NULL,
  `file_tipe` VARCHAR(100) NOT NULL,
  `catatan_siswa` VARCHAR(300) DEFAULT '',
  `nilai` DECIMAL(5, 2) DEFAULT NULL,
  `catatan` VARCHAR(500) DEFAULT '',
  `dikirim_pada` DATETIME NOT NULL,
  `dinilai_pada` DATETIME DEFAULT NULL,
  `versi` INT NOT NULL DEFAULT 1,
  `revisi` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_siswa_bab` (`kelas`, `bab`, `kunci_nama`, `versi`),
  INDEX `idx_dikirim` (`dikirim_pada`),
  INDEX `idx_status_nilai` (`nilai`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1b. Tabel Pengaturan Sistem (Daftar Bab Dinamis)
CREATE TABLE IF NOT EXISTS `pengaturan` (
  `kunci` VARCHAR(50) NOT NULL,
  `nilai` TEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`kunci`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nilai awal daftar bab pembelajaran
INSERT IGNORE INTO `pengaturan` (`kunci`, `nilai`) VALUES
('bab', '["Bab 1", "Bab 2"]');

-- 2. Data Contoh Awal (Opsional untuk Uji Coba)
INSERT IGNORE INTO `tugas` (
  `id`, `nama`, `kelas`, `bab`, `kunci_nama`, `file_url`, `file_nama`, `file_tipe`,
  `catatan_siswa`, `nilai`, `catatan`, `dikirim_pada`, `dinilai_pada`, `versi`, `revisi`
) VALUES
(
  'a1b2c3d4-e5f6-4a5b-8c9d-111111111111',
  'Budi Santoso',
  'XI-1',
  'Bab 1',
  'budi_santoso',
  '/uploads/contoh-tugas-budi.pdf',
  'Tugas_Bab1_Budi.pdf',
  'application/pdf',
  'Mohon masukannya Bu Ulfa, terima kasih.',
  85.00,
  'Analisis masalah sangat baik. Pertahankan!',
  NOW() - INTERVAL 2 HOUR,
  NOW() - INTERVAL 1 HOUR,
  1,
  0
),
(
  'b2c3d4e5-f6a7-4b6c-9d0e-222222222222',
  'Siti Rahma',
  'XI-2',
  'Bab 2',
  'siti_rahma',
  '/uploads/contoh-tugas-siti.docx',
  'Laporan_Bab2_Siti.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'Sudah saya sesuaikan dengan petunjuk di Bab 2.',
  NULL,
  '',
  NOW() - INTERVAL 30 MINUTE,
  NULL,
  1,
  0
);
