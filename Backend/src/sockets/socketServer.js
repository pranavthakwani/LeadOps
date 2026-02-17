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
    socket.on('join-room', (jid) => {
      socket.join(jid);
    });
  });

  return server;
};
