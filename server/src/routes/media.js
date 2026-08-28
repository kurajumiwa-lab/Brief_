// MEDIA ROUTES — provider status, editorial media library, and real uploads.
//
// Public: report whether an image provider is configured (honest, never
// implied). Editorial: record/approve a category image for the fallback chain.
// Uploads: accept an actual image FILE, store it, and serve its bytes back.
import fs from 'node:fs';
import multer from 'multer';
import { requireAuth } from './helpers.js';
import { requireFeature } from '../features.js';
import * as media from '../domain/media.js';
import * as upload from '../domain/upload.js';

export function register(app) {
  app.use('/api/media', requireFeature('media'));

  /** Provider status: which image providers are configured (usually none). */
  app.get('/api/media/status', (_req, res) => {
    res.json({ media: media.providerStatus(), uploads: upload.storageStatus() });
  });

  /** Record a category/editorial image (editor-only; the route gates auth). */
  app.post('/api/admin/media', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      res.status(201).json({
        image: media.recordMediaLibraryImage({
          kind: req.body?.kind,
          key: req.body?.key,
          url: req.body?.url,
          alt: req.body?.alt ?? null,
          attribution: req.body?.attribution ?? null,
          status: req.body?.status ?? 'draft'
        })
      });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  // -------------------------------------------------------------------------
  // REAL FILE UPLOADS
  //
  // `memoryStorage`, not disk: the domain sniffs the magic bytes before
  // anything is written, so nothing lands on disk until it is known to be an
  // image. The cap is enforced TWICE — here on the wire (multer aborts an
  // oversized body) and again in the domain (defence in depth, and it is the
  // domain that has to answer with a reason a person can act on).
  // -------------------------------------------------------------------------
  const acceptOneImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: upload.maxBytes(), files: 1, fields: 8, parts: 9 }
  }).single('file');

  app.post('/api/media/upload', (req, res) => {
    if (!requireAuth(req, res)) return;
    acceptOneImage(req, res, (err) => {
      if (err) {
        // Multer's own refusals, translated into the same shape the domain
        // uses. An oversized body is cut off on the wire, never stored.
        const tooBig = err?.code === 'LIMIT_FILE_SIZE';
        return res.status(tooBig ? 413 : 400).json({
          error: tooBig
            ? `that image is larger than the ${(upload.maxBytes() / 1048576).toFixed(0)} MB limit`
            : String(err?.message ?? 'the upload could not be read'),
          code: tooBig ? 'file_too_large' : 'upload_unreadable'
        });
      }
      if (!req.file) {
        return res.status(400).json({
          error: 'no file was received; attach the image as the "file" field',
          code: 'no_file'
        });
      }
      const result = upload.saveUpload({
        bytes: req.file.buffer,
        ownerId: req.auth?.userId ?? null,
        originalName: req.file.originalname,
        alt: req.body?.alt
      });
      if (!result.ok) {
        return res.status(result.status).json({
          error: result.error,
          code: result.code,
          ...(result.allowed ? { allowed: result.allowed } : {}),
          ...(result.limit ? { limit: result.limit } : {})
        });
      }
      res.status(result.duplicate ? 200 : 201).json({
        upload: result.upload,
        duplicate: Boolean(result.duplicate)
      });
    });
  });

  /** The caller's own uploads. */
  app.get('/api/media/mine', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json({ uploads: upload.listUploads(req.auth.userId) });
  });

  /** Remove one of your own uploads, bytes and all. */
  app.delete('/api/media/:id', (req, res) => {
    if (!requireAuth(req, res)) return;
    const result = upload.deleteUpload(req.params.id, req.auth.userId);
    if (!result.ok) return res.status(result.status).json({ error: result.error, code: result.code });
    res.json({ removed: true });
  });

  /**
   * The bytes themselves.
   *
   * Readable WITHOUT a session, because a published story, banner or feed card
   * has to render for someone who has not signed in. The id is a random,
   * unlisted handle, and nothing enumerates these — the trade-off is stated
   * rather than hidden.
   */
  app.get('/api/media/file/:id', (req, res) => {
    const result = upload.readFile(req.params.id);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, code: result.code });
    }
    const ext = result.row.mimeType.split('/')[1] ?? 'bin';
    res.setHeader('content-type', result.row.mimeType);
    res.setHeader('content-length', String(result.size));
    // The bytes behind an id never change, so a reader can cache hard.
    res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    // An image is served as an image: never sniffed into something else, and
    // never allowed to run anything.
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('content-security-policy', "default-src 'none'; sandbox");
    res.setHeader('content-disposition', `inline; filename="brief-${result.row.id}.${ext}"`);
    const stream = fs.createReadStream(result.file);
    stream.on('error', () => {
      // Headers are already sent, so the honest answer is to end the response
      // rather than write an error body that would corrupt the image.
      try { res.destroy(); } catch {}
    });
    stream.pipe(res);
  });
}
