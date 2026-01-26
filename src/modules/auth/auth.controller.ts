import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../../prisma/client.js';
import { generateToken } from '../../utils/jwt.js';
import { RegisterInput, LoginInput } from '../../validators/schemas.js';

/**
 * Register a new user
 * POST /auth/register
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name } = req.body as RegisterInput;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Get SOLVER role
    let solverRole = await prisma.role.findUnique({
      where: { name: 'SOLVER' },
    });

    // Create SOLVER role if it doesn't exist
    if (!solverRole) {
      solverRole = await prisma.role.create({
        data: { name: 'SOLVER' },
      });
    }

    // Create user with SOLVER role assigned by default
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        roles: {
          create: {
            roleId: solverRole.id,
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    // Format user response
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map((ur) => ur.role.name),
      createdAt: user.createdAt,
    };

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully. SOLVER role assigned by default.',
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register user',
    });
  }
}

/**
 * Login user
 * POST /auth/login
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as LoginInput;

    // Find user with roles
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Prepare user response (exclude password)
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map((ur) => ur.role.name),
      createdAt: user.createdAt,
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to login',
    });
  }
}

/**
 * Get current user profile
 * GET /auth/me
 */
export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        _count: {
          select: {
            buyerProjects: true,
            solverProjects: true,
            tasks: true,
          },
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

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles.map((ur) => ur.role.name),
        createdAt: user.createdAt,
        stats: {
          projectsAsBuyer: user._count.buyerProjects,
          projectsAsSolver: user._count.solverProjects,
          tasksCreated: user._count.tasks,
        },
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile',
    });
  }
}
