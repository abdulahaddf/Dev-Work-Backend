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

    const formatted = await Promise.all(conversations.map(async (conv) => {
      const otherParticipant = conv.participants[0]?.user;
      
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          readAt: null,
          senderId: { not: userId },
        },
      });

      console.log(`🔗 Formatting conversation ${conv.id}, unreadCount: ${unreadCount}`);
      
      return {
        id: conv.id,
        updatedAt: conv.updatedAt,
        unreadCount,
        otherParticipant: otherParticipant ? {
          id: otherParticipant.id,
          name: otherParticipant.name,
          avatar: otherParticipant.avatar,
          roles: otherParticipant.roles.map((r: any) => r.role.name),
        } : null,
        lastMessage: conv.messages[0] || null,
      };
    }));

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
    console.log(`💬 getOrCreateConversation: userId=${userId}, participantId=${participantId}`);

    if (!participantId) {
      res.status(400).json({ success: false, message: 'Participant ID is required' });
      return;
    }

    if (userId === participantId) {
       res.status(400).json({ success: false, message: 'Cannot start conversation with yourself' });
       return;
    }

    // Find existing 1-on-1 conversation
    const userConversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: true,
      },
    });

    const existing = userConversations.find(conv => 
      conv.participants.length === 2 && 
      conv.participants.some(p => p.userId === participantId)
    );

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

    console.log(`✅ getOrCreateConversation successful: id=${conversation.id}`);
    res.status(201).json({ success: true, data: conversation });
  } catch (error: any) {
    console.error('❌ Create conversation error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Failed to create conversation', error: error.message });
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
    console.log('🛡️ getAdminId request');
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

    console.log(`✅ getAdminId successful: ${adminRole.userId}`);
    res.json({
      success: true,
      data: { adminId: adminRole.userId },
    });
  } catch (error: any) {
    console.error('❌ Get admin ID error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Failed to get admin ID', error: error.message });
  }
}

/**
 * Get total unread message count for user
 * GET /chat/unread-count
 */
export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    const count = await prisma.message.count({
      where: {
        conversation: {
          participants: {
            some: { userId },
          },
        },
        readAt: null,
        senderId: { not: userId },
      },
    });

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Failed to get unread count' });
  }
}
