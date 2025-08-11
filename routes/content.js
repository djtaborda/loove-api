import { Router } from 'express';
import { listPrefixes, listObjects, isAudio, signedGetUrl } from '../lib/s3.js';

const router = Router();

/**
 * Lista as pastas (prefixes) do bucket raiz.
 */
router.get('/folders', async (_req, res) => {
  try {
    const items = await listPrefixes('');
    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ error: e.message || 'error' });
  }
});

/**
 * Lista objetos dentro de um prefixo (pasta).
 * ?prefix=nome-da-pasta/
 */
router.get('/objects', async (req, res) => {
  const { prefix = '' } = req.query || {};
  try {
    const items = await listObjects(prefix);
    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ error: e.message || 'error' });
  }
});

/**
 * Assina URL GET para tocar um arquivo de áudio.
 * ?key=caminho/no/bucket.mp3
 */
router.get('/sign', async (req, res) => {
  const { key } = req.query || {};
  if (!key) return res.status(400).json({ error: 'missing key' });
  try {
    const url = await signedGetUrl(key);
    res.json({ ok: true, url });
  } catch (e) {
    res.status(500).json({ error: e.message || 'error' });
  }
});

export default router;
