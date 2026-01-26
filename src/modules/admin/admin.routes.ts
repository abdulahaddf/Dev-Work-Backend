import { Router } from 'express';
import {
  assignRole,
  removeRole,
  getAllUsers,
  getAllProjects,
  getAllRoles,
} from './admin.controller.js';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/role.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { assignRoleSchema, removeRoleSchema } from '../../validators/schemas.js';

const router = Router();

// All admin routes require authentication and ADMIN role
router.use(authenticateJWT);
router.use(authorizeRole('ADMIN'));

/**
 * @route   POST /admin/assign-role
 * @desc    Assign a role to a user
 * @access  Admin only
 */
router.post('/assign-role', validateBody(assignRoleSchema), assignRole);

/**
 * @route   POST /admin/remove-role
 * @desc    Remove a role from a user
 * @access  Admin only
 */
router.post('/remove-role', validateBody(removeRoleSchema), removeRole);

/**
 * @route   GET /admin/users
 * @desc    Get all users with pagination and search
 * @access  Admin only
 */
router.get('/users', getAllUsers);

/**
 * @route   GET /admin/projects
 * @desc    Get all projects with pagination
 * @access  Admin only
 */
router.get('/projects', getAllProjects);

/**
 * @route   GET /admin/roles
 * @desc    Get all available roles
 * @access  Admin only
 */
router.get('/roles', getAllRoles);

export default router;
