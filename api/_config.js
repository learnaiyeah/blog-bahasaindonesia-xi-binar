import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BAB_FILE = path.join(__dirname, '..', 'database', 'bab.json');

/**
 * Konfigurasi Kelas dan Bab Pembelajaran.
 * Daftar bab dapat diatur secara dinamis oleh Guru lewat dashboard.
 */
export const KELAS = ['XI-1', 'XI-2'];

const DEFAULT_BAB = ['Bab 1', 'Bab 2'];

export function getDaftarBab() {
  try {
    if (fs.existsSync(BAB_FILE)) {
      const data = JSON.parse(fs.readFileSync(BAB_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    // Gunakan default jika terjadi kendala membaca file
  }
  return [...DEFAULT_BAB];
}

export function saveDaftarBab(list) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Daftar bab tidak boleh kosong');
  }
  const clean = list.map(b => String(b).trim()).filter(Boolean);
  if (clean.length === 0) {
    throw new Error('Daftar bab tidak boleh kosong');
  }

  // Tulis ke file JSON lokal agar persisten
  try {
    const dir = path.dirname(BAB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BAB_FILE, JSON.stringify(clean, null, 2), 'utf8');
  } catch (err) {
    console.error('Gagal menulis database/bab.json:', err.message);
  }

  // Mutasi array BAB yang diekspor agar semua modul langsung mendapat pembaruan
  BAB.length = 0;
  BAB.push(...clean);
  return clean;
}

export const BAB = getDaftarBab();

export const MAX_NAMA_LENGTH = 60;
export const MAX_CATATAN_LENGTH = 500;
export const MAX_CATATAN_SISWA_LENGTH = 300;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
