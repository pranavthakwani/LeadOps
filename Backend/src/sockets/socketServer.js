import { createServer } from 'http';
import { Server } from 'socket.io';

export const createSocketServer = (app) => {
  const server = createServer(app);

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  global.io = io;

  io.on('connection', (socket) => {
    socket.on('join-conversation', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
    });

    // Legacy support for old JID-based rooms (can be removed after frontend migration)
    socket.on('join-room', (jid) => {
      console.warn('Legacy JID-based room joining detected. Please migrate to join-conversation with conversationId.');
    });
  });

  return server;
};
