import express from 'express';
import cors from 'cors';
import { processPipeline } from './pipeline/index.js';
import { createLogger } from './utils/logger.js';
import { getSupabase } from './config/supabase.js';

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
      const supabase = getSupabase();
      const { type } = req.query;
      
      let allData = [];

      if (!type || type === 'all') {
        // Get all messages from all tables
        const { data: leads, error: leadsError } = await supabase
          .from('dealer_leads')
          .select('*')
          .order('created_at', { ascending: false });

        const { data: offerings, error: offeringsError } = await supabase
          .from('distributor_offerings')
          .select('*')
          .order('created_at', { ascending: false });

        const { data: ignored, error: ignoredError } = await supabase
          .from('ignored_messages')
          .select('*')
          .order('created_at', { ascending: false });

        if (leadsError || offeringsError || ignoredError) {
          logger.error('Error fetching messages:', { leadsError, offeringsError, ignoredError });
          return res.status(500).json({
            success: false,
            error: 'Failed to fetch messages'
          });
        }

        allData = [
          ...(leads || []).map(item => ({ ...item, classification: 'lead' })),
          ...(offerings || []).map(item => ({ ...item, classification: 'offering' })),
          ...(ignored || []).map(item => ({ ...item, classification: 'ignored' }))
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      } else {
        // Get specific type
        let query, tableName;
        
        if (type === 'lead') {
          query = supabase.from('dealer_leads').select('*');
          tableName = 'lead';
        } else if (type === 'offering') {
          query = supabase.from('distributor_offerings').select('*');
          tableName = 'offering';
        } else if (type === 'ignored') {
          query = supabase.from('ignored_messages').select('*');
          tableName = 'ignored';
        } else {
          return res.status(400).json({
            success: false,
            error: 'Invalid message type. Use: lead, offering, ignored, or all'
          });
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
          logger.error('Error fetching messages:', error);
          return res.status(500).json({
            success: false,
            error: 'Failed to fetch messages'
          });
        }

        allData = (data || []).map(item => ({ ...item, classification: tableName }));
      }

      // Transform database records to match frontend Message interface
      const messages = allData.map(record => ({
        id: record.id,
        sender: record.sender || 'Unknown',
        senderNumber: record.chat_id || '',
        preview: record.raw_message ? record.raw_message.substring(0, 100) + '...' : '',
        rawMessage: record.raw_message || '',
        classification: record.classification,
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
      const supabase = getSupabase();
      const { id } = req.params;
      
      // Search in all tables for the message ID
      const { data: lead, error: leadError } = await supabase
        .from('dealer_leads')
        .select('*')
        .eq('id', id)
        .single();

      if (!leadError && lead) {
        const message = {
          id: lead.id,
          sender: lead.sender || 'Unknown',
          senderNumber: lead.chat_id || '',
          preview: lead.raw_message ? lead.raw_message.substring(0, 100) + '...' : '',
          rawMessage: lead.raw_message || '',
          classification: 'lead',
          detectedBrands: lead.brand ? [lead.brand] : [],
          timestamp: lead.created_at,
          confidence: lead.confidence || 0,
          parsedData: {
            brand: lead.brand,
            model: lead.model,
            ram: lead.ram ? `${lead.ram}GB` : undefined,
            storage: lead.storage ? `${lead.storage}GB` : undefined,
            quantity: lead.quantity || lead.quantity_max || undefined,
            price: lead.price || lead.price_max || undefined,
            gst: lead.gst ? (lead.gst ? 'Extra' : 'Included') : undefined,
            dispatch: lead.dispatch || undefined,
          },
          whatsappDeepLink: `https://wa.me/${lead.chat_id?.replace('@c.us', '').replace('@g.us', '') || ''}`,
        };
        return res.json({ success: true, data: message });
      }

      const { data: offering, error: offeringError } = await supabase
        .from('distributor_offerings')
        .select('*')
        .eq('id', id)
        .single();

      if (!offeringError && offering) {
        const message = {
          id: offering.id,
          sender: offering.sender || 'Unknown',
          senderNumber: offering.chat_id || '',
          preview: offering.raw_message ? offering.raw_message.substring(0, 100) + '...' : '',
          rawMessage: offering.raw_message || '',
          classification: 'offering',
          detectedBrands: offering.brand ? [offering.brand] : [],
          timestamp: offering.created_at,
          confidence: offering.confidence || 0,
          parsedData: {
            brand: offering.brand,
            model: offering.model,
            ram: offering.ram ? `${offering.ram}GB` : undefined,
            storage: offering.storage ? `${offering.storage}GB` : undefined,
            quantity: offering.quantity || offering.quantity_max || undefined,
            price: offering.price || offering.price_max || undefined,
            gst: offering.gst ? (offering.gst ? 'Extra' : 'Included') : undefined,
            dispatch: offering.dispatch || undefined,
          },
          whatsappDeepLink: `https://wa.me/${offering.chat_id?.replace('@c.us', '').replace('@g.us', '') || ''}`,
        };
        return res.json({ success: true, data: message });
      }

      const { data: ignored, error: ignoredError } = await supabase
        .from('ignored_messages')
        .select('*')
        .eq('id', id)
        .single();

      if (!ignoredError && ignored) {
        const message = {
          id: ignored.id,
          sender: ignored.sender || 'Unknown',
          senderNumber: ignored.chat_id || '',
          preview: ignored.raw_message ? ignored.raw_message.substring(0, 100) + '...' : '',
          rawMessage: ignored.raw_message || '',
          classification: 'ignored',
          detectedBrands: [],
          timestamp: ignored.created_at,
          confidence: ignored.confidence || 0,
          parsedData: undefined,
          whatsappDeepLink: `https://wa.me/${ignored.chat_id?.replace('@c.us', '').replace('@g.us', '') || ''}`,
        };
        return res.json({ success: true, data: message });
      }

      res.status(404).json({
        success: false,
        error: 'Message not found'
      });
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
      const supabase = getSupabase();
      
      // Get all unique contacts from all message tables
      const { data: leads, error: leadsError } = await supabase
        .from('dealer_leads')
        .select('sender, chat_id, created_at');

      const { data: offerings, error: offeringsError } = await supabase
        .from('distributor_offerings')
        .select('sender, chat_id, created_at');

      const { data: ignored, error: ignoredError } = await supabase
        .from('ignored_messages')
        .select('sender, chat_id, created_at');

      if (leadsError || offeringsError || ignoredError) {
        logger.error('Error fetching contacts:', { leadsError, offeringsError, ignoredError });
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch contacts'
        });
      }

      // Combine all contacts and get unique ones with stats
      const allMessages = [...(leads || []), ...(offerings || []), ...(ignored || [])];
      const contactMap = new Map();

      allMessages.forEach(message => {
        const key = message.chat_id;
        if (!contactMap.has(key)) {
          contactMap.set(key, {
            id: key,
            name: message.sender || 'Unknown',
            number: message.chat_id?.replace('@c.us', '').replace('@g.us', '') || '',
            totalMessages: 0,
            leadsCount: 0,
            offeringsCount: 0,
            lastActive: message.created_at
          });
        }

        const contact = contactMap.get(key);
        contact.totalMessages++;
        contact.lastActive = new Date(contact.lastActive) > new Date(message.created_at) 
          ? contact.lastActive 
          : message.created_at;
      });

      // Count specific types
      leads?.forEach(message => {
        const contact = contactMap.get(message.chat_id);
        if (contact) contact.leadsCount++;
      });

      offerings?.forEach(message => {
        const contact = contactMap.get(message.chat_id);
        if (contact) contact.offeringsCount++;
      });

      const contacts = Array.from(contactMap.values())
        .sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));

      res.json({
        success: true,
        data: contacts
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
      const supabase = getSupabase();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get today's counts
      const { data: leadsToday, error: leadsError } = await supabase
        .from('dealer_leads')
        .select('*')
        .gte('created_at', today.toISOString());

      const { data: offeringsToday, error: offeringsError } = await supabase
        .from('distributor_offerings')
        .select('*')
        .gte('created_at', today.toISOString());

      const { data: ignoredToday, error: ignoredError } = await supabase
        .from('ignored_messages')
        .select('*')
        .gte('created_at', today.toISOString());

      if (leadsError || offeringsError || ignoredError) {
        logger.error('Error fetching dashboard stats:', { leadsError, offeringsError, ignoredError });
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch dashboard stats'
        });
      }

      // Get recent activity (last 10 messages from all tables)
      const { data: recentLeads } = await supabase
        .from('dealer_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: recentOfferings } = await supabase
        .from('distributor_offerings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: recentIgnored } = await supabase
        .from('ignored_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // Combine and sort recent activity
      const allRecent = [
        ...(recentLeads || []).map(item => ({ ...item, classification: 'lead' })),
        ...(recentOfferings || []).map(item => ({ ...item, classification: 'offering' })),
        ...(recentIgnored || []).map(item => ({ ...item, classification: 'ignored' }))
      ]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);

      const recentActivity = allRecent.map(record => ({
        id: record.id,
        sender: record.sender || 'Unknown',
        senderNumber: record.chat_id || '',
        preview: record.raw_message ? record.raw_message.substring(0, 100) + '...' : '',
        rawMessage: record.raw_message || '',
        classification: record.classification,
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
        data: {
          leadsToday: (leadsToday || []).length,
          offeringsToday: (offeringsToday || []).length,
          ignoredToday: (ignoredToday || []).length,
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
      const supabase = getSupabase();
      const { q, type, minPrice, maxPrice, brand, model } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      let query = supabase.from('distributor_offerings').select('*');
      
      // Apply filters
      if (type && type !== 'all') {
        if (type === 'offering') {
          query = supabase.from('distributor_offerings').select('*');
        } else if (type === 'lead') {
          query = supabase.from('dealer_leads').select('*');
        }
      }

      // Text search across multiple fields
      if (q) {
        query = query.or(`brand.ilike.%${q}%,model.ilike.%${q}%,raw_message.ilike.%${q}%`);
      }

      // Specific filters
      if (brand) {
        query = query.ilike('brand', `%${brand}%`);
      }
      
      if (model) {
        query = query.ilike('model', `%${model}%`);
      }

      if (minPrice) {
        query = query.gte('price', parseFloat(minPrice));
      }

      if (maxPrice) {
        query = query.lte('price', parseFloat(maxPrice));
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(50);

      if (error) {
        logger.error('Error searching products:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to search products'
        });
      }

      // Transform to product format
      const products = (data || []).map(record => ({
        id: record.id,
        brand: record.brand,
        model: record.model,
        ram: record.ram ? `${record.ram}GB` : undefined,
        storage: record.storage ? `${record.storage}GB` : undefined,
        quantity: record.quantity || record.quantity_max || undefined,
        price: record.price || record.price_max || undefined,
        gst: record.gst ? (record.gst ? 'Extra' : 'Included') : undefined,
        dispatch: record.dispatch || undefined,
        seller: record.sender || 'Unknown',
        sellerNumber: record.chat_id?.replace('@c.us', '').replace('@g.us', '') || '',
        timestamp: record.created_at,
        confidence: record.confidence || 0,
        whatsappDeepLink: `https://wa.me/${record.chat_id?.replace('@c.us', '').replace('@g.us', '') || ''}`,
        source: type === 'lead' ? 'dealer_leads' : 'distributor_offerings'
      }));

      res.json({
        success: true,
        data: products,
        total: products.length
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
