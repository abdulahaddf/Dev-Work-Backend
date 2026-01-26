import { z } from 'zod';

// ============================================
// AUTH SCHEMAS
// ============================================

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ============================================
// ROLE SCHEMAS
// ============================================

export const assignRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  roleName: z.enum(['ADMIN', 'BUYER', 'SOLVER'], {
    errorMap: () => ({ message: 'Role must be ADMIN, BUYER, or SOLVER' }),
  }),
});

export const removeRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  roleName: z.enum(['ADMIN', 'BUYER', 'SOLVER'], {
    errorMap: () => ({ message: 'Role must be ADMIN, BUYER, or SOLVER' }),
  }),
});

// ============================================
// PROJECT SCHEMAS
// ============================================

export const createProjectSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  budget: z.number().positive('Budget must be positive').optional(),
  deadline: z.string().datetime().optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).optional(),
  budget: z.number().positive().optional(),
  deadline: z.string().datetime().optional(),
});

export const projectStatusSchema = z.object({
  status: z.enum([
    'DRAFT',
    'OPEN',
    'REQUESTED',
    'ASSIGNED',
    'IN_PROGRESS',
    'UNDER_REVIEW',
    'COMPLETED',
  ]),
});

// ============================================
// REQUEST SCHEMAS
// ============================================

export const createRequestSchema = z.object({
  message: z.string().max(1000).optional(),
});

// ============================================
// TASK SCHEMAS
// ============================================

export const createTaskSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  deadline: z.string().datetime('Invalid deadline format'),
});

export const updateTaskSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).optional(),
  deadline: z.string().datetime().optional(),
});

export const taskStatusSchema = z.object({
  status: z.enum(['CREATED', 'IN_PROGRESS', 'SUBMITTED', 'ACCEPTED', 'REJECTED']),
});

// ============================================
// SUBMISSION SCHEMAS
// ============================================

export const createSubmissionSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const reviewSubmissionSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT'], {
    errorMap: () => ({ message: 'Action must be ACCEPT or REJECT' }),
  }),
  feedback: z.string().max(2000).optional(),
});

// ============================================
// QUERY SCHEMAS
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const projectFilterSchema = z.object({
  status: z.enum([
    'DRAFT',
    'OPEN',
    'REQUESTED',
    'ASSIGNED',
    'IN_PROGRESS',
    'UNDER_REVIEW',
    'COMPLETED',
  ]).optional(),
  search: z.string().optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
