import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { initWhatsAppConfig, getWhatsAppConfig } from '../config/whatsapp.js';
import { createLogger } from '../utils/logger.js';
import { processPipeline } from '../pipeline/index.js';
import { isBusinessMessage } from './business-filter.js';

const logger = createLogger('WhatsApp');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.serverStartTime = Date.now(); // Track when server started
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
        headless: true,
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
        // Only inbound messages
        if (msg.fromMe) return;

        // Only text messages
        if (msg.type !== 'chat' || !msg.body?.trim()) {
          logger.debug('Ignored non-text or empty message');
          return;
        }

        // Only process messages received after server started
        const messageTimestamp = msg.timestamp * 1000; // Convert to milliseconds
        if (messageTimestamp < this.serverStartTime) {
          logger.debug('Ignored old message received before server start', {
            messageTime: new Date(messageTimestamp).toISOString(),
            serverStartTime: new Date(this.serverStartTime).toISOString()
          });
          return;
        }

        const contact = await msg.getContact();
        const chat = await msg.getChat();

        const payload = {
          body: {
            sender: chat.isGroup ? msg.author : msg.from,
            sender_name: contact.pushname || contact.name || 'Unknown',
            chat_id: chat.id._serialized,
            chat_type: chat.isGroup
              ? 'group'
              : msg.from?.endsWith('@broadcast')
              ? 'broadcast'
              : 'individual',
            timestamp: msg.timestamp,
            raw_text: msg.body,
            wa_message_id: msg.id?._serialized || null
          },
          raw_text: msg.body
        };

        logger.info('Inbound message received', {
          from: payload.body.sender,
          chat_type: payload.body.chat_type,
          preview: msg.body.substring(0, 80)
        });

        // Business message filter before pipeline
        if (!isBusinessMessage(msg.body)) {
          logger.info('Filtered non-business message', {
            from: payload.body.sender,
            preview: msg.body.substring(0, 50)
          });
          return;
        }

        const result = await processPipeline(payload);

        // Extract classification from the first processed item
        let classification = 'unknown';
        if (result && result.length > 0) {
          const firstItem = result[0];
          if (firstItem.__routeTo === 'dealer_leads') {
            classification = 'lead';
          } else if (firstItem.__routeTo === 'distributor_offerings') {
            classification = 'offering';
          } else if (firstItem.__routeTo === 'ignored_messages') {
            classification = 'ignored';
          } else if (firstItem.message_type) {
            classification = firstItem.message_type;
          }
        }

        logger.info('Pipeline processed business message', {
          classification: classification,
          itemsProcessed: result.length,
          routeTo: result[0]?.__routeTo || 'unknown'
        });

      } catch (error) {
        logger.error('Error handling inbound message', {
          error: error?.message || String(error)
        });
      }
    });

  }

  getClient() {
    return this.client;
  }

}

// Create a singleton instance
export const whatsappService = new WhatsAppService();
