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

/**
 * Mengambil daftar bab lengkap beserta konfigurasi deadline.
 * Mendukung format string lama ['Bab 1', 'Bab 2'] maupun objek baru.
 * @returns {Array<{ judul: string, deadlineAktif: boolean, deadline: string|null }>}
 */
export function getDaftarBabDetail() {
  try {
    if (fs.existsSync(BAB_FILE)) {
      const data = JSON.parse(fs.readFileSync(BAB_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        return data.map(item => {
          if (typeof item === 'string') {
            return {
              judul: item.trim(),
              deadlineAktif: false,
              deadline: null
            };
          }
          return {
            judul: (item.judul || '').trim(),
            deadlineAktif: Boolean(item.deadlineAktif),
            deadline: (item.deadlineAktif && item.deadline) ? String(item.deadline).trim() : null
          };
        }).filter(b => b.judul.length > 0);
      }
    }
  } catch (err) {
    // Gunakan default jika terjadi kendala membaca file
  }
  return DEFAULT_BAB.map(b => ({
    judul: b,
    deadlineAktif: false,
    deadline: null
  }));
}

/**
 * Mengambil hanya daftar judul bab (array of strings) untuk kompatibilitas penuh.
 * @returns {string[]}
 */
export function getDaftarBab() {
  return getDaftarBabDetail().map(b => b.judul);
}

/**
 * Menyimpan konfigurasi bab dan deadline ke database/bab.json.
 * Menerima array of strings maupun array of objects.
 * @param {Array<string|{ judul: string, deadlineAktif?: boolean, deadline?: string|null }>} list
 * @returns {string[]} Daftar judul bab yang tersimpan
 */
export function saveDaftarBab(list) {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Daftar bab tidak boleh kosong');
  }

  // Peta referensi deadline sebelumnya jika list berupa string
  const existingDetail = getDaftarBabDetail();
  const existingMap = new Map();
  for (const item of existingDetail) {
    existingMap.set(item.judul.toLowerCase(), item);
  }

  const cleanDetail = [];
  for (const item of list) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const prev = existingMap.get(trimmed.toLowerCase());
      cleanDetail.push({
        judul: trimmed,
        deadlineAktif: prev ? prev.deadlineAktif : false,
        deadline: (prev && prev.deadlineAktif) ? prev.deadline : null
      });
    } else if (item && typeof item === 'object') {
      const judul = String(item.judul || '').trim();
      if (!judul) continue;
      const deadlineAktif = Boolean(item.deadlineAktif);
      cleanDetail.push({
        judul,
        deadlineAktif,
        deadline: (deadlineAktif && item.deadline) ? String(item.deadline).trim() : null
      });
    }
  }

  if (cleanDetail.length === 0) {
    throw new Error('Daftar bab tidak boleh kosong');
  }

  // Tulis ke file JSON lokal agar persisten
  try {
    const dir = path.dirname(BAB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BAB_FILE, JSON.stringify(cleanDetail, null, 2), 'utf8');
  } catch (err) {
    console.error('Gagal menulis database/bab.json:', err.message);
  }

  // Mutasi array BAB yang diekspor agar semua modul langsung mendapat pembaruan
  const cleanTitles = cleanDetail.map(b => b.judul);
  BAB.length = 0;
  BAB.push(...cleanTitles);

  return cleanTitles;
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
