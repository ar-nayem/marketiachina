const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Accepted mimetypes -> simple type label.
const MIME_TYPE_MAP = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
};

// The stored file's extension is derived ONLY from this fixed map, never from
// the client-supplied original filename - otherwise a request can declare
// Content-Type: image/png (passing fileFilter) while naming the file
// "x.html", which express.static would then serve as text/html and execute
// same-origin in an admin's browser (stored XSS).
const EXT_FOR_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

function mediaTypeFor(mimetype) {
  return MIME_TYPE_MAP[mimetype] || null;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // fileFilter (below) has already rejected anything not in EXT_FOR_MIME by
    // the time this runs, so the fallback is unreachable in practice.
    const ext = EXT_FOR_MIME[file.mimetype] || '.bin';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!mediaTypeFor(file.mimetype)) {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
    return;
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per file
    files: 10, // max files per request
  },
});

module.exports = { upload, UPLOAD_DIR, mediaTypeFor };
