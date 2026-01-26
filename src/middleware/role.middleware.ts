import { Request, Response, NextFunction } from 'express';

type RoleName = 'ADMIN' | 'BUYER' | 'SOLVER';

/**
 * Middleware factory to authorize specific roles
 * User must have at least one of the specified roles
 */
export function authorizeRole(...allowedRoles: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if user is authenticated
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Check if user has any of the allowed roles
    const hasRole = req.user.roles.some((role) =>
      allowedRoles.includes(role as RoleName)
    );

    if (!hasRole) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(' or ')}`,
        requiredRoles: allowedRoles,
        userRoles: req.user.roles,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require all specified roles
 * User must have ALL of the specified roles
 */
export function requireAllRoles(...requiredRoles: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const hasAllRoles = requiredRoles.every((role) =>
      req.user!.roles.includes(role)
    );

    if (!hasAllRoles) {
      res.status(403).json({
        success: false,
        message: `Access denied. All of these roles required: ${requiredRoles.join(', ')}`,
        requiredRoles,
        userRoles: req.user.roles,
      });
      return;
    }

    next();
  };
}

/**
 * Check if the current user has a specific role
 */
export function hasRole(req: Request, role: RoleName): boolean {
  return req.user?.roles.includes(role) ?? false;
}

/**
 * Check if the current user is the owner of a resource
 */
export function isOwner(req: Request, ownerId: string): boolean {
  return req.user?.id === ownerId;
}

/**
 * Middleware to check ownership or admin
 */
export function authorizeOwnerOrAdmin(getOwnerId: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const ownerId = getOwnerId(req);
    const isAdmin = req.user.roles.includes('ADMIN');
    const isResourceOwner = ownerId === req.user.id;

    if (!isAdmin && !isResourceOwner) {
      res.status(403).json({
        success: false,
        message: 'Access denied. You must be the owner or an admin.',
      });
      return;
    }

    next();
  };
}
