import { Request, Response } from 'express';
import prisma from '../../prisma/client.js';
import { UpdateProfileInput } from '../../validators/schemas.js';

/**
 * Get user public profile
 * GET /users/:id/profile
 */
export async function getUserProfile(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        avatar: true,
        skills: true,
        location: true,
        createdAt: true,
        roles: {
          select: {
            role: {
              select: { name: true },
            },
          },
        },
        // Count completed projects as buyer
        buyerProjects: {
          where: { status: 'COMPLETED' },
          select: { id: true },
        },
        // Count completed projects as solver
        solverProjects: {
          where: { status: 'COMPLETED' },
          select: { id: true },
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

    const roles = user.roles.map((r) => r.role.name);
    const completedAsBuyer = user.buyerProjects.length;
    const completedAsSolver = user.solverProjects.length;

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        avatar: user.avatar,
        skills: user.skills,
        location: user.location,
        roles,
        createdAt: user.createdAt,
        stats: {
          completedAsBuyer,
          completedAsSolver,
          totalCompleted: completedAsBuyer + completedAsSolver,
        },
      },
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile',
    });
  }
}

/**
 * Update authenticated user's profile
 * PATCH /users/profile
 */
export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { bio, avatar, skills, location } = req.body as UpdateProfileInput;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(bio !== undefined && { bio }),
        ...(avatar !== undefined && { avatar }),
        ...(skills !== undefined && { skills }),
        ...(location !== undefined && { location }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        avatar: true,
        skills: true,
        location: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
}
