import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { supabase, SUPABASE_BUCKET } from '../lib/supabase.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Configure storage - use memory storage to handle buffer
const storage = multer.memoryStorage();

// File filter - only allow ZIP files
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-zip',
    'multipart/x-zip',
    'application/octet-stream', // Some zips show up as octet-stream
  ];
  
  const allowedExtensions = ['.zip'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Basic mime check + extension check
  if ((allowedMimes.includes(file.mimetype) || file.mimetype.includes('zip')) && allowedExtensions.includes(ext)) {
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

interface UploadResult {
  path: string;
  publicUrl?: string;
  downloadUrl?: string; // Signed URL if needed immediately
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  file: Express.Multer.File, 
  projectId: string, 
  taskId: string
): Promise<UploadResult> {
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
  const ext = path.extname(file.originalname);
  const filename = `submission-${uniqueSuffix}${ext}`;
  const filePath = `${projectId}/${taskId}/${filename}`;

  console.log('[Upload Debug] Bucket:', SUPABASE_BUCKET);
  console.log('[Upload Debug] FilePath:', filePath);
  console.log('[Upload Debug] Size:', file.size);
  console.log('[Upload Debug] MimeType:', file.mimetype);

  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    console.error('[Upload Debug] Supabase error detail:', JSON.stringify(error, null, 2));
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  return {
    path: data.path,
  };
}

/**
 * Delete a file from Supabase Storage
 */
export function deleteFile(filePath: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const { error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .remove([filePath]);
      
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Get a signed URL for temporary access
 */
export async function getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    return null;
  }
  return data.signedUrl;
}
