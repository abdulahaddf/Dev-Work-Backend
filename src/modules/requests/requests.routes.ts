import { Router } from 'express';
import { createRequest, getMyRequests, withdrawRequest } from './requests.controller.js';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { authorizeRole } from '../../middleware/role.middleware.js';

const router = Router();

// All request routes require authentication and SOLVER role
router.use(authenticateJWT);
router.use(authorizeRole('SOLVER'));

/**
 * @route   POST /requests
 * @desc    Create a new project request
 * @access  SOLVER
 */
router.post('/', createRequest);

/**
 * @route   GET /requests/my
 * @desc    Get solver's own requests
 * @access  SOLVER
 */
router.get('/my', getMyRequests);

/**
 * @route   DELETE /requests/:id
 * @desc    Withdraw a pending request
 * @access  SOLVER
 */
router.delete('/:id', withdrawRequest);

export default router;
