import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { getDaftarBab, saveDaftarBab } from './api/_config.js';
import { savePassword } from './api/_auth.js';
dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tugas_sekolah',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

let pool = null;
let isConnected = false;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

/**
 * Inisialisasi koneksi MySQL dan buat tabel otomatis jika belum ada.
 */
export async function initDatabase() {
  try {
    // 1. Coba koneksi ke server MySQL tanpa memilih database dulu (untuk CREATE DATABASE IF NOT EXISTS)
    const adminConn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await adminConn.end();

    // 2. Hubungkan pool ke database
    const currentPool = getPool();
    const conn = await currentPool.getConnection();
    isConnected = true;
    console.log(`[MySQL] Berhasil terhubung ke database "${dbConfig.database}" di ${dbConfig.host}:${dbConfig.port}`);

    // 3. Buat tabel tugas jika belum ada
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`tugas\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`nama\` VARCHAR(100) NOT NULL,
        \`kelas\` VARCHAR(20) NOT NULL,
        \`bab\` VARCHAR(50) NOT NULL,
        \`kunci_nama\` VARCHAR(100) NOT NULL,
        \`file_url\` VARCHAR(255) NOT NULL,
        \`file_nama\` VARCHAR(255) NOT NULL,
        \`file_tipe\` VARCHAR(100) NOT NULL,
        \`catatan_siswa\` VARCHAR(300) DEFAULT '',
        \`nilai\` DECIMAL(5, 2) DEFAULT NULL,
        \`catatan\` VARCHAR(500) DEFAULT '',
        \`dikirim_pada\` DATETIME NOT NULL,
        \`dinilai_pada\` DATETIME DEFAULT NULL,
        \`versi\` INT NOT NULL DEFAULT 1,
        \`revisi\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_siswa_bab\` (\`kelas\`, \`bab\`, \`kunci_nama\`, \`versi\`),
        INDEX \`idx_dikirim\` (\`dikirim_pada\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Buat tabel pengaturan jika belum ada
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`pengaturan\` (
        \`kunci\` VARCHAR(50) NOT NULL,
        \`nilai\` TEXT NOT NULL,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`kunci\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Sinkronisasi data bab dari database jika ada
    try {
      const [rows] = await conn.query('SELECT `nilai` FROM `pengaturan` WHERE `kunci` = ?', ['bab']);
      if (rows && rows.length > 0 && rows[0].nilai) {
        const savedBab = JSON.parse(rows[0].nilai);
        if (Array.isArray(savedBab) && savedBab.length > 0) {
          saveDaftarBab(savedBab);
        }
      } else {
        // Simpan default ke DB
        const currentBab = getDaftarBab();
        await conn.query(
          'INSERT INTO `pengaturan` (`kunci`, `nilai`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `nilai` = ?',
          ['bab', JSON.stringify(currentBab), JSON.stringify(currentBab)]
        );
      }
    } catch (e) {
      console.warn('[MySQL Warning] Sinkronisasi pengaturan bab:', e.message);
    }

    // Sinkronisasi kata sandi dari database jika ada
    try {
      const [guruRows] = await conn.query('SELECT `nilai` FROM `pengaturan` WHERE `kunci` = ?', ['password_guru']);
      if (guruRows && guruRows.length > 0 && guruRows[0].nilai) {
        savePassword('guru', guruRows[0].nilai);
      }
      const [pengawasRows] = await conn.query('SELECT `nilai` FROM `pengaturan` WHERE `kunci` = ?', ['password_pengawas']);
      if (pengawasRows && pengawasRows.length > 0 && pengawasRows[0].nilai) {
        savePassword('pengawas', pengawasRows[0].nilai);
      }
    } catch (e) {
      console.warn('[MySQL Warning] Sinkronisasi pengaturan kata sandi:', e.message);
    }

    conn.release();
    return true;
  } catch (err) {
    isConnected = false;
    console.warn(`[MySQL Warning] Tidak dapat terhubung ke MySQL (${err.code || err.message}).`);
    console.warn(`[MySQL Info] Pastikan MySQL/MariaDB aktif dan konfigurasi DB_* di file .env sudah sesuai.`);
    return false;
  }
}

export function isDbConnected() {
  return isConnected;
}

export default {
  getPool,
  initDatabase,
  isDbConnected
};
