import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken } from './utils/jwt.js';
import prisma from './prisma/client.js';

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map<string, Set<string>>();

export function setupSocket(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://dev-work-frontend.vercel.app',
      ],
      credentials: true,
    },
  });

  // Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    const payload = verifyToken(token as string);
    if (!payload) {
      return next(new Error('Authentication error: Invalid token'));
    }

    (socket as any).userId = payload.userId;
    next();
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId as string;
    
    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
      io.emit('user_online', userId);
    }
    onlineUsers.get(userId)!.add(socket.id);
    
    // Send current online users to the newly connected user
    socket.emit('online_users_list', Array.from(onlineUsers.keys()));

    console.log(`📱 User connected: ${userId} (${socket.id})`);

    // Join personal room for notifications
    socket.join(`user:${userId}`);

    // Join conversation rooms
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`👥 User ${userId} joined conversation: ${conversationId}`);
    });

    // Handle sending messages
    socket.on('send_message', async (data: { conversationId: string; content: string }) => {
      try {
        const { conversationId, content } = data;

        // Save to database
        const message = await prisma.message.create({
          data: {
            content,
            conversationId,
            senderId: userId,
          },
          include: {
            sender: {
              select: { id: true, name: true, avatar: true },
            },
          },
        });

        // Update conversation's updatedAt timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        // Broadcast to conversation room
        io.to(`conversation:${conversationId}`).emit('new_message', message);
        
        // Also notify participants who might not be in the room but are online
        // (to update their conversation list / show notifications)
        const participants = await prisma.conversationParticipant.findMany({
          where: { conversationId },
          select: { userId: true },
        });

        participants.forEach(p => {
          if (p.userId !== userId) {
            io.to(`user:${p.userId}`).emit('message_received', {
              conversationId,
              message,
            });
          }
        });

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', 'Failed to send message');
      }
    });

    // Mark messages as read
    socket.on('mark_as_read', async (data: { conversationId: string }) => {
      try {
        const { conversationId } = data;
        const now = new Date();

        await prisma.message.updateMany({
          where: {
            conversationId,
            senderId: { not: userId },
            readAt: null,
          },
          data: {
            readAt: now,
          },
        });

        // Notify other participants in the conversation
        socket.to(`conversation:${conversationId}`).emit('messages_read', {
          conversationId,
          readBy: userId,
          readAt: now,
        });
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    });

    // Handle typing indicators
    socket.on('typing', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        userId,
        conversationId,
      });
    });

    socket.on('stop_typing', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('user_stop_typing', {
        userId,
        conversationId,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('user_offline', userId);
        }
      }
      console.log(`📱 User disconnected: ${userId} (${socket.id})`);
    });
  });

  return io;
}

export function getOnlineUsers() {
  return Array.from(onlineUsers.keys());
}
