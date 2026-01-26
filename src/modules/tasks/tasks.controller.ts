import { Request, Response } from 'express';
import prisma from '../../prisma/client.js';
import { CreateTaskInput, UpdateTaskInput } from '../../validators/schemas.js';
import { isValidTaskTransition, getTaskStatusLabel, canCreateTasks } from '../../utils/state-machine.js';
import { TaskStatus } from '@prisma/client';

/**
 * Create a new task
 * POST /tasks
 */
export async function createTask(req: Request, res: Response): Promise<void> {
  try {
    const { projectId, title, description, deadline } = req.body as CreateTaskInput;
    const solverId = req.user!.id;

    // Check if project exists and solver is assigned
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
      });
      return;
    }

    if (project.solverId !== solverId) {
      res.status(403).json({
        success: false,
        message: 'Only the assigned solver can create tasks',
      });
      return;
    }

    if (!canCreateTasks(project.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot create tasks when project is ${project.status}`,
        allowedStatuses: ['ASSIGNED', 'IN_PROGRESS'],
      });
      return;
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        deadline: new Date(deadline),
        projectId,
        solverId,
        status: 'CREATED',
      },
      include: {
        project: {
          select: { id: true, title: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: {
        ...task,
        statusLabel: getTaskStatusLabel(task.status),
      },
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task',
    });
  }
}

/**
 * Get tasks for a project
 * GET /tasks/project/:projectId
 */
export async function getProjectTasks(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        message: 'Project not found',
      });
      return;
    }

    // Check access
    const isBuyer = project.buyerId === userId;
    const isSolver = project.solverId === userId;
    const isAdmin = req.user!.roles.includes('ADMIN');

    if (!isBuyer && !isSolver && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        _count: { select: { submissions: true } },
        submissions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, createdAt: true, fileName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      data: tasks.map((task) => ({
        ...task,
        statusLabel: getTaskStatusLabel(task.status),
        latestSubmission: task.submissions[0] || null,
      })),
    });
  } catch (error) {
    console.error('Get project tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tasks',
    });
  }
}

/**
 * Get single task by ID
 * GET /tasks/:id
 */
export async function getTask(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            buyerId: true,
            solverId: true,
            status: true,
          },
        },
        submissions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      res.status(404).json({
        success: false,
        message: 'Task not found',
      });
      return;
    }

    // Check access
    const isBuyer = task.project.buyerId === userId;
    const isSolver = task.project.solverId === userId;
    const isAdmin = req.user!.roles.includes('ADMIN');

    if (!isBuyer && !isSolver && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...task,
        statusLabel: getTaskStatusLabel(task.status),
        accessLevel: isBuyer ? 'buyer' : isSolver ? 'solver' : 'admin',
      },
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get task',
    });
  }
}

/**
 * Update task details
 * PATCH /tasks/:id
 */
export async function updateTask(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateTaskInput;
    const userId = req.user!.id;

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      res.status(404).json({
        success: false,
        message: 'Task not found',
      });
      return;
    }

    if (task.solverId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Only the task creator can update it',
      });
      return;
    }

    // Only allow updates in certain statuses
    if (!['CREATED', 'IN_PROGRESS', 'REJECTED'].includes(task.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot update task in ${task.status} status`,
      });
      return;
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        ...updates,
        deadline: updates.deadline ? new Date(updates.deadline) : undefined,
      },
    });

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: {
        ...updatedTask,
        statusLabel: getTaskStatusLabel(updatedTask.status),
      },
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task',
    });
  }
}

/**
 * Update task status
 * PATCH /tasks/:id/status
 */
export async function updateTaskStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body;
    const userId = req.user!.id;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: { buyerId: true, solverId: true },
        },
      },
    });

    if (!task) {
      res.status(404).json({
        success: false,
        message: 'Task not found',
      });
      return;
    }

    // Validate state transition
    if (!isValidTaskTransition(task.status, newStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid status transition from ${task.status} to ${newStatus}`,
        currentStatus: task.status,
        requestedStatus: newStatus,
      });
      return;
    }

    // Role-based permissions for transitions
    const isBuyer = task.project.buyerId === userId;
    const isSolver = task.project.solverId === userId;

    const solverTransitions: TaskStatus[] = ['IN_PROGRESS', 'SUBMITTED'];
    const buyerTransitions: TaskStatus[] = ['ACCEPTED', 'REJECTED'];

    if (solverTransitions.includes(newStatus) && !isSolver) {
      res.status(403).json({
        success: false,
        message: 'Only the solver can make this transition',
      });
      return;
    }

    if (buyerTransitions.includes(newStatus) && !isBuyer) {
      res.status(403).json({
        success: false,
        message: 'Only the buyer can make this transition',
      });
      return;
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { status: newStatus },
    });

    res.json({
      success: true,
      message: `Task status updated to ${newStatus}`,
      data: {
        ...updatedTask,
        statusLabel: getTaskStatusLabel(updatedTask.status),
      },
    });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task status',
    });
  }
}

/**
 * Review task submission (buyer only)
 * POST /tasks/:id/review
 */
export async function reviewTask(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { action, feedback } = req.body;
    const userId = req.user!.id;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, buyerId: true, status: true },
        },
      },
    });

    if (!task) {
      res.status(404).json({
        success: false,
        message: 'Task not found',
      });
      return;
    }

    if (task.project.buyerId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Only the project buyer can review tasks',
      });
      return;
    }

    if (task.status !== 'SUBMITTED') {
      res.status(400).json({
        success: false,
        message: 'Can only review submitted tasks',
        currentStatus: task.status,
      });
      return;
    }

    const newStatus: TaskStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { status: newStatus },
    });

    res.json({
      success: true,
      message: `Task ${action === 'ACCEPT' ? 'accepted' : 'rejected'}`,
      data: {
        ...updatedTask,
        statusLabel: getTaskStatusLabel(updatedTask.status),
        feedback,
      },
    });
  } catch (error) {
    console.error('Review task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review task',
    });
  }
}

/**
 * Get solver's tasks across all projects
 * GET /tasks/my
 */
export async function getMyTasks(req: Request, res: Response): Promise<void> {
  try {
    const solverId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status as TaskStatus | undefined;

    const where: any = { solverId };
    if (status) where.status = status;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        include: {
          project: {
            select: { id: true, title: true, status: true },
          },
          _count: { select: { submissions: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.task.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        tasks: tasks.map((task) => ({
          ...task,
          statusLabel: getTaskStatusLabel(task.status),
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
    console.error('Get my tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tasks',
    });
  }
}
