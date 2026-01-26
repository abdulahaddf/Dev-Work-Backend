import { Router } from 'express';

// Import route modules
import authRoutes from './modules/auth/auth.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import projectRoutes from './modules/projects/projects.routes.js';
import requestRoutes from './modules/requests/requests.routes.js';
import taskRoutes from './modules/tasks/tasks.routes.js';
import submissionRoutes from './modules/submissions/submissions.routes.js';

const router = Router();

/**
 * API Routes
 * 
 * @route /api/auth     - Authentication (register, login, me)
 * @route /api/admin    - Admin operations (role management, users)
 * @route /api/projects - Project operations (CRUD, requests, assignment)
 * @route /api/requests - Solver project requests
 * @route /api/tasks    - Task operations (CRUD, status)
 * @route /api/submissions - File submissions (upload, download)
 */

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/projects', projectRoutes);
router.use('/requests', requestRoutes);
router.use('/tasks', taskRoutes);
router.use('/submissions', submissionRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'DevWork API',
    version: '1.0.0',
    description: 'Role-Based Project Marketplace API',
    endpoints: {
      auth: {
        'POST /auth/register': 'Register a new user',
        'POST /auth/login': 'Login and get JWT token',
        'GET /auth/me': 'Get current user profile',
      },
      admin: {
        'POST /admin/assign-role': 'Assign role to user (ADMIN only)',
        'POST /admin/remove-role': 'Remove role from user (ADMIN only)',
        'GET /admin/users': 'List all users (ADMIN only)',
        'GET /admin/projects': 'List all projects (ADMIN only)',
        'GET /admin/roles': 'List all roles (ADMIN only)',
      },
      projects: {
        'POST /projects': 'Create project (BUYER)',
        'GET /projects/my': 'Get my projects (BUYER)',
        'GET /projects/open': 'Get open projects (SOLVER)',
        'GET /projects/assigned': 'Get assigned projects (SOLVER)',
        'GET /projects/:id': 'Get project details',
        'PATCH /projects/:id': 'Update project (BUYER, DRAFT only)',
        'PATCH /projects/:id/publish': 'Publish project (BUYER)',
        'PATCH /projects/:id/status': 'Update project status',
        'GET /projects/:id/requests': 'Get project requests (BUYER)',
        'POST /projects/:id/assign': 'Assign solver (BUYER)',
      },
      requests: {
        'POST /requests': 'Create project request (SOLVER)',
        'GET /requests/my': 'Get my requests (SOLVER)',
        'DELETE /requests/:id': 'Withdraw request (SOLVER)',
      },
      tasks: {
        'POST /tasks': 'Create task (SOLVER)',
        'GET /tasks/my': 'Get my tasks (SOLVER)',
        'GET /tasks/project/:projectId': 'Get project tasks',
        'GET /tasks/:id': 'Get task details',
        'PATCH /tasks/:id': 'Update task (SOLVER)',
        'PATCH /tasks/:id/status': 'Update task status',
        'POST /tasks/:id/review': 'Review task (BUYER)',
      },
      submissions: {
        'POST /submissions/task/:taskId': 'Upload submission (SOLVER)',
        'GET /submissions/task/:taskId': 'Get task submissions',
        'GET /submissions/:id/download': 'Download submission file',
        'DELETE /submissions/:id': 'Delete submission (SOLVER)',
      },
    },
  });
});

export default router;
