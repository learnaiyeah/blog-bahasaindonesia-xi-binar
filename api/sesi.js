import { getSession } from './_auth.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metode tidak diizinkan' });
  }

  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Belum masuk atau sesi telah kedaluwarsa' });
  }

  return res.status(200).json({
    peran: session.peran
  });
}
