import { Request, Response } from 'express';
import prisma from '../../prisma/client.js';
import { AssignRoleInput } from '../../validators/schemas.js';

/**
 * Assign a role to a user
 * POST /admin/assign-role
 */
export async function assignRole(req: Request, res: Response): Promise<void> {
  try {
    const { userId, roleName } = req.body as AssignRoleInput;

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Find the role
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      res.status(404).json({
        success: false,
        message: `Role ${roleName} not found`,
      });
      return;
    }

    // Check if user already has this role
    const hasRole = user.roles.some((ur) => ur.role.name === roleName);

    if (hasRole) {
      res.status(400).json({
        success: false,
        message: `User already has the ${roleName} role`,
      });
      return;
    }

    // Assign the role
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

    // Get updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    res.json({
      success: true,
      message: `${roleName} role assigned to ${user.name}`,
      data: {
        user: {
          id: updatedUser!.id,
          email: updatedUser!.email,
          name: updatedUser!.name,
          roles: updatedUser!.roles.map((ur) => ur.role.name),
        },
      },
    });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign role',
    });
  }
}

/**
 * Remove a role from a user
 * POST /admin/remove-role
 */
export async function removeRole(req: Request, res: Response): Promise<void> {
  try {
    const { userId, roleName } = req.body as AssignRoleInput;

    // Find the role
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      res.status(404).json({
        success: false,
        message: `Role ${roleName} not found`,
      });
      return;
    }

    // Check if user has this role
    const userRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
    });

    if (!userRole) {
      res.status(400).json({
        success: false,
        message: `User does not have the ${roleName} role`,
      });
      return;
    }

    // Remove the role
    await prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
    });

    // Get updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    res.json({
      success: true,
      message: `${roleName} role removed`,
      data: {
        user: {
          id: updatedUser!.id,
          email: updatedUser!.email,
          name: updatedUser!.name,
          roles: updatedUser!.roles.map((ur) => ur.role.name),
        },
      },
    });
  } catch (error) {
    console.error('Remove role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove role',
    });
  }
}

/**
 * Get all users with their roles
 * GET /admin/users
 */
export async function getAllUsers(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;

    // Build where clause
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          roles: {
            include: { role: true },
          },
          _count: {
            select: {
              buyerProjects: true,
              solverProjects: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        users: users.map((user) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles.map((ur) => ur.role.name),
          createdAt: user.createdAt,
          stats: {
            projectsAsBuyer: user._count.buyerProjects,
            projectsAsSolver: user._count.solverProjects,
          },
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
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
    });
  }
}

/**
 * Get all projects (admin view)
 * GET /admin/projects
 */
export async function getAllProjects(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    // Build where clause
    const where = status ? { status: status as any } : {};

    // Get projects with pagination
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        include: {
          buyer: {
            select: { id: true, name: true, email: true },
          },
          solver: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              tasks: true,
              requests: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where }),
    ]);

    // Import status label function
    const { getProjectStatusLabel } = await import('../../utils/state-machine.js');

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
    console.error('Get all projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get projects',
    });
  }
}

/**
 * Get all available roles
 * GET /admin/roles
 */
export async function getAllRoles(req: Request, res: Response): Promise<void> {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    res.json({
      success: true,
      data: roles.map((role) => ({
        id: role.id,
        name: role.name,
        userCount: role._count.users,
      })),
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get roles',
    });
  }
}
