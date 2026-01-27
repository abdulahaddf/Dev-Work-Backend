import { Request, Response } from 'express';
import prisma from '../../prisma/client.js';
import { CreateProjectInput, UpdateProjectInput } from '../../validators/schemas.js';
import { isValidProjectTransition, getProjectStatusLabel } from '../../utils/state-machine.js';
import { ProjectStatus } from '@prisma/client';

/**
 * Create a new project
 * POST /projects
 */
export async function createProject(req: Request, res: Response): Promise<void> {
  try {
    const { title, description, budget, deadline } = req.body as CreateProjectInput;
    const buyerId = req.user!.id;

    const project = await prisma.project.create({
      data: {
        title,
        description,
        budget: budget ? budget : null,
        deadline: deadline ? new Date(deadline) : null,
        buyerId,
        status: 'DRAFT',
      },
      include: {
        buyer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project,
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create project',
    });
  }
}

/**
 * Get buyer's own projects
 * GET /projects/my
 */
export async function getMyProjects(req: Request, res: Response): Promise<void> {
  try {
    const buyerId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status as ProjectStatus | undefined;

    const where: any = { buyerId };
    if (status) where.status = status;

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        include: {
          solver: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { tasks: true, requests: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        projects: projects.map((p) => ({
          ...p,
          statusLabel: getProjectStatusLabel(p.status),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get my projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get projects',
    });
  }
}

/**
 * Get open projects (for solvers)
 * GET /projects/open
 */
export async function getOpenProjects(req: Request, res: Response): Promise<void> {
  try {
    console.log('getOpenProjects called - user:', req.user ? 'authenticated' : 'public');
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;

    const where: any = {
      status: { in: ['OPEN', 'REQUESTED'] },
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        include: {
          buyer: {
            select: { id: true, name: true },
          },
          _count: {
            select: { requests: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where }),
    ]);

    // Check if current user (if authenticated) has already requested each project
    const projectsWithRequestStatus = await Promise.all(
      projects.map(async (project) => {
        let hasRequested = false;
        let requestStatus = null;

        // Only check request status if user is authenticated
        if (req.user) {
          const existingRequest = await prisma.projectRequest.findUnique({
            where: {
              projectId_solverId: {
                projectId: project.id,
                solverId: req.user.id,
              },
            },
          });
          hasRequested = !!existingRequest;
          requestStatus = existingRequest?.status || null;
        }

        return {
          ...project,
          statusLabel: getProjectStatusLabel(project.status),
          hasRequested,
          requestStatus,
        };
      })
    );

    res.json({
      success: true,
      data: {
        projects: projectsWithRequestStatus,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get open projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get projects',
    });
  }
}

/**
 * Get single project by ID
 * GET /projects/:id
 */
export async function getProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        buyer: {
          select: { id: true, name: true, email: true },
        },
        solver: {
          select: { id: true, name: true, email: true },
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,

            _count: { select: { submissions: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { requests: true },
        },
      },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
      });
      return;
    }

    // Check access rights (if user is authenticated)
    let userId: string | undefined;
    let userRoles: string[] = [];
    let isBuyer = false;
    let isSolver = false;
    let isAdmin = false;
    let hasRequested = false;
    let requestStatus: string | null = null;

    if (req.user) {
      userId = req.user.id;
      userRoles = req.user.roles;
      isBuyer = project.buyerId === userId;
      isSolver = project.solverId === userId;
      isAdmin = userRoles.includes('ADMIN');

      // Check if user has requested this project (for solvers)
      if (userRoles.includes('SOLVER') && !isBuyer) {
        const existingRequest = await prisma.projectRequest.findUnique({
          where: {
            projectId_solverId: {
              projectId: id,
              solverId: userId,
            },
          },
        });
        hasRequested = !!existingRequest;
        requestStatus = existingRequest?.status || null;
      }

      // If not admin, buyer, or assigned solver, check if project is public
      if (!isAdmin && !isBuyer && !isSolver) {
        if (!['OPEN', 'REQUESTED'].includes(project.status)) {
          res.status(403).json({
            success: false,
            message: 'Access denied',
          });
          return;
        }
      }
    } else {
      // Unauthenticated user - only allow access to public projects
      if (!['OPEN', 'REQUESTED'].includes(project.status)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Please sign in to view this project.',
        });
        return;
      }
    }

    res.json({
      success: true,
      data: {
        ...project,
        statusLabel: getProjectStatusLabel(project.status),
        accessLevel: isAdmin ? 'admin' : isBuyer ? 'buyer' : isSolver ? 'solver' : 'viewer',
        hasRequested,
        requestStatus,
      },
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get project',
    });
  }
}

