import { Router } from 'express';
import { 
  createRoleRequest, 
  getMyRoleRequests, 
  getAllRoleRequests, 
  reviewRoleRequest 
} from './role-requests.controller.js';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createRoleRequestSchema, reviewRoleRequestSchema } from '../../validators/schemas.js';

const router = Router();

router.use(authenticateJWT);

/**
 * @route   POST /api/role-requests
 * @desc    Submit a role request
 * @access  Private
 */
router.post(
  '/',
  validate(createRoleRequestSchema),
  createRoleRequest
);

/**
 * @route   GET /api/role-requests/my
 * @desc    Get my role requests
 * @access  Private
 */
router.get('/my', getMyRoleRequests);

/**
 * @route   GET /api/role-requests
 * @desc    Get all role requests (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/',
  authorizeRoles('ADMIN'),
  getAllRoleRequests
);

/**
 * @route   PATCH /api/role-requests/:id/review
 * @desc    Review a role request (Admin only)
 * @access  Private (Admin)
 */
router.patch(
  '/:id/review',
  authorizeRoles('ADMIN'),
  validate(reviewRoleRequestSchema),
  reviewRoleRequest
);

export default router;
