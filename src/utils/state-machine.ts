import { ProjectStatus, TaskStatus } from '@prisma/client';

/**
 * Project State Machine
 * Defines valid transitions for project lifecycle
 */
export const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: ['OPEN'],
  OPEN: ['REQUESTED', 'DRAFT'], // Can go back to draft or receive requests
  REQUESTED: ['ASSIGNED', 'OPEN'], // Can assign solver or stay open
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['COMPLETED', 'IN_PROGRESS'], // Can go back if rejected
  COMPLETED: [], // Terminal state
};

/**
 * Task State Machine
 * Defines valid transitions for task lifecycle
 */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  CREATED: ['IN_PROGRESS'],
  IN_PROGRESS: ['SUBMITTED'],
  SUBMITTED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [], // Terminal state
  REJECTED: ['IN_PROGRESS'], // Goes back to in progress for revision
};

/**
 * Validate if a project status transition is allowed
 */
export function isValidProjectTransition(
  currentStatus: ProjectStatus,
  newStatus: ProjectStatus
): boolean {
  const validNextStates = PROJECT_TRANSITIONS[currentStatus];
  return validNextStates.includes(newStatus);
}

/**
 * Validate if a task status transition is allowed
 */
export function isValidTaskTransition(
  currentStatus: TaskStatus,
  newStatus: TaskStatus
): boolean {
  const validNextStates = TASK_TRANSITIONS[currentStatus];
  return validNextStates.includes(newStatus);
}

/**
 * Get human-readable label for project status
 */
export function getProjectStatusLabel(status: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = {
    DRAFT: 'Draft',
    OPEN: 'Open for Requests',
    REQUESTED: 'Has Requests',
    ASSIGNED: 'Solver Assigned',
    IN_PROGRESS: 'In Progress',
    UNDER_REVIEW: 'Under Review',
    COMPLETED: 'Completed',
  };
  return labels[status];
}

/**
 * Get human-readable label for task status
 */
export function getTaskStatusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    CREATED: 'Created',
    IN_PROGRESS: 'In Progress',
    SUBMITTED: 'Submitted',
    ACCEPTED: 'Accepted',
    REJECTED: 'Needs Revision',
  };
  return labels[status];
}

/**
 * Check if project is in a state where tasks can be created
 */
export function canCreateTasks(status: ProjectStatus): boolean {
  return ['ASSIGNED', 'IN_PROGRESS'].includes(status);
}

/**
 * Check if project is in a state where work can be submitted
 */
export function canSubmitWork(status: ProjectStatus): boolean {
  return ['IN_PROGRESS'].includes(status);
}

/**
 * Check if project is in a state where it can be reviewed
 */
export function canReviewProject(status: ProjectStatus): boolean {
  return ['UNDER_REVIEW'].includes(status);
}
