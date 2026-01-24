import express from 'express';
import cors from 'cors';
import { processPipeline } from './pipeline/index.js';
import { createLogger } from './utils/logger.js';
import { getMessages, getMessageById, getContacts, getDashboardStats, searchMessages } from './api/sqlserver-api.js';

const logger = createLogger('Express App');

export const createApp = () => {
  const app = express();

  // CORS configuration
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'], // Vite default port and common React port
    credentials: true
  }));

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  // API endpoints for frontend
  app.get('/api/messages', async (req, res) => {
    try {
      const { type } = req.query;
      const data = await getMessages(type);
      
      const messages = data.map(record => ({
        id: record.id,
        sender: record.sender || 'Unknown',
        senderNumber: record.chat_id || '',
        preview: record.raw_message ? record.raw_message.substring(0, 100) + '...' : '',
        rawMessage: record.raw_message || '',
        classification: record.type || 'unknown',
        detectedBrands: record.brand ? [record.brand] : [],
        timestamp: record.created_at,
        confidence: record.confidence || 0,
        parsedData: {
          brand: record.brand,
          model: record.model,
          ram: record.ram ? `${record.ram}GB` : undefined,
          storage: record.storage ? `${record.storage}GB` : undefined,
          quantity: record.quantity || record.quantity_max || undefined,
          price: record.price || record.price_max || undefined,
          gst: record.gst ? (record.gst ? 'Extra' : 'Included') : undefined,
          dispatch: record.dispatch || undefined,
        },
        whatsappDeepLink: `https://wa.me/${record.chat_id?.replace('@c.us', '').replace('@g.us', '') || ''}`,
      }));

      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      logger.error('Error fetching messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch messages'
      });
    }
  });

  app.get('/api/messages/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const record = await getMessageById(id);
      
      if (!record) {
        return res.status(404).json({
          success: false,
          error: 'Message not found'
        });
      }

      const message = {
        id: record.id,
        sender: record.sender || 'Unknown',
        senderNumber: record.chat_id || '',
        preview: record.raw_message ? record.raw_message.substring(0, 100) + '...' : '',
        rawMessage: record.raw_message || '',
        classification: record.type || 'unknown',
        detectedBrands: record.brand ? [record.brand] : [],
        timestamp: record.created_at,
        confidence: record.confidence || 0,
        parsedData: record.type === 'ignored' ? undefined : {
          brand: record.brand,
          model: record.model,
          ram: record.ram ? `${record.ram}GB` : undefined,
          storage: record.storage ? `${record.storage}GB` : undefined,
          quantity: record.quantity || record.quantity_max || undefined,
          price: record.price || record.price_max || undefined,
          gst: record.gst ? (record.gst ? 'Extra' : 'Included') : undefined,
          dispatch: record.dispatch || undefined,
        },
        whatsappDeepLink: `https://wa.me/${record.chat_id?.replace('@c.us', '').replace('@g.us', '') || ''}`,
      };

      res.json({ success: true, data: message });
    } catch (error) {
      logger.error('Error fetching message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch message'
      });
    }
  });

  app.get('/api/contacts', async (req, res) => {
    try {
      const contacts = await getContacts();
      
      const formattedContacts = contacts.map(contact => ({
        id: contact.chat_id,
        name: contact.sender || 'Unknown',
        number: contact.chat_id?.replace('@c.us', '').replace('@g.us', '') || '',
        totalMessages: 0, // Would need additional query to get accurate counts
        leadsCount: 0,
        offeringsCount: 0,
        lastActive: contact.last_message_date
      }));

      res.json({
        success: true,
        data: formattedContacts
      });
    } catch (error) {
      logger.error('Error fetching contacts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch contacts'
      });
    }
  });

  app.get('/api/dashboard', async (req, res) => {
    try {
      const dashboardData = await getDashboardStats();
      
      const recentActivity = dashboardData.recentActivity.map(record => ({
        id: record.id,
        sender: record.sender || 'Unknown',
        senderNumber: record.chat_id || '',
        preview: record.raw_message ? record.raw_message.substring(0, 100) + '...' : '',
        rawMessage: record.raw_message || '',
        classification: record.type || 'unknown',
        detectedBrands: record.brand ? [record.brand] : [],
        timestamp: record.created_at,
        confidence: record.confidence || 0,
        parsedData: record.type === 'ignored' ? undefined : {
          brand: record.brand,
          model: record.model,
          ram: record.ram ? `${record.ram}GB` : undefined,
          storage: record.storage ? `${record.storage}GB` : undefined,
          quantity: record.quantity || record.quantity_max || undefined,
          price: record.price || record.price_max || undefined,
          gst: record.gst ? (record.gst ? 'Extra' : 'Included') : undefined,
          dispatch: record.dispatch || undefined,
        },
        whatsappDeepLink: `https://wa.me/${record.chat_id?.replace('@c.us', '').replace('@g.us', '') || ''}`,
      }));

      res.json({
        success: true,
        data: {
          leadsToday: dashboardData.stats.leads_today || 0,
          offeringsToday: dashboardData.stats.offerings_today || 0,
          ignoredToday: dashboardData.stats.ignored_today || 0,
          totalLeads: dashboardData.stats.total_leads || 0,
          totalOfferings: dashboardData.stats.total_offerings || 0,
          totalIgnored: dashboardData.stats.total_ignored || 0,
          recentActivity
        }
      });
    } catch (error) {
      logger.error('Error fetching dashboard stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard stats'
      });
    }
  });

  app.get('/api/search', async (req, res) => {
    try {
      const { q, type, minPrice, maxPrice, brand, model } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      const searchParams = { q, type, minPrice, maxPrice, brand, model };
      const data = await searchMessages(searchParams);

      const formattedResults = data.map(record => ({
        id: record.id,
        sender: record.sender || 'Unknown',
        senderNumber: record.chat_id || '',
        preview: record.raw_message ? record.raw_message.substring(0, 100) + '...' : '',
        rawMessage: record.raw_message || '',
        classification: record.type || 'unknown',
        detectedBrands: record.brand ? [record.brand] : [],
        timestamp: record.created_at,
        confidence: record.confidence || 0,
        parsedData: record.type === 'ignored' ? undefined : {
          brand: record.brand,
          model: record.model,
          ram: record.ram ? `${record.ram}GB` : undefined,
          storage: record.storage ? `${record.storage}GB` : undefined,
          quantity: record.quantity || record.quantity_max || undefined,
          price: record.price || record.price_max || undefined,
          gst: record.gst ? (record.gst ? 'Extra' : 'Included') : undefined,
          dispatch: record.dispatch || undefined,
        },
        whatsappDeepLink: `https://wa.me/${record.chat_id?.replace('@c.us', '').replace('@g.us', '') || ''}`,
      }));

      res.json({
        success: true,
        data: formattedResults
      });
    } catch (error) {
      logger.error('Error searching products:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search products'
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

  app.use((err, req, res, next) => {
    logger.error('Unhandled error', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  });

  return app;
};
