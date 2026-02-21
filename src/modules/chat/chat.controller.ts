import { Request, Response } from 'express';
import prisma from '../../prisma/client.js';

/**
 * Get user's conversations
 * GET /chat/conversations
 */
export async function getConversations(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          where: {
            userId: { not: userId },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                roles: {
                  select: {
                    role: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formatted = conversations.map((conv) => {
      const otherParticipant = conv.participants[0]?.user;
      return {
        id: conv.id,
        updatedAt: conv.updatedAt,
        otherParticipant: otherParticipant ? {
          id: otherParticipant.id,
          name: otherParticipant.name,
          avatar: otherParticipant.avatar,
          roles: otherParticipant.roles.map(r => r.role.name),
        } : null,
        lastMessage: conv.messages[0] || null,
      };
    });

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Failed to get conversations' });
  }
}

/**
 * Get or create a 1-on-1 conversation
 * POST /chat/conversations
 */
export async function getOrCreateConversation(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { participantId } = req.body;

    if (!participantId) {
      res.status(400).json({ success: false, message: 'Participant ID is required' });
      return;
    }

    if (userId === participantId) {
       res.status(400).json({ success: false, message: 'Cannot start conversation with yourself' });
       return;
    }

    // Find existing 1-on-1 conversation
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: participantId } } },
          { participants: { length: 2 } }, // Assuming 1-on-1
        ],
      },
    });

    if (existing) {
      res.json({ success: true, data: existing });
      return;
    }

    // Create new
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId },
            { userId: participantId },
          ],
        },
      },
    });

    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ success: false, message: 'Failed to create conversation' });
  }
}

/**
 * Get message history for a conversation
 * GET /chat/conversations/:id/messages
 */
export async function getMessages(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    // Verify user is participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: userId,
        },
      },
    });

    if (!participant) {
      res.status(403).json({ success: false, message: 'Unauthorized access to conversation' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sender: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    res.json({
      success: true,
      data: messages.reverse(), // Return in chronological order
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to get messages' });
  }
}

/**
 * Get a primary admin ID for "Contact Admin" feature
 * GET /chat/admin-id
 */
export async function getAdminId(req: Request, res: Response): Promise<void> {
  try {
    // Find the first user with an ADMIN role
    const adminRole = await prisma.userRole.findFirst({
      where: {
        role: { name: 'ADMIN' },
      },
      select: { userId: true },
    });

    if (!adminRole) {
      res.status(404).json({ success: false, message: 'No administrators found' });
      return;
    }

    res.json({
      success: true,
      data: { adminId: adminRole.userId },
    });
  } catch (error) {
    console.error('Get admin ID error:', error);
    res.status(500).json({ success: false, message: 'Failed to get admin ID' });
  }
}
