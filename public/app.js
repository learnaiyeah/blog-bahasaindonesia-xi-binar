/**
 * Aplikasi Pengumpulan Tugas Siswa - Fungsi Bersama (Client-side)
 */

/**
 * Format tanggal ISO ke format Indonesia yang lengkap dan transparan hingga detik.
 * Contoh: 12 Nov 2026, 20:25:14 WIB
 * @param {string} isoString
 * @returns {string}
 */
export function formatTanggal(isoString) {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '-';

    const options = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };

    return new Intl.DateTimeFormat('id-ID', options).format(date) + ' WIB';
  } catch {
    return String(isoString);
  }
}

/**
 * Format waktu relatif untuk transparansi keterlambatan atau kecepatan kirim.
 * Contoh: "Baru saja", "5 menit yang lalu", "2 jam yang lalu"
 * @param {string|Date} isoString
 * @returns {string}
 */
export function formatWaktuRelatif(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 5) return 'Baru saja';
    if (diffSec < 60) return `${diffSec} detik yang lalu`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} menit yang lalu`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} hari yang lalu`;
    return '';
  } catch {
    return '';
  }
}

/**
 * Memeriksa status pengumpulan terhadap batas waktu (deadline) bab.
 * @param {string|Date} dikirimPada
 * @param {string|Date} deadline
 * @param {boolean} deadlineAktif
 * @returns {{ adaDeadline: boolean, lewatDeadline: boolean, selisihText: string, detailDeadline: string }}
 */
export function cekStatusDeadline(dikirimPada, deadline, deadlineAktif) {
  if (!deadlineAktif || !deadline) {
    return { adaDeadline: false, lewatDeadline: false, selisihText: '', detailDeadline: '' };
  }

  const tKirim = new Date(dikirimPada).getTime();
  const tDeadline = new Date(deadline).getTime();
  if (isNaN(tKirim) || isNaN(tDeadline)) {
    return { adaDeadline: false, lewatDeadline: false, selisihText: '', detailDeadline: '' };
  }

  const diffMs = tKirim - tDeadline;
  const detailDeadline = formatTanggal(deadline);

  if (diffMs > 0) {
    // Terlambat
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    let selisihText = '';
    if (diffDays > 0) {
      const sisaJam = diffHours % 24;
      selisihText = sisaJam > 0 ? `${diffDays} hari ${sisaJam} jam` : `${diffDays} hari`;
    } else if (diffHours > 0) {
      const sisaMenit = diffMin % 60;
      selisihText = sisaMenit > 0 ? `${diffHours} jam ${sisaMenit} mnt` : `${diffHours} jam`;
    } else if (diffMin > 0) {
      selisihText = `${diffMin} menit`;
    } else {
      selisihText = `${diffSec} detik`;
    }

    return {
      adaDeadline: true,
      lewatDeadline: true,
      selisihText: `Terlambat ${selisihText}`,
      detailDeadline
    };
  } else {
    // Tepat Waktu
    return {
      adaDeadline: true,
      lewatDeadline: false,
      selisihText: 'Tepat Waktu',
      detailDeadline
    };
  }
}

/**
 * Menghitung sisa waktu menuju batas waktu (deadline).
 * @param {string|Date} deadline
 * @returns {{ sudahLewat: boolean, text: string }}
 */
export function hitungSisaWaktuDeadline(deadline) {
  if (!deadline) return { sudahLewat: false, text: '' };
  const tDeadline = new Date(deadline).getTime();
  if (isNaN(tDeadline)) return { sudahLewat: false, text: '' };

  const now = Date.now();
  const diffMs = tDeadline - now;

  if (diffMs <= 0) {
    return { sudahLewat: true, text: 'Batas waktu telah berakhir' };
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const sisaJam = diffHours % 24;
    return {
      sudahLewat: false,
      text: sisaJam > 0 ? `Sisa waktu ${diffDays} hari ${sisaJam} jam lagi` : `Sisa waktu ${diffDays} hari lagi`
    };
  }
  if (diffHours > 0) {
    const sisaMenit = diffMin % 60;
    return {
      sudahLewat: false,
      text: sisaMenit > 0 ? `Sisa waktu ${diffHours} jam ${sisaMenit} menit lagi` : `Sisa waktu ${diffHours} jam lagi`
    };
  }
  if (diffMin > 0) {
    return { sudahLewat: false, text: `Sisa waktu ${diffMin} menit lagi` };
  }
  return { sudahLewat: false, text: `Sisa waktu ${diffSec} detik lagi` };
}

/**
 * Format ukuran file ke bentuk KB atau MB.
 * @param {number} bytes
 * @returns {string}
 */
export function formatUkuranFile(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes)) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Membuat elemen HTML dengan aman dan mengisi textContent untuk mencegah XSS.
 * @param {string} tag
 * @param {string} text
 * @param {string} [className]
 * @returns {HTMLElement}
 */
export function createSafeElement(tag, text, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text ?? '';
  return el;
}

/**
 * Mengunggah file ke backend server sekolah (POST /api/upload).
 * Mendukung pemantauan progres unggah secara real-time via XMLHttpRequest upload event.
 * @param {string} pathname
 * @param {File} file
 * @param {{ onProgress?: (percentage: number) => void }} options
 * @returns {Promise<{ url: string, downloadUrl: string, pathname: string, contentType: string }>}
 */
export async function uploadToBlobDirect(pathname, file, options = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    if (pathname) formData.append('pathname', pathname);

    xhr.open('POST', '/api/upload');

    // Pemantauan progress unggah real-time
    if (options.onProgress && xhr.upload) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const percent = Math.round((evt.loaded / evt.total) * 100);
          options.onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve({
            url: result.url,
            downloadUrl: result.url,
            pathname: result.pathname || pathname,
            contentType: result.fileTipe || file.type
          });
        } catch {
          reject(new Error('Respon server tidak valid saat mengunggah berkas'));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.error || `Gagal mengunggah file (${xhr.status})`));
        } catch {
          reject(new Error(`Gagal mengunggah file dengan status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Koneksi terputus saat mengunggah file ke server sekolah'));
    };

    xhr.send(formData);
  });
}

/**
 * Mengunduh array data ke bentuk CSV dan memicu dialog unduhan di browser.
 * Dilengkapi UTF-8 BOM agar terbaca sempurna di Microsoft Excel.
 * @param {string} filename
 * @param {Array<Array<string|number>>} rows
 */
export function exportToCSV(filename, rows) {
  const escapeCell = (cell) => {
    const val = cell === null || cell === undefined ? '' : String(cell);
    if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvContent = rows.map(r => r.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'rekap_tugas.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