/**
 * Update project
 * PATCH /projects/:id
 */
export async function updateProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateProjectInput;
    const userId = req.user!.id;

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
      });
      return;
    }

    if (project.buyerId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Only the project owner can update it',
      });
      return;
    }

    // Only allow updates in DRAFT status
    if (project.status !== 'DRAFT') {
      res.status(400).json({
        success: false,
        message: 'Can only update projects in DRAFT status',
      });
      return;
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        ...updates,
        deadline: updates.deadline ? new Date(updates.deadline) : undefined,
      },
      include: {
        buyer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: updatedProject,
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update project',
    });
  }
}

/**
 * Publish project (DRAFT -> OPEN)
 * PATCH /projects/:id/publish
 */
export async function publishProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
      });
      return;
    }

    if (project.buyerId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Only the project owner can publish it',
      });
      return;
    }

    if (!isValidProjectTransition(project.status, 'OPEN')) {
      res.status(400).json({
        success: false,
        message: `Cannot publish project from ${project.status} status`,
        currentStatus: project.status,
        allowedTransitions: ['OPEN'],
      });
      return;
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: { status: 'OPEN' },
    });

    res.json({
      success: true,
      message: 'Project published successfully',
      data: {
        ...updatedProject,
        statusLabel: getProjectStatusLabel(updatedProject.status),
      },
    });
  } catch (error) {
    console.error('Publish project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish project',
    });
  }
}

/**
 * Get project requests (for buyer)
 * GET /projects/:id/requests
 */
export async function getProjectRequests(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
      });
      return;
    }

    if (project.buyerId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Only the project owner can view requests',
      });
      return;
    }

    const requests = await prisma.projectRequest.findMany({
      where: { projectId: id },
      include: {
        solver: {
          select: {
            id: true,
            name: true,
            email: true,
            _count: { select: { solverProjects: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error('Get project requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get requests',
    });
  }
}

/**
 * Assign solver to project
 * POST /projects/:id/assign
 */
export async function assignSolver(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { solverId } = req.body;
    const userId = req.user!.id;

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
      });
      return;
    }

    if (project.buyerId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Only the project owner can assign solvers',
      });
      return;
    }

    // Check if project can be assigned
    if (!['OPEN', 'REQUESTED'].includes(project.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot assign solver when project is ${project.status}`,
      });
      return;
    }

    // Verify the solver has requested this project
    const request = await prisma.projectRequest.findUnique({
      where: {
        projectId_solverId: {
          projectId: id,
          solverId,
        },
      },
    });

    if (!request) {
      res.status(400).json({
        success: false,
        message: 'Solver has not requested this project',
      });
      return;
    }

    // Verify the solver has SOLVER role
    const solver = await prisma.user.findUnique({
      where: { id: solverId },
      include: { roles: { include: { role: true } } },
    });

    if (!solver || !solver.roles.some((r) => r.role.name === 'SOLVER')) {
      res.status(400).json({
        success: false,
        message: 'User is not a valid solver',
      });
      return;
    }

    // Update project and request in transaction
    const [updatedProject] = await prisma.$transaction([
      prisma.project.update({
        where: { id },
        data: {
          solverId,
          status: 'ASSIGNED',
        },
        include: {
          buyer: { select: { id: true, name: true, email: true } },
          solver: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.projectRequest.update({
        where: { id: request.id },
        data: { status: 'ACCEPTED' },
      }),
      // Reject all other requests
      prisma.projectRequest.updateMany({
        where: {
          projectId: id,
          id: { not: request.id },
        },
        data: { status: 'REJECTED' },
      }),
    ]);

    res.json({
      success: true,
      message: `Solver ${solver.name} assigned to project`,
      data: {
        ...updatedProject,
        statusLabel: getProjectStatusLabel(updatedProject.status),
      },
    });
  } catch (error) {
    console.error('Assign solver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign solver',
    });
  }
}

/**
 * Update project status (state machine enforced)
 * PATCH /projects/:id/status
 */
export async function updateProjectStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body;
    const userId = req.user!.id;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        tasks: true,
      },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
      });
      return;
    }

    // Check permissions based on transition
    const isBuyer = project.buyerId === userId;
    const isSolver = project.solverId === userId;

    // Validate state transition
    if (!isValidProjectTransition(project.status, newStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid status transition from ${project.status} to ${newStatus}`,
        currentStatus: project.status,
        requestedStatus: newStatus,
      });
      return;
    }

    // Role-based transition permissions
    const transitionRules: Record<string, { from: ProjectStatus[]; role: 'buyer' | 'solver' }> = {
      OPEN: { from: ['DRAFT'], role: 'buyer' },
      IN_PROGRESS: { from: ['ASSIGNED'], role: 'solver' },
      UNDER_REVIEW: { from: ['IN_PROGRESS'], role: 'solver' },
      COMPLETED: { from: ['UNDER_REVIEW'], role: 'buyer' },
    };

    const rule = transitionRules[newStatus];
    if (rule) {
      const hasPermission = rule.role === 'buyer' ? isBuyer : isSolver;
      if (!hasPermission) {
        res.status(403).json({
          success: false,
          message: `Only ${rule.role} can transition to ${newStatus}`,
        });
        return;
      }
    }

    // Special validation for UNDER_REVIEW
    if (newStatus === 'UNDER_REVIEW') {
      // Requirement: buyer reviews/accepts tasks first, then solver submits project for final review
      const allTasksAccepted = project.tasks.every((t) => t.status === 'ACCEPTED');
      if (!allTasksAccepted && project.tasks.length > 0) {
        res.status(400).json({
          success: false,
          message: 'All tasks must be accepted before submitting project for review',
        });
        return;
      }
    }

    // Special validation for COMPLETED
    if (newStatus === 'COMPLETED') {
      const allTasksAccepted = project.tasks.every((t) => t.status === 'ACCEPTED');
      if (!allTasksAccepted && project.tasks.length > 0) {
        res.status(400).json({
          success: false,
          message: 'All tasks must be accepted before completing project',
        });
        return;
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: { status: newStatus },
    });

    res.json({
      success: true,
      message: `Project status updated to ${newStatus}`,
      data: {
        ...updatedProject,
        statusLabel: getProjectStatusLabel(updatedProject.status),
      },
    });
  } catch (error) {
    console.error('Update project status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update project status',
    });
  }
}

