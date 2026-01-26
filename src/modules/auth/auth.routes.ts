import { Router } from 'express';
import { register, login, getCurrentUser } from './auth.controller.js';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { registerSchema, loginSchema } from '../../validators/schemas.js';

const router = Router();

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validateBody(registerSchema), register);

/**
 * @route   POST /auth/login
 * @desc    Login user and get token
 * @access  Public
 */
router.post('/login', validateBody(loginSchema), login);

/**
 * @route   GET /auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticateJWT, getCurrentUser);

export default router;
