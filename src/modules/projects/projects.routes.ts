import { Router } from 'express';
import {
  createProject,
  getMyProjects,
  getOpenProjects,
  getProject,
  updateProject,
  publishProject,
  getProjectRequests,
  assignSolver,
  updateProjectStatus,
  getAssignedProjects,
  reviewProject,
  deleteProject,
} from './projects.controller.js';
import { authenticateJWT, optionalAuth } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/role.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { createProjectSchema, updateProjectSchema, projectStatusSchema, reviewProjectSchema } from '../../validators/schemas.js';

const router = Router();

/**
 * @route   GET /projects/open
 * @desc    Get open projects (public - anyone can view)
 * @access  Public
 * IMPORTANT: This route must be defined BEFORE router.use(authenticateJWT)
 * to ensure it's matched before any parameterized routes like /:id
 */
router.get('/open', optionalAuth, getOpenProjects);

// All other project routes require authentication
// NOTE: /open route above is public and must come before this middleware
router.use(authenticateJWT);

/**
 * @route   GET /projects/my
 * @desc    Get buyer's own projects
 * @access  BUYER
 */
router.get('/my', authorizeRole('BUYER'), getMyProjects);

/**
 * @route   GET /projects/assigned
 * @desc    Get solver's assigned projects
 * @access  SOLVER
 */
router.get('/assigned', authorizeRole('SOLVER'), getAssignedProjects);

/**
 * @route   POST /projects
 * @desc    Create a new project
 * @access  BUYER
 */
router.post('/', authorizeRole('BUYER'), validateBody(createProjectSchema), createProject);

/**
 * @route   GET /projects/:id
 * @desc    Get project by ID (public for OPEN/REQUESTED projects)
 * @access  Public (for OPEN/REQUESTED), Authenticated (for others)
 */
router.get('/:id', optionalAuth, getProject);

/**
 * @route   PATCH /projects/:id
 * @desc    Update project (only in DRAFT)
 * @access  BUYER (owner)
 */
router.patch('/:id', authorizeRole('BUYER'), validateBody(updateProjectSchema), updateProject);

/**
 * @route   PATCH /projects/:id/publish
 * @desc    Publish project (DRAFT -> OPEN)
 * @access  BUYER (owner)
 */
router.patch('/:id/publish', authorizeRole('BUYER'), publishProject);

/**
 * @route   PATCH /projects/:id/status
 * @desc    Update project status (state machine enforced)
 * @access  BUYER or SOLVER (based on transition)
 */
router.patch('/:id/status', validateBody(projectStatusSchema), updateProjectStatus);

/**
 * @route   GET /projects/:id/requests
 * @desc    Get all requests for a project
 * @access  BUYER (owner)
 */
router.get('/:id/requests', authorizeRole('BUYER'), getProjectRequests);

/**
 * @route   POST /projects/:id/assign
 * @desc    Assign a solver to the project
 * @access  BUYER (owner)
 */
router.post('/:id/assign', authorizeRole('BUYER'), assignSolver);

/**
 * @route   POST /projects/:id/review
 * @desc    Review project (accept or reject with feedback)
 * @access  BUYER (owner)
 */
router.post('/:id/review', authorizeRole('BUYER'), validateBody(reviewProjectSchema), reviewProject);

/**
 * @route   DELETE /projects/:id
 * @desc    Delete project (BUYER can delete DRAFT only, ADMIN can delete any)
 * @access  BUYER (owner) or ADMIN
 */
router.delete('/:id', deleteProject);

export default router;
