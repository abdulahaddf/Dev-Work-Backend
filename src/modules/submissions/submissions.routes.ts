import { Router, Request, Response, NextFunction } from 'express';
import {
  createSubmission,
  getTaskSubmissions,
  downloadSubmission,
  deleteSubmission,
} from './submissions.controller.js';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/role.middleware.js';
import { upload } from '../../utils/upload.js';

const router = Router();

// All submission routes require authentication
router.use(authenticateJWT);

// Multer error handling middleware
const handleUploadError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof Error) {
    if (err.message === 'Only ZIP files are allowed') {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    if (err.message.includes('File too large')) {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds maximum limit (50MB)',
      });
    }
  }
  next(err);
};

/**
 * @route   POST /submissions/task/:taskId
 * @desc    Upload a submission for a task
 * @access  SOLVER (assigned to project)
 */
router.post(
  '/task/:taskId',
  authorizeRole('SOLVER'),
  upload.single('file'),
  handleUploadError,
  createSubmission
);

/**
 * @route   GET /submissions/task/:taskId
 * @desc    Get all submissions for a task
 * @access  BUYER, SOLVER, ADMIN (with access control)
 */
router.get('/task/:taskId', getTaskSubmissions);

/**
 * @route   GET /submissions/:id/download
 * @desc    Download a submission file
 * @access  BUYER, SOLVER, ADMIN (with access control)
 */
router.get('/:id/download', downloadSubmission);

/**
 * @route   DELETE /submissions/:id
 * @desc    Delete a submission
 * @access  SOLVER (owner)
 */
router.delete('/:id', authorizeRole('SOLVER'), deleteSubmission);

export default router;
