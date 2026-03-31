import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { processPipeline } from './pipeline/index.js';
import { createLogger } from './utils/logger.js';
// import { getMessages, getMessageById, getLeadById, getOfferingById, getIgnoredById, getDashboardStats, getTodayOfferingsByBrand, getAvailableBrands, getAvailableModels, searchMessages, searchProducts } from './api/sqlserver-api.js';
import { baileysService } from './services/baileys.js';
import { chatService } from './services/chatService.js';
import chatRoutes from './routes/chatRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('Express App');

export const createApp = () => {
  const app = express();

  // CORS configuration - allow multiple production URLs
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://182.16.16.189:5100',
    'http://182.16.16.202:5100',
    process.env.FRONTEND_URL || 'http://localhost:5173'
  ].filter(Boolean);

  app.use(cors({
    origin: allowedOrigins,
    credentials: true
  }));

  app.use(express.json());

  // Chat routes
  app.use('/api', chatRoutes);

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  // WhatsApp connection status endpoint
  app.get('/api/whatsapp-status', (req, res) => {
    res.json({
      connected: baileysService.isConnected || false,
      qrRequired: !baileysService.isConnected && baileysService.qrCode !== null,
      lastConnected: baileysService.lastConnected || null,
      connectionState: baileysService.connectionState || 'disconnected',
      lastDisconnectReason: baileysService.lastDisconnectReason || null
    });
  });

  // WhatsApp QR code endpoint
  app.get('/api/whatsapp-qr', (req, res) => {
    if (baileysService.qrCode) {
      res.json({
        success: true,
        qr: baileysService.qrCode
      });
    } else {
      res.json({
        success: false,
        qr: null
      });
    }
  });

  // Reply endpoint for WhatsApp messages
  app.post('/api/reply', async (req, res) => {
    try {
      const { jid, message, replyToMessageId } = req.body;

      // Validate input
      if (!jid) {
        return res.status(400).json({
          success: false,
          error: 'JID is required'
        });
      }

      if (!message || message.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Message cannot be empty'
        });
      }

      // Reject broadcast JIDs
      if (jid.includes('@broadcast')) {
        return res.status(400).json({
          success: false,
          error: 'Cannot reply to broadcast messages'
        });
      }

      // Reject group JIDs for now
      if (jid.includes('@g.us')) {
        return res.status(400).json({
          success: false,
          error: 'Cannot reply to group messages'
        });
      }

      // Check for LID JID (unstable)
      const isLid = jid.includes('@lid');
      if (isLid) {
        logger.warn('Reply to LID JID detected', { jid, message: 'Unstable identity' });
      }

      // Send reply via Baileys
      logger.info('About to send reply', { jid, message: message.substring(0, 50), replyToMessageId });
      const result = await baileysService.sendReply(jid, message, replyToMessageId);
      logger.info('Baileys result received', { success: result.success, error: result.error });

      if (result.success) {
        logger.info('Reply sent successfully', { 
          jid, 
          message: message.substring(0, 50) + '...',
          replyToMessageId,
          waMessageId: result.waMessageId,
          timestamp: new Date().toISOString()
        });
        
        // Store outgoing message in chat service with quoted message support
        await chatService.handleOutgoingMessage(
          jid,
          message,
          result.waMessageId,
          replyToMessageId
        );
        
        res.json({
          success: true,
          data: {
            waMessageId: result.waMessageId
          }
        });
      } else {
        logger.error('Failed to send reply', { jid, error: result.error });
        
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to send reply'
        });
      }
    } catch (error) {
      logger.error('Reply endpoint error', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  app.post('/whatsapp-ai', async (req, res) => {
    try {
      logger.info('Webhook received', { sender: req.body?.sender });

      const payload = {
        body: req.body,
        normalized_text: req.body?.normalized_text,
        raw_text: req.body?.raw_text
      };

      const result = await processPipeline(payload);

      res.json({
        success: true,
        message: 'Message processed',
        itemsProcessed: result.length
      });

    } catch (error) {
      logger.error('Webhook error', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  // Serve static frontend files (after all API routes)
  app.use(express.static(path.join(__dirname, '../../Frontend/dist')));
  
  // Serve assets specifically to handle brand images
  app.use('/assets', express.static(path.join(__dirname, '../../Frontend/dist/assets')));

  // Serve frontend for all non-API routes
  app.get('*', (req, res) => {
    // Don't catch API routes
    if (req.url.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '../../Frontend/dist/index.html'));
  });

  app.use((err, req, res, next) => {
    logger.error('Unhandled error', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  });

  return app;
};
