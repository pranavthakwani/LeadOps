import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import qrcode from 'qrcode-terminal';
import { initWhatsAppConfig, getWhatsAppConfig } from '../config/whatsapp.js';
import { createLogger } from '../utils/logger.js';
import { processPipeline } from '../pipeline/index.js';
import { isBusinessMessage } from './business-filter.js';
import { getEnv } from '../config/env.js';
import { chatService } from './chatService.js';

const logger = createLogger('WhatsApp');

// Silent logger for Baileys to prevent crashes while suppressing all logs
const silentBaileysLogger = {
  level: 'silent',
  child: () => silentBaileysLogger,
  trace: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

class BaileysService {
  constructor() {
    this.sock = null;
    this.serverStartTime = Date.now();
    this.retryCount = 0;
    this.maxRetries = 5;
    this.isConnecting = false;
    this.isConnected = false;
    this.retryTimer = null;
    this.authState = null;
    this.qrEmitted = false;
    this.isPairing = false;
    this.sentMessages = new Map(); // Track sent messages for read receipts
    
    // Initialize config first
    initWhatsAppConfig();
    
    // Check if WhatsApp are disabled
    const env = getEnv();
    if (env.whatsapp.disabled) {
      logger.info('🔕 WhatsApp integration is DISABLED - server will run without WhatsApp functionality');
      return;
    }
    
    logger.info('📱 WhatsApp integration is ENABLED - Baileys service ready');
  }

  async initialize() {
    if (this.isConnecting || this.isConnected) {
      logger.debug('Baileys service already connecting or connected');
      return;
    }

    const env = getEnv();
    if (env.whatsapp.disabled) {
      logger.info('WhatsApp integration is disabled - skipping initialization');
      return;
    }

    this.isConnecting = true;
    logger.info('📱 Initializing Baileys WhatsApp client...');
    
    try {
      await this.initializeConnection();
    } catch (error) {
      logger.error('Failed to initialize Baileys client', { error: error.message });
      this.isConnecting = false;
      this.scheduleRetry();
    }
  }

  async initializeConnection() {
    const config = getWhatsAppConfig();
    
    // Ensure auth directory exists
    if (!fs.existsSync(config.sessionPath)) {
      fs.mkdirSync(config.sessionPath, { recursive: true });
    }

    // Only create authState if it doesn't exist (preserve existing sessions)
    if (!this.authState) {
      this.authState = await useMultiFileAuthState(config.sessionPath);
      logger.info('Created new auth state');
    } else {
      logger.info('Reusing existing auth state');
    }
    
    // Check if we have a valid session (don't reset QR flag if session exists)
    const sessionFiles = fs.readdirSync(config.sessionPath).filter(file => file.startsWith('session-'));
    const hasSession = sessionFiles.length > 0;
    if (!hasSession) {
      this.qrEmitted = false; // Only reset QR if no session exists
      logger.info('No existing session found - QR will be generated');
    } else {
      this.qrEmitted = true; // Prevent QR if session exists
      logger.info(`Existing session found (${sessionFiles.length} files) - QR will be skipped`);
    }

    // Fetch latest WhatsApp Web version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Using WhatsApp version ${version.join('.')}, isLatest: ${isLatest}`);

    // Create socket with explicit configuration
    this.sock = makeWASocket({
      version, // ALWAYS include the latest version
      auth: this.authState.state,
      printQRInTerminal: false, // We handle QR ourselves
      // Use silent logger to prevent crashes while suppressing all logs
      logger: silentBaileysLogger,
      // Custom browser-like mobile config
      browser: ["LeadOps", "Chrome", "1.0.0"],
      // Connection timeout
      connectTimeoutMs: 60000,
      // Query timeout
      queryTimeoutMs: 60000,
      // Retry configuration
      retryRequestDelayMs: 500,
      maxMsgRetryCount: 2,
    });

    this.setupEventHandlers();
    
    // Add appropriate status message based on session existence
    if (hasSession) {
      logger.info('🔑 Existing session found - connecting automatically...');
    } else {
      logger.info('🔍 Waiting for QR code to be generated...');
    }
    
    // Wait for connection events
    // Connection state changes are handled in event handlers
  }

  setupEventHandlers() {
    // Connection update events - core lifecycle
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Handle QR code (only emit once per session)
      if (qr && !this.qrEmitted) {
        this.qrEmitted = true;
        this.isPairing = true;
        logger.info('📱 QR Code received - scan it with your WhatsApp app!');
        logger.info('🔍 QR Code (scan with WhatsApp):');
        console.log('\n' + '='.repeat(50));
        console.log('📱 WHATSAPP QR CODE - SCAN WITH YOUR PHONE');
        console.log('='.repeat(50));
        qrcode.generate(qr, { small: true });
        console.log('='.repeat(50));
        console.log('📱 Open WhatsApp > Linked Devices > Link a Device');
        console.log('🔍 Point camera at the QR code above');
        console.log('='.repeat(50) + '\n');
      }

      // Handle connection state changes
      if (connection === 'open') {
        this.handleConnectionOpen();
      } else if (connection === 'close') {
        this.handleConnectionClose(lastDisconnect);
      } else if (connection === 'connecting') {
        logger.info('WhatsApp client connecting...');
      }
    });

    // Credentials update - save auth state
    this.sock.ev.on('creds.update', async () => {
      try {
        await this.authState.saveCreds();
        logger.debug('WhatsApp credentials saved');
        this.isPairing = false; // pairing complete
      } catch (error) {
        logger.warn('Failed to save credentials', { error: error.message });
      }
    });

    // Message events
    this.sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const message of messages) {
        // 1️⃣ Always store message in chat (mirror WhatsApp fully)
        await chatService.storeMessage(message);

        // 2️⃣ Only process AI if NOT from me (avoid AI on own messages)
        if (!message.key.fromMe) {
          await chatService.handleIncomingMessage(message);
        }
      }
    });
  }

  handleConnectionOpen() {
    this.isConnected = true;
    this.isConnecting = false;
    this.retryCount = 0; // Reset retry count on successful connection
    this.qrEmitted = false; // Reset QR flag for next session
    
    // Setup read receipt tracking
    this.setupReadReceiptTracking();
    
    logger.info('✅ WhatsApp connection established and read receipt tracking enabled'); // Clear pairing flag
    
    logger.info('🎉 WhatsApp connection is OPEN and ready!');
    logger.info('📱 WhatsApp bot is now ready to listen for messages!');
    logger.info('🔥 Send a WhatsApp message to test the pipeline...');
    
    // Immediately save credentials to ensure session persistence
    if (this.authState) {
      this.authState.saveCreds().then(() => {
        logger.info('💾 Credentials saved successfully');
      }).catch(error => {
        logger.warn('Failed to save credentials on connection open', { error: error.message });
      });
    }
    
    // Clear any pending retry timer
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    const cfg = getWhatsAppConfig();
    if (cfg.targetGroupName) {
      logger.info('Configured target group', { targetGroupName: cfg.targetGroupName });
    }
  }

  async handleConnectionClose(lastDisconnect) {
    this.isConnected = false;
    this.isConnecting = false;

    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

    logger.warn('WhatsApp connection closed', { statusCode, shouldReconnect });

    if (statusCode === DisconnectReason.loggedOut) {
      logger.error('Logged out from WhatsApp - clearing auth state');
      await this.handlePermanentFailure();
      return;
    }

    if (shouldReconnect) {
      // 515 = Restart Required. This happens immediately after QR scan.
      // Reconnect immediately to catch the session before it expires.
      if (statusCode === 515 || statusCode === DisconnectReason.restartRequired) {
        logger.info('✅ QR/Pairing accepted. Restarting connection immediately...');
        await this.destroyConnection();
        return this.initialize(); // No setTimeout, no delay. Call it NOW.
      }
      
      // For other errors, use a small delay
      logger.info('🔄 Reconnecting in 2000ms...');
      await this.destroyConnection();
      
      setTimeout(async () => {
        await this.initialize();
      }, 2000);
    }
  }

  async handlePermanentFailure() {
    // Clear auth state for fresh authentication
    const config = getWhatsAppConfig();
    try {
      fs.rmSync(config.sessionPath, { recursive: true, force: true });
      logger.info('Cleared corrupted auth state');
    } catch (error) {
      logger.warn('Could not clear auth state', { error: error.message });
    }

    // Reset state
    this.authState = null;
    this.qrEmitted = false;
    this.isPairing = false;
    
    // Schedule retry for fresh authentication
    this.scheduleRetry();
  }

  async handleMessage(messageData) {
    try {
      // Ignore messages if not connected
      if (!this.isConnected) {
        logger.debug('Ignoring message - WhatsApp not connected');
        return;
      }

      const message = messageData.message;
      if (!message) {
        logger.info('❌ No message in messageData');
        return;
      }

      // Only handle incoming messages (not from self)
      if (messageData.key.fromMe) {
        logger.info('🔙 Ignoring own message');
        return;
      }

      // Only process text messages
      const messageType = Object.keys(message)[0];
      if (messageType !== 'conversation' && messageType !== 'extendedTextMessage') {
        logger.info('📎 Ignored non-text message', { type: messageType });
        return;
      }

      // Extract text content
      const text = message.conversation || message.extendedTextMessage?.text || '';
      if (!text?.trim()) {
        logger.info('📝 Ignored empty message');
        return;
      }

      // Only process messages received after server started
      const messageTimestamp = messageData.messageTimestamp * 1000;
      if (messageTimestamp < this.serverStartTime) {
        logger.debug('Ignored old message received before server start', {
          messageTime: new Date(messageTimestamp).toISOString(),
          serverStartTime: new Date(this.serverStartTime).toISOString()
        });
        return;
      }

      // Build contact info
      const sender = messageData.key.remoteJid;
      const chatId = sender;
      const isGroup = sender.endsWith('@g.us');
      const isBroadcast = sender.endsWith('@broadcast');

      // Get participant info for groups
      let participant = messageData.key.participant;
      if (isGroup && participant) {
        // In groups, the actual sender is the participant
        participant = participant;
      } else {
        // In individual chats, sender is the remote JID
        participant = sender;
      }

      const payload = {
        body: {
          sender: participant,
          sender_name: messageData.pushName || 'Unknown',
          chat_id: chatId,
          chat_type: isGroup
            ? 'group'
            : isBroadcast
            ? 'broadcast'
            : 'individual',
          timestamp: messageData.messageTimestamp,
          raw_text: text,
          wa_message_id: messageData.key.id || null
        },
        raw_text: text
      };

      logger.info('Inbound message received', {
        from: payload.body.sender,
        chat_type: payload.body.chat_type,
        preview: text.substring(0, 80)
      });

      // Business message filter before pipeline
      if (!isBusinessMessage(text)) {
        logger.info('Filtered non-business message', {
          from: payload.body.sender,
          preview: text.substring(0, 50)
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
  }

  scheduleRetry() {
    if (this.isConnecting) {
      logger.warn('Connection already in progress, skipping retry');
      return;
    }

    if (this.retryCount >= this.maxRetries) {
      logger.error('Max retry attempts reached. WhatsApp initialization failed. Consider setting WHATSAPP_DISABLED=true to run without WhatsApp.');
      return;
    }

    this.retryCount++;
    const delay = Math.min(120000 * Math.pow(2, this.retryCount - 1), 600000); // Exponential backoff, start 2min, max 10min
    logger.info(`Scheduling retry (${this.retryCount}/${this.maxRetries}) in ${delay/1000}s...`);
    
    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      logger.info('Retrying WhatsApp connection...');
      await this.initialize();
    }, delay);
  }

  async destroyConnection() {
    if (this.sock) {
      try {
        logger.info('Destroying WhatsApp connection...');
        this.sock.ev.removeAllListeners();
        this.sock.ws.close();
        this.sock = null;
        logger.info('WhatsApp connection destroyed successfully');
      } catch (error) {
        logger.error('Error destroying WhatsApp connection', { error: error.message });
      }
    }
    
    // Reset state
    this.isConnected = false;
    this.isConnecting = false;
    this.isPairing = false;
    
    // Clear retry timer
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  async sendReply(jid, text, replyToMessageId = null) {
    if (!this.sock || !this.isConnected) return { success: false, error: 'WhatsApp not connected' };
    
    try {
      let messageOptions = { text };
      
      // Add quoted message if replying
      if (replyToMessageId) {
        messageOptions.quoted = { 
          key: { remoteJid: jid, id: replyToMessageId } 
        };
      }

      const result = await this.sock.sendMessage(jid, messageOptions);
      
      // Store message for read receipt tracking
      this.sentMessages.set(result.key.id, {
        jid,
        text,
        timestamp: new Date(),
        status: 'sent'
      });

      logger.info('Message sent via WhatsApp', {
        messageId: result.key.id,
        jid,
        text: text.substring(0, 50) + '...'
      });

      return { 
        success: true, 
        waMessageId: result.key.id 
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp reply', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Initialize read receipt tracking
  setupReadReceiptTracking() {
    if (!this.sock) return;

    // Listen for message updates (including read receipts)
    this.sock.ev.on('messages.update', async (updates) => {
      for (const { key, update } of updates) {
        if (key.id && this.sentMessages.has(key.id)) {
          const sentMessage = this.sentMessages.get(key.id);
          
          // Update message status based on WhatsApp update
          if (update.status === 'read') {
            sentMessage.status = 'read';
            logger.info('Message read', {
              messageId: key.id,
              jid: key.remoteJid,
              readAt: new Date()
            });
            
            // Update database and emit WebSocket
            await this.updateMessageStatusInDB(key.id, 3);
          } else if (update.status === 'delivery') {
            sentMessage.status = 'delivered';
            logger.info('Message delivered', {
              messageId: key.id,
              jid: key.remoteJid
            });
            
            await this.updateMessageStatusInDB(key.id, 2);
          }
        }
      }
    });

    // Listen for specific read receipt updates
    this.sock.ev.on('message-receipt.update', async (updates) => {
      for (const receipt of updates) {
        if (receipt.key.id && this.sentMessages.has(receipt.key.id)) {
          const sentMessage = this.sentMessages.get(receipt.key.id);
          
          if (receipt.receiptType === 'read') {
            sentMessage.status = 'read';
            logger.info('Read receipt received', {
              messageId: receipt.key.id,
              jid: receipt.key.remoteJid,
              timestamp: receipt.receiptTimestamp
            });
            
            await this.updateMessageStatusInDB(receipt.key.id, 3);
          } else if (receipt.receiptType === 'delivery') {
            sentMessage.status = 'delivered';
            await this.updateMessageStatusInDB(receipt.key.id, 2);
          }
        }
      }
    });
  }

  // Update message status in database and emit WebSocket
  async updateMessageStatusInDB(messageId, status) {
    try {
      // This would call the database update function
      // For now, we'll emit a WebSocket event
      if (typeof global !== 'undefined' && global.io) {
        global.io.emit('message-status-update', {
          messageId,
          status
        });
      }
    } catch (error) {
      logger.error('Failed to update message status', error);
    }
  }

  async shutdown() {
    logger.info('Shutting down Baileys service...');
    
    // Clear retry timer
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    // Close connection
    await this.destroyConnection();

    // Save auth state if available
    if (this.authState) {
      try {
        await this.authState.saveCreds();
        logger.info('Auth state saved');
      } catch (error) {
        logger.warn('Could not save auth state', { error: error.message });
      }
    }

    logger.info('Baileys service shut down successfully');
  }

  getClient() {
    const env = getEnv();
    if (env.whatsapp.disabled) {
      logger.warn('WhatsApp integration is disabled - getClient() returning null');
      return null;
    }
    return this.sock;
  }
}

// Create singleton instance
export const baileysService = new BaileysService();
