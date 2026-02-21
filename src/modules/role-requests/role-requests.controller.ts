import { Request, Response } from 'express';
import prisma from '../../prisma/client.js';
import { CreateRoleRequestInput, ReviewRoleRequestInput } from '../../validators/schemas.js';

/**
 * Create a new role request (Solver -> Buyer)
 * POST /role-requests
 */
export async function createRoleRequest(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { requestedRole, reason } = req.body as CreateRoleRequestInput;

    // Check if user already has this role
    const userWithRoles = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    const hasRole = userWithRoles?.roles.some((r) => r.role.name === requestedRole);
    if (hasRole) {
      res.status(400).json({
        success: false,
        message: `User already has the ${requestedRole} role`,
      });
      return;
    }

    // Check for existing pending request
    const existingPending = await prisma.roleRequest.findFirst({
      where: {
        userId,
        requestedRole,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      res.status(400).json({
        success: false,
        message: `You already have a pending request for the ${requestedRole} role`,
      });
      return;
    }

    const roleRequest = await prisma.roleRequest.create({
      data: {
        userId,
        requestedRole,
        reason,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Role request submitted successfully',
      data: roleRequest,
    });
  } catch (error) {
    console.error('Create role request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit role request',
    });
  }
}

/**
 * Get user's own role requests
 * GET /role-requests/my
 */
export async function getMyRoleRequests(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    const requests = await prisma.roleRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error('Get my role requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your role requests',
    });
  }
}

/**
 * List all role requests (ADMIN only)
 * GET /role-requests
 */
export async function getAllRoleRequests(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.query;

    const requests = await prisma.roleRequest.findMany({
      where: status ? { status: status as any } : {},
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
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
    console.error('Get all role requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch role requests',
    });
  }
}

/**
 * Review a role request (ADMIN only)
 * PATCH /role-requests/:id/review
 */
export async function reviewRoleRequest(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const { status, adminNote } = req.body as ReviewRoleRequestInput;

    const roleRequest = await prisma.roleRequest.findUnique({
      where: { id },
    });

    if (!roleRequest) {
      res.status(404).json({ success: false, message: 'Role request not found' });
      return;
    }

    if (roleRequest.status !== 'PENDING') {
      res.status(400).json({ success: false, message: 'Role request has already been reviewed' });
      return;
    }

    // Update request status
    const updated = await prisma.roleRequest.update({
      where: { id },
      data: {
        status,
        adminNote,
        reviewedById: adminId,
      },
    });

    // If approved, assign the role
    if (status === 'APPROVED') {
      const role = await prisma.role.findUnique({
        where: { name: roleRequest.requestedRole },
      });

      if (role) {
        await prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId: roleRequest.userId,
              roleId: role.id,
            },
          },
          create: {
            userId: roleRequest.userId,
            roleId: role.id,
          },
          update: {},
        });
      }
    }

    res.json({
      success: true,
      message: `Role request ${status.toLowerCase()} successfully`,
      data: updated,
    });
  } catch (error) {
    console.error('Review role request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review role request',
    });
  }
}
