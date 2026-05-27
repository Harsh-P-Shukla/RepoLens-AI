import multer from 'multer';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    const allowed = ['application/zip', 'application/x-zip-compressed'];
    callback(null, allowed.includes(file.mimetype));
  }
});