/**
 * Review project (accept or reject)
 * POST /projects/:id/review
 */
export async function reviewProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { action, feedback } = req.body; // action: 'ACCEPT' | 'REJECT'
    const userId = req.user!.id;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        tasks: true,
      },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
      });
      return;
    }

    if (project.buyerId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Only the project buyer can review the project',
      });
      return;
    }

    if (project.status !== 'UNDER_REVIEW') {
      res.status(400).json({
        success: false,
        message: 'Can only review projects in UNDER_REVIEW status',
        currentStatus: project.status,
      });
      return;
    }

    if (action === 'ACCEPT') {
      // Check if all tasks are accepted
      const allTasksAccepted = project.tasks.length > 0 && project.tasks.every((t) => t.status === 'ACCEPTED');
      if (!allTasksAccepted) {
        res.status(400).json({
          success: false,
          message: 'All tasks must be accepted before accepting the project',
        });
        return;
      }

      // Accept project - mark as completed
      const updatedProject = await prisma.project.update({
        where: { id },
        // Cast to avoid Prisma Client type mismatch until schema migration/client regen is applied
        data: {
          status: 'COMPLETED',
          rejectionFeedback: null, // Clear any previous rejection feedback
        } as any,
      });

      res.json({
        success: true,
        message: 'Project accepted and marked as completed',
        data: {
          ...updatedProject,
          statusLabel: getProjectStatusLabel(updatedProject.status),
        },
      });
    } else if (action === 'REJECT') {
      // Reject project - send back to IN_PROGRESS for resubmission
      const updatedProject = await prisma.project.update({
        where: { id },
        // Cast to avoid Prisma Client type mismatch until schema migration/client regen is applied
        data: {
          status: 'IN_PROGRESS',
          rejectionFeedback: feedback || null,
        } as any,
      });

      res.json({
        success: true,
        message: 'Project rejected. Solver can resubmit with improvements.',
        data: {
          ...updatedProject,
          statusLabel: getProjectStatusLabel(updatedProject.status),
          feedback: feedback || null,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid action. Use ACCEPT or REJECT',
      });
    }
  } catch (error) {
    console.error('Review project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review project',
    });
  }
}

/**
 * Get solver's assigned projects
 * GET /projects/assigned
 */
export async function getAssignedProjects(req: Request, res: Response): Promise<void> {
  try {
    const solverId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const where = { solverId };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        include: {
          buyer: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { tasks: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        projects: projects.map((p) => ({
          ...p,
          statusLabel: getProjectStatusLabel(p.status),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get assigned projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get assigned projects',
    });
  }
}
