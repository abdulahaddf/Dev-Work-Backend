import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '52428800'); // 50MB default

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const projectId = req.params.projectId || 'unknown';
    const taskId = req.params.taskId || req.params.id || 'unknown';
    
    const uploadPath = path.join(UPLOAD_DIR, projectId, taskId);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `submission-${uniqueSuffix}${ext}`);
  },
});

// File filter - only allow ZIP files
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-zip',
    'multipart/x-zip',
  ];
  
  const allowedExtensions = ['.zip'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only ZIP files are allowed'));
  }
};

// Create multer upload instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// Helper to delete a file
export function deleteFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Helper to get file info
export function getFileInfo(filePath: string): Promise<fs.Stats | null> {
  return new Promise((resolve) => {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        resolve(null);
      } else {
        resolve(stats);
      }
    });
  });
}
