import { Router } from 'express';
import { getConversations, getOrCreateConversation, getMessages, getAdminId } from './chat.controller.js';
import { authenticateJWT } from '../../middleware/auth.middleware.js';

const router = Router();

// All chat routes require authentication
router.use(authenticateJWT);

/**
 * @route   GET /api/chat/conversations
 * @desc    Get current user's conversations
 * @access  Private
 */
router.get('/conversations', getConversations);

/**
 * @route   POST /api/chat/conversations
 * @desc    Get or create a 1-on-1 conversation
 * @access  Private
 */
router.post('/conversations', getOrCreateConversation);

/**
 * @route   GET /api/chat/admin-id
 * @desc    Get an admin ID to start a help chat
 * @access  Private
 */
router.get('/admin-id', getAdminId);

/**
 * @route   GET /api/chat/conversations/:id/messages
 * @desc    Get message history for a conversation
 * @access  Private
 */
router.get('/conversations/:id/messages', getMessages);

export default router;
