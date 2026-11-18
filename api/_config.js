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

let cachedBabDetail = null;

/**
 * Normalisasi format data bab (baik array string maupun array objek)
 * @param {Array<string|{ judul: string, deadlineAktif?: boolean, deadline?: string|null }>} list
 * @returns {Array<{ judul: string, deadlineAktif: boolean, deadline: string|null }>}
 */
export function normalizeBabList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(item => {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      return trimmed ? {
        judul: trimmed,
        deadlineAktif: false,
        deadline: null
      } : null;
    }
    if (item && typeof item === 'object') {
      const judul = String(item.judul || '').trim();
      if (!judul) return null;
      const deadlineAktif = Boolean(item.deadlineAktif);
      return {
        judul,
        deadlineAktif,
        deadline: (deadlineAktif && item.deadline) ? String(item.deadline).trim() : null
      };
    }
    return null;
  }).filter(Boolean);
}

function loadBabFromFile() {
  try {
    if (fs.existsSync(BAB_FILE)) {
      const data = JSON.parse(fs.readFileSync(BAB_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        const normalized = normalizeBabList(data);
        if (normalized.length > 0) return normalized;
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
 * Mengambil daftar bab lengkap beserta konfigurasi deadline.
 * Mendukung format string lama ['Bab 1', 'Bab 2'] maupun objek baru.
 * @returns {Array<{ judul: string, deadlineAktif: boolean, deadline: string|null }>}
 */
export function getDaftarBabDetail() {
  if (!cachedBabDetail || cachedBabDetail.length === 0) {
    cachedBabDetail = loadBabFromFile();
  }
  return cachedBabDetail.map(b => ({ ...b }));
}

/**
 * Mengambil hanya daftar judul bab (array of strings) untuk kompatibilitas penuh.
 * @returns {string[]}
 */
export function getDaftarBab() {
  return getDaftarBabDetail().map(b => b.judul);
}

/**
 * Menyinkronkan daftar bab dari Vercel Blob jika token tersedia.
 */
export async function syncBabFromBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { list } = await import('@vercel/blob');
    const res = await list({ prefix: 'pengaturan/bab.json' });
    const targetBlob = res.blobs?.find(b => b.pathname === 'pengaturan/bab.json' || b.pathname.endsWith('bab.json'));
    if (targetBlob && targetBlob.url) {
      const cacheBustUrl = `${targetBlob.url}?t=${Date.now()}_${Math.random()}`;
      const resp = await fetch(cacheBustUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          const normalized = normalizeBabList(data);
          if (normalized.length > 0) {
            cachedBabDetail = normalized;
            const cleanTitles = normalized.map(b => b.judul);
            BAB.length = 0;
            BAB.push(...cleanTitles);
            return normalized;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Blob Warning] Gagal membaca pengaturan bab dari Vercel Blob:', err.message);
  }
  return null;
}

/**
 * Menyimpan konfigurasi bab dan deadline ke database/bab.json dan Vercel Blob.
 * Menerima array of strings maupun array of objects.
 * @param {Array<string|{ judul: string, deadlineAktif?: boolean, deadline?: string|null }>} list
 * @returns {Promise<string[]>} Daftar judul bab yang tersimpan
 */
export async function saveDaftarBab(list) {
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

  // Perbarui cache memori lokal
  cachedBabDetail = cleanDetail.map(b => ({ ...b }));

  // Mutasi array BAB yang diekspor agar semua modul langsung mendapat pembaruan
  const cleanTitles = cleanDetail.map(b => b.judul);
  BAB.length = 0;
  BAB.push(...cleanTitles);

  // Tulis ke file JSON lokal jika memungkinkan
  try {
    const dir = path.dirname(BAB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BAB_FILE, JSON.stringify(cleanDetail, null, 2), 'utf8');
  } catch (err) {
    // Pada filesystem read-only (Vercel), abaikan error ini
  }

  // Jika token Vercel Blob tersedia, simpan juga ke Vercel Blob
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import('@vercel/blob');
      await put('pengaturan/bab.json', JSON.stringify(cleanDetail, null, 2), {
        access: 'public',
        contentType: 'application/json',
        allowOverwrite: true,
        addRandomSuffix: false,
        cacheControlMaxAge: 0
      });
    } catch (err) {
      console.warn('[Blob Warning] Gagal menyimpan pengaturan bab ke Vercel Blob:', err.message);
    }
  }

  return cleanTitles;
}

/**
 * Mereset store bab ke kondisi awal (untuk unit test)
 */
export function resetBabStore() {
  cachedBabDetail = null;
  BAB.length = 0;
  BAB.push(...getDaftarBab());
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
