import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { initWhatsAppConfig, getWhatsAppConfig } from '../config/whatsapp.js';
import { createLogger } from '../utils/logger.js';
import { processPipeline } from '../pipeline/index.js';
import { extractReplyData } from './reply-extractor.js';
import { storeReplyData } from './reply-storage.js';

const logger = createLogger('WhatsApp');

class WhatsAppService {
  constructor() {
    this.client = null;
    // Initialize config first
    initWhatsAppConfig();
    this.initializeClient();
  }

  initializeClient() {
    const config = getWhatsAppConfig();
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: config.sessionPath
      }),
      puppeteer: {
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    this.setupEventHandlers();
    this.client.initialize();
  }

  setupEventHandlers() {
    this.client.on('qr', (qr) => {
      logger.info('QR Code received, scan it to log in!');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('authenticated', () => {
      logger.info('WhatsApp client authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      logger.error('Authentication failure', { error: msg });
    });

    this.client.on('ready', async () => {
      logger.info('WhatsApp client is ready!');
      const cfg = getWhatsAppConfig();
      if (cfg.targetGroupName) {
        logger.info('Configured target group', { targetGroupName: cfg.targetGroupName });
      }
    });

    this.client.on('message', async (msg) => {
      try {
        // HARD FILTER: Ignore all group messages first
        if (msg.from.endsWith('@g.us')) {
          logger.info('Ignored reply — group message');
          return;
        }

        // Check if this is a reply message (has quoted message)
        if (!msg.hasQuotedMsg) {
          logger.info('Ignored reply — no quoted message');
          return;
        }

        // Extract quoted message data
        const quotedMsg = await msg.getQuotedMessage();
        const quoted_message_id = quotedMsg?.id?._serialized || null;

        // Validate quoted message belongs to our deals
        // TODO: Implement deal validation against database
        // For now, only process if quoted_message_id exists (basic validation)
        if (!quoted_message_id) {
          logger.info('Ignored reply — quoted message is not a tracked deal');
          return;
        }

        logger.info('Processing reply message', {
          from: msg.from,
          hasQuotedMsg: msg.hasQuotedMsg,
          body: msg.body?.substring(0, 100)
        });

        const replyData = extractReplyData({
          replied_by: msg.from,
          sender: msg.getContact(),
          body: msg.body,
          timestamp: msg.timestamp,
          hasQuotedMsg: msg.hasQuotedMsg,
          quotedMsg: quotedMsg
        });

        if (replyData.error) {
          logger.error('Reply extraction failed', { error: replyData.error });
          return;
        }

        // Store reply data directly to database
        const stored = await storeReplyData(replyData);
        
        if (stored) {
          logger.info('Reply extracted and stored successfully', {
            replied_by: replyData.replied_by,
            quoted_message_id: replyData.quoted_message_id,
            deal_linked: replyData.deal_linked
          });
        } else {
          logger.error('Failed to store reply data', {
            replied_by: replyData.replied_by,
            quoted_message_id: replyData.quoted_message_id
          });
        }
        return;

        // STRICT FILTER: Only process outbound broadcast messages
        const isAllowedMessage = 
          msg.fromMe === true &&
          typeof msg.to === 'string' &&
          msg.to.endsWith('@broadcast') &&
          msg.type === 'chat' &&
          msg.body && msg.body.trim().length > 0;

        if (!isAllowedMessage) {
          logger.info('Ignored message — not outbound broadcast');
          return;
        }

        // Process the allowed broadcast message
        logger.info('Processing outbound broadcast message', {
          from: msg.from,
          to: msg.to,
          fromMe: msg.fromMe,
          body: msg.body?.substring(0, 100)
        });

        const payload = {
          body: {
            sender: msg.author || msg.from,
            chat_id: null,
            chat_type: 'broadcast',
            from: msg.from,
            author: msg.author,
            fromMe: msg.fromMe,
            timestamp: msg.timestamp,
            raw_text: msg.body,
            wa_message_id: msg.id?._serialized || null
          },
          raw_text: msg.body
        };

        try {
          const result = await processPipeline(payload);
          logger.info('Pipeline processed broadcast message', { itemsProcessed: result.length });
        } catch (pipelineError) {
          logger.error('Pipeline error for broadcast message', { error: pipelineError?.message || String(pipelineError) });
        }
        return;
      } catch (error) {
        logger.error('Error handling message', { error: error?.message || String(error) });
      }
    });

    // Also listen to messages created by this client (useful when testing by sending from the same account)
    this.client.on('message_create', async (msg) => {
      try {
        // STRICT FILTER: Only process outbound broadcast messages
        const isAllowedMessage = 
          msg.fromMe === true &&
          typeof msg.to === 'string' &&
          msg.to.endsWith('@broadcast') &&
          msg.type === 'chat' &&
          msg.body && msg.body.trim().length > 0;

        if (!isAllowedMessage) {
          logger.info('Ignored message — not outbound broadcast');
          return;
        }

        // Process the allowed broadcast message
        logger.info('Processing outbound broadcast message_create', {
          from: msg.from,
          to: msg.to,
          fromMe: msg.fromMe,
          body: msg.body?.substring(0, 100)
        });

        const payload = {
          body: {
            sender: msg.author || msg.from,
            chat_id: null,
            chat_type: 'broadcast',
            from: msg.from,
            author: msg.author,
            fromMe: msg.fromMe,
            timestamp: msg.timestamp,
            raw_text: msg.body,
            wa_message_id: msg.id?._serialized || null
          },
          raw_text: msg.body
        };

        try {
          const result = await processPipeline(payload);
          logger.info('Pipeline processed broadcast message_create', { itemsProcessed: result.length });
        } catch (pipelineError) {
          logger.error('Pipeline error for broadcast message_create', { error: pipelineError?.message || String(pipelineError) });
        }
        return;
      } catch (error) {
        logger.error('Error handling message_create', { error: error?.message || String(error) });
      }
    });
  }

  getClient() {
    return this.client;
  }

}

// Create a singleton instance
export const whatsappService = new WhatsAppService();
