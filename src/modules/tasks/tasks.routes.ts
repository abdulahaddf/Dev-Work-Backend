import { Router } from 'express';
import {
  createTask,
  getProjectTasks,
  getTask,
  updateTask,
  updateTaskStatus,
  reviewTask,
  getMyTasks,
} from './tasks.controller.js';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/role.middleware.js';
import { validateBody } from '../../middleware/validate.middleware.js';
import { createTaskSchema, updateTaskSchema, taskStatusSchema, reviewSubmissionSchema } from '../../validators/schemas.js';

const router = Router();

// All task routes require authentication
router.use(authenticateJWT);

/**
 * @route   GET /tasks/my
 * @desc    Get solver's tasks across all projects
 * @access  SOLVER
 */
router.get('/my', authorizeRole('SOLVER'), getMyTasks);

/**
 * @route   GET /tasks/project/:projectId
 * @desc    Get all tasks for a project
 * @access  BUYER, SOLVER, ADMIN (with access control)
 */
router.get('/project/:projectId', getProjectTasks);

/**
 * @route   POST /tasks
 * @desc    Create a new task
 * @access  SOLVER (assigned to project)
 */
router.post('/', authorizeRole('SOLVER'), validateBody(createTaskSchema), createTask);

/**
 * @route   GET /tasks/:id
 * @desc    Get single task by ID
 * @access  BUYER, SOLVER, ADMIN (with access control)
 */
router.get('/:id', getTask);

/**
 * @route   PATCH /tasks/:id
 * @desc    Update task details
 * @access  SOLVER (task owner)
 */
router.patch('/:id', authorizeRole('SOLVER'), validateBody(updateTaskSchema), updateTask);

/**
 * @route   PATCH /tasks/:id/status
 * @desc    Update task status (state machine enforced)
 * @access  SOLVER or BUYER (based on transition)
 */
router.patch('/:id/status', validateBody(taskStatusSchema), updateTaskStatus);

/**
 * @route   POST /tasks/:id/review
 * @desc    Review task submission (accept/reject)
 * @access  BUYER
 */
router.post('/:id/review', authorizeRole('BUYER'), validateBody(reviewSubmissionSchema), reviewTask);

export default router;
