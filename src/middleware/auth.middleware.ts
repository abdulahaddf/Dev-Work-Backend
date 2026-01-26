import { Request, Response, NextFunction } from 'express';
import { extractToken, verifyToken, JwtPayload } from '../utils/jwt.js';
import prisma from '../prisma/client.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        roles: string[];
      };
    }
  }
}

/**
 * Middleware to authenticate JWT token
 * Attaches user info to request if valid
 */
export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required',
      });
      return;
    }

    const payload = verifyToken(token);

    if (!payload) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
      return;
    }

    // Fetch user with roles from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
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
        message: 'User not found',
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map((ur) => ur.role.name),
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req.headers.authorization);
    console.log('optionalAuth - path:', req.path, 'token:', token ? 'present' : 'none');

    if (token) {
      const payload = verifyToken(token);

      if (payload) {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        });

        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            roles: user.roles.map((ur) => ur.role.name),
          };
          console.log('optionalAuth - user authenticated:', user.email);
        }
      }
    } else {
      console.log('optionalAuth - no token, proceeding as public');
    }

    next();
  } catch (error) {
    console.log('optionalAuth - error, proceeding without auth:', error);
    // Continue without auth on error
    next();
  }
}
