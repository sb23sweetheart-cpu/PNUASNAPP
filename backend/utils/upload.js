// utils/upload.js — Smart upload: Cloudinary if configured, local disk otherwise
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const MB = 1024 * 1024;

const CLOUDINARY_READY =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

let cloudinary = null;

// ── CLOUDINARY MODE ───────────────────────────────────────────────
if (CLOUDINARY_READY) {
  try {
    const cloudinaryPkg          = require('cloudinary').v2;
    const { CloudinaryStorage }  = require('multer-storage-cloudinary');

    cloudinaryPkg.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    cloudinary = cloudinaryPkg;

    const workStorage = new CloudinaryStorage({
      cloudinary,
      params: async () => ({
        folder:          'pnu-asn/work',
        resource_type:   'auto',
        use_filename:    true,
        unique_filename: true,
      }),
    });

    const photoStorage = new CloudinaryStorage({
      cloudinary,
      params: {
        folder:          'pnu-asn/photos',
        resource_type:   'image',
        transformation:  [{ width: 400, height: 400, crop: 'fill' }],
      },
    });

    const fileFilter = (req, file, cb) => {
      const allowed = [
        'image/jpeg','image/png','image/gif','image/webp',
        'video/mp4','video/quicktime','video/webm',
        'application/pdf','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
      ];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error('File type not supported'), false);
    };

    module.exports.uploadWork = multer({
      storage:    workStorage,
      fileFilter,
      limits: { fileSize: 100 * MB, files: 10 },
    });

    module.exports.uploadPhoto = multer({
      storage:    photoStorage,
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Images only'), false);
      },
      limits: { fileSize: 5 * MB },
    });

    console.log('✅ Cloudinary storage active');
  } catch (e) {
    console.error('⚠️  Cloudinary init failed, falling back to local disk:', e.message);
    setupLocalDisk();
  }
} else {
  console.log('⚠️  Cloudinary not configured — using local disk storage');
  setupLocalDisk();
}

// ── LOCAL DISK FALLBACK ───────────────────────────────────────────
function setupLocalDisk() {
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const workStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename:    (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    const allowed = [
      'image/jpeg','image/png','image/gif','image/webp',
      'video/mp4','video/quicktime','video/webm',
      'application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not supported'), false);
  };

  module.exports.uploadWork = multer({
    storage:    workStorage,
    fileFilter,
    limits: { fileSize: 100 * MB, files: 10 },
  });

  module.exports.uploadPhoto = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename:    (req, file, cb) => cb(null, `photo_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
    }),
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Images only'), false);
    },
    limits: { fileSize: 5 * MB },
  });
}

// ── HELPERS ───────────────────────────────────────────────────────
// Normalise file info so route code works the same whether Cloudinary or disk
function normaliseFile(file) {
  if (!file) return null;
  return {
    originalname: file.originalname,
    // Cloudinary gives file.path as the URL; disk gives file.path as local path
    url:      file.path,
    // Cloudinary gives file.filename as public_id; disk uses generated filename
    publicId: file.filename || null,
    mimetype: file.mimetype,
    size:     file.size,
  };
}

module.exports.normaliseFile = normaliseFile;
module.exports.cloudinary    = cloudinary; // null if not configured
module.exports.isCloudinary  = !!cloudinary;
