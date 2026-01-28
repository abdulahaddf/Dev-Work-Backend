import { Request, Response } from 'express';
import prisma from '../../prisma/client.js';
import { deleteFile, uploadFile, getSignedUrl } from '../../utils/upload.js';
import path from 'path';

/**
 * Create a submission (upload ZIP file)
 * POST /submissions/task/:taskId
 */
export async function createSubmission(req: Request, res: Response): Promise<void> {
  const { taskId } = req.params;
  // Initialize file path variable for cleanup in case of error after upload
  let uploadedFilePath: string | null = null;

  try {
    const { notes } = req.body;
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        message: 'ZIP file is required',
      });
      return;
    }

    // Get task with project info
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: { id: true, solverId: true, status: true },
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

    if (task.project.solverId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Only the assigned solver can submit work',
      });
      return;
    }

    // Check task status
    if (!['IN_PROGRESS', 'REJECTED'].includes(task.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot submit work for task in ${task.status} status`,
      });
      return;
    }

    // Upload to Supabase
    const uploadResult = await uploadFile(file, task.project.id, taskId);
    uploadedFilePath = uploadResult.path;

    // Create submission
    const submission = await prisma.submission.create({
      data: {
        taskId,
        filePath: uploadedFilePath,
        fileName: file.originalname,
        fileSize: file.size,
        notes,
      },
    });

    // Update task status to SUBMITTED
    await prisma.task.update({
      where: { id: taskId },
      // Cast to avoid Prisma Client type mismatch until schema migration/client regen is applied
      data: { status: 'SUBMITTED', reviewFeedback: null } as any,
    });

    res.status(201).json({
      success: true,
      message: 'Submission uploaded successfully',
      data: {
        id: submission.id,
        fileName: submission.fileName,
        fileSize: submission.fileSize,
        notes: submission.notes,
        createdAt: submission.createdAt,
        downloadUrl: `/api/submissions/${submission.id}/download`,
      },
    });
  } catch (error) {
    console.error('Create submission error:', error);
    // Try to clean up file on error if it was uploaded
    if (uploadedFilePath) {
      await deleteFile(uploadedFilePath).catch(() => {});
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create submission',
    });
  }
}

/**
 * Get submissions for a task
 * GET /submissions/task/:taskId
 */
export async function getTaskSubmissions(req: Request, res: Response): Promise<void> {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    // Get task with project info
    const task = await prisma.task.findUnique({
      where: { id: taskId },
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

    const submissions = await prisma.submission.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: submissions.map((s) => ({
        id: s.id,
        fileName: s.fileName,
        fileSize: s.fileSize,
        notes: s.notes,
        createdAt: s.createdAt,
        downloadUrl: `/api/submissions/${s.id}/download`,
      })),
    });
  } catch (error) {
    console.error('Get task submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get submissions',
    });
  }
}

/**
 * Download a submission file
 * GET /submissions/:id/download
 */
export async function downloadSubmission(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            project: {
              select: { buyerId: true, solverId: true },
            },
          },
        },
      },
    });

    if (!submission) {
      res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
      return;
    }

    // Check access
    const isBuyer = submission.task.project.buyerId === userId;
    const isSolver = submission.task.project.solverId === userId;
    const isAdmin = req.user!.roles.includes('ADMIN');

    if (!isBuyer && !isSolver && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    // Get signed URL from Supabase
    const signedUrl = await getSignedUrl(submission.filePath);

    if (!signedUrl) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate download URL',
      });
      return;
    }

    // Redirect to the signed URL
    res.redirect(signedUrl);

  } catch (error) {
    console.error('Download submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download submission',
    });
  }
}

/**
 * Delete a submission
 * DELETE /submissions/:id
 */
export async function deleteSubmission(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            project: {
              select: { solverId: true },
            },
          },
        },
      },
    });

    if (!submission) {
      res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
      return;
    }

    if (submission.task.project.solverId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Only the solver can delete submissions',
      });
      return;
    }

    // Only allow deletion if task is not accepted
    if (submission.task.status === 'ACCEPTED') {
      res.status(400).json({
        success: false,
        message: 'Cannot delete submission for an accepted task',
      });
      return;
    }

    // Delete file from Supabase and database record
    await deleteFile(submission.filePath);
    await prisma.submission.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Submission deleted successfully',
    });
  } catch (error) {
    console.error('Delete submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete submission',
    });
  }
}
