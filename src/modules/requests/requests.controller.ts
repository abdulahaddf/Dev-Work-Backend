import { Request, Response } from 'express';
import prisma from '../../prisma/client.js';

/**
 * Request to work on a project
 * POST /requests
 */
export async function createRequest(req: Request, res: Response): Promise<void> {
  try {
    const { projectId, message } = req.body;
    const solverId = req.user!.id;

    // Check if project exists and is open
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

    if (!['OPEN', 'REQUESTED'].includes(project.status)) {
      res.status(400).json({
        success: false,
        message: 'Project is not accepting requests',
        currentStatus: project.status,
      });
      return;
    }

    // Check for existing request
    const existingRequest = await prisma.projectRequest.findUnique({
      where: {
        projectId_solverId: {
          projectId,
          solverId,
        },
      },
    });

    if (existingRequest) {
      res.status(400).json({
        success: false,
        message: 'You have already requested this project',
        requestStatus: existingRequest.status,
      });
      return;
    }

    // Create request and update project status
    const [request] = await prisma.$transaction([
      prisma.projectRequest.create({
        data: {
          projectId,
          solverId,
          message,
        },
        include: {
          project: {
            select: { id: true, title: true },
          },
        },
      }),
      // Update project status to REQUESTED if it was OPEN
      prisma.project.update({
        where: { id: projectId },
        data: { status: 'REQUESTED' },
      }),
    ]);

    res.status(201).json({
      success: true,
      message: 'Request submitted successfully',
      data: request,
    });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create request',
    });
  }
}

/**
 * Get solver's own requests
 * GET /requests/my
 */
export async function getMyRequests(req: Request, res: Response): Promise<void> {
  try {
    const solverId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const where: any = { solverId };
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.projectRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          project: {
            select: {
              id: true,
              title: true,
              status: true,
              budget: true,
              deadline: true,
              buyer: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.projectRequest.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get requests',
    });
  }
}

/**
 * Withdraw a request
 * DELETE /requests/:id
 */
export async function withdrawRequest(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const solverId = req.user!.id;

    const request = await prisma.projectRequest.findUnique({
      where: { id },
    });

    if (!request) {
      res.status(404).json({
        success: false,
        message: 'Request not found',
      });
      return;
    }

    if (request.solverId !== solverId) {
      res.status(403).json({
        success: false,
        message: 'You can only withdraw your own requests',
      });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        message: 'Can only withdraw pending requests',
      });
      return;
    }

    await prisma.projectRequest.delete({
      where: { id },
    });

    // Check if there are any other requests for this project
    const remainingRequests = await prisma.projectRequest.count({
      where: { projectId: request.projectId },
    });

    // If no more requests, revert project status to OPEN
    if (remainingRequests === 0) {
      await prisma.project.update({
        where: { id: request.projectId },
        data: { status: 'OPEN' },
      });
    }

    res.json({
      success: true,
      message: 'Request withdrawn successfully',
    });
  } catch (error) {
    console.error('Withdraw request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to withdraw request',
    });
  }
}
