import { Router } from 'express';
import { getUserProfile, updateMyProfile } from './users.controller.js';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { updateProfileSchema } from '../../validators/schemas.js';

const router = Router();

/**
 * @route   GET /users/:id/profile
 * @desc    Get user's public profile
 * @access  Public
 */
router.get('/:id/profile', getUserProfile);

/**
 * @route   PATCH /users/profile
 * @desc    Update authenticated user's profile
 * @access  Private
 */
router.patch('/profile', authenticateJWT, validateBody(updateProfileSchema), updateMyProfile);

export default router;
