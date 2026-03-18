import { 
  makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion,
  BufferJSON,
  proto,
  delay
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { initWhatsAppConfig, getWhatsAppConfig } from '../config/whatsapp.js';
import { createLogger } from '../utils/logger.js';
import { processPipeline } from '../pipeline/index.js';
import { isBusinessMessage } from './business-filter.js';
import { getEnv } from '../config/env.js';
import { chatService } from './chatService.js';
import { chatRepository } from '../repositories/chatRepository.js';

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
    
    // New state variables for robust connection management
    this.qrCode = null;
    this.lastDisconnectReason = null;
    this.connectionState = 'disconnected'; // 'disconnected', 'connecting', 'connected', 'qr_required'
    this.lastConnected = null;
    this.reconnectTimer = null;
    
    // Initialize config first
    initWhatsAppConfig();
    
    // Check if WhatsApp are disabled
    const env = getEnv();
    if (env.whatsapp.disabled) {
      logger.info('🔕 WhatsApp integration is DISABLED - server will run without WhatsApp functionality');
      return;
    }
    
    logger.info('📱 WhatsApp integration is ENABLED - Baileys service ready');
    
    // Auto-start the connection manager
    this.startBaileys();
  }

  // Main connection manager - responsible for initializing the socket
  async startBaileys() {
    if (this.isConnecting || this.isConnected) {
      logger.debug('Baileys service already connecting or connected');
      return;
    }

    const env = getEnv();
    if (env.whatsapp.disabled) {
      logger.info('🔕 WhatsApp integration is disabled - skipping initialization');
      return;
    }

    this.isConnecting = true;
    this.connectionState = 'connecting';
    logger.info('📱 WhatsApp connecting - Starting Baileys connection manager...');
    logger.info('🔧 Connection parameters: session persistence enabled, QR API ready');
    
    try {
      await this.initializeConnection();
    } catch (error) {
      logger.error('❌ WhatsApp connection failed', { error: error.message, errorStack: error.stack });
      this.isConnecting = false;
      this.connectionState = 'disconnected';
      this.scheduleReconnect();
    }
  }

  async initializeConnection() {
    const config = getWhatsAppConfig();
    
    // Use sessions folder from environment configuration
    const sessionPath = config.sessionPath;
    
    // Ensure sessions directory exists
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
      logger.info(`Created sessions directory for session persistence: ${sessionPath}`);
    }

    // 🔧 Monitor session size - warn if getting large (no deletion)
    try {
      const files = fs.readdirSync(sessionPath);
      if (files.length > 800) {
        logger.warn(`Session size is large (${files.length} files), monitor if needed`);
      }
    } catch (error) {
      logger.debug('Could not check session directory size', { error: error.message });
    }

    // Always reload auth state for fresh connections
    this.authState = await useMultiFileAuthState(sessionPath);
    logger.info('Reloaded auth state for fresh connection');

    // Correct session detection for modern Baileys
    const hasSession = fs.existsSync(path.join(sessionPath, 'creds.json'));
    if (!hasSession) {
      this.qrEmitted = false;
      logger.info('No existing session found (creds.json missing) - QR will be generated');
    } else {
      this.qrEmitted = true;
      logger.info('Existing session found (creds.json exists) - QR will be skipped');
    }

    // Fetch latest WhatsApp Web version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Using WhatsApp version ${version.join('.')}, isLatest: ${isLatest}`);

    // Create socket with explicit configuration
    this.sock = makeWASocket({
      version, // ALWAYS include the latest version
      auth: this.authState.state,
      // Removed deprecated printQRInTerminal option - QR handled manually
      // Use silent logger to prevent crashes while suppressing all logs
      logger: silentBaileysLogger,
      // Removed custom browser header - use Baileys default for better compatibility
      // Connection timeout
      connectTimeoutMs: 200000, // Increased for better stability
      // Query timeout
      queryTimeoutMs: 200000, // Increased for better stability
      // Retry configuration
      retryRequestDelayMs: 1000,
      maxMsgRetryCount: 3,
    });

    // Make socket globally available for profile picture fetching
    global.baileysSock = this.sock;
    
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
      
      // Handle QR code (only emit once per session and store for API)
      if (qr && !this.qrEmitted) {
        this.qrEmitted = true;
        this.qrCode = qr; // Store QR for API access
        this.isPairing = true;
        this.connectionState = 'qr_required';
        logger.info('📱 QR Code generated and stored for API access');
        logger.info('🔍 QR Code available via /api/whatsapp-qr endpoint AND console');
        logger.info('📱 Scan QR in console or use frontend at /settings');
        
        // Emit QR code via WebSocket for real-time frontend updates
        if (global.io) {
          global.io.emit('whatsapp:qr', { qr });
          global.io.emit('whatsapp:status', { connected: false, qrRequired: true });
          logger.info('📡 QR code emitted via WebSocket');
        }
        
        // Print QR code to console manually since printQRInTerminal is deprecated
        console.log('\n' + '='.repeat(50));
        console.log('📱 WHATSAPP QR CODE - SCAN WITH YOUR PHONE');
        console.log('='.repeat(50));
        qrcode.generate(qr, { small: true });
        console.log('='.repeat(50));
        console.log('📱 Or scan using frontend: http://localhost:5176/settings');
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
        try {
          logger.info('Processing message from upsert', { 
            messageId: message.key.id, 
            fromMe: message.key.fromMe,
            messageText: message.message?.conversation || message.message?.extendedTextMessage?.text || 'No text'
          });
          
          // Check if message already exists in DB (prevent duplicates)
          try {
            const existing = await chatRepository.getMessageById(message.key.id);
            if (existing) {
              logger.debug('Message already exists in DB, skipping', { messageId: message.key.id });
              continue;
            } else {
              logger.debug('Message not found in DB, processing', { messageId: message.key.id });
            }
          } catch (error) {
            logger.error('Error checking message existence', { 
              messageId: message.key.id, 
              error: error.message 
            });
          }

          // Store ALL messages (both incoming and outgoing) for complete chat history
          if (!message.key.fromMe) {
            logger.info('Storing incoming message', { messageId: message.key.id });
            await chatService.storeMessageWithContact(message);
            await chatService.handleIncomingMessage(message);
          } else {
            logger.info('Storing outgoing message from phone/device', { 
              messageId: message.key.id,
              fromMe: message.key.fromMe
            });
            await chatService.storeMessageWithContact(message);
            
            // Process outgoing messages through pipeline to ensure conversation visibility
            await chatService.handleOutgoingMessage(message);
          }
        } catch (error) {
          logger.error('Message processing failed', {
            messageId: message.key?.id,
            error: error.message,
            stack: error.stack
          });
          
          // DO NOT throw - continue processing other messages
          continue;
        }
      }
    });
  }

  handleConnectionOpen() {
    this.isConnected = true;
    this.isConnecting = false;
    this.connectionState = 'connected';
    this.lastConnected = new Date().toISOString();
    this.retryCount = 0; // Reset retry count on successful connection
    this.qrEmitted = false; // Reset QR flag for next session
    this.qrCode = null; // Clear QR when connected
    this.lastDisconnectReason = null; // Clear disconnect reason
    this.isPairing = false; // Clear pairing flag
    
    logger.info('✅ WhatsApp connected - Connection established successfully');
    logger.info('🎉 WhatsApp connection is OPEN and ready!');
    logger.info('📱 WhatsApp bot is now ready to listen for messages!');
    logger.info('🔥 Send a WhatsApp message to test the pipeline...');
    logger.info('📊 Connection metrics: timestamp=' + this.lastConnected + ', state=' + this.connectionState);
    
    // Emit connection status via WebSocket for real-time frontend updates
    if (global.io) {
      global.io.emit('whatsapp:status', { connected: true, qrRequired: false });
      logger.info('📡 Connection status emitted via WebSocket');
    }
    
    // Setup read receipt tracking
    this.setupReadReceiptTracking();
    
    logger.info('✅ WhatsApp connection established and read receipt tracking enabled');
    
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
    this.connectionState = 'disconnected';

    const statusCode = lastDisconnect?.error?.output?.statusCode;
    this.lastDisconnectReason = statusCode;

    logger.warn('⚠️ WhatsApp disconnected', { 
      statusCode, 
      shouldReconnect: statusCode !== DisconnectReason.loggedOut,
      lastDisconnectReason: statusCode,
      connectionState: this.connectionState,
      retryCount: this.retryCount
    });

    // Emit disconnection status via WebSocket for real-time frontend updates
    if (global.io) {
      global.io.emit('whatsapp:disconnected');
      global.io.emit('whatsapp:status', { connected: false, qrRequired: false });
      logger.info('📡 Disconnection status emitted via WebSocket');
    }

    if (statusCode === DisconnectReason.loggedOut) {
      logger.error('🚫 Session expired - logged out from WhatsApp');
      logger.info('🔄 Will clear auth state and require new QR scan');
      
      // Emit logout event via WebSocket
      if (global.io) {
        global.io.emit('whatsapp:logout');
        logger.info('📡 Logout event emitted via WebSocket');
      }
      
      await this.handlePermanentFailure();
      return;
    }

    // For all other errors (including 408),// Handle connection close with proper retry logic
    if (statusCode === 408) {
      // 408 timeout - increment retry count
      this.retryCount++;
      logger.warn('⏱️ 408 Timeout detected - WebSocket connection timed out');
      logger.info(`🔄 Retry count: ${this.retryCount}/3`);
      
      // Clear session after 3 consecutive 408 failures
      if (this.retryCount >= 3) {
        logger.warn('🧹 3 consecutive 408 timeouts detected - clearing potentially corrupted session');
        await this.clearSessionState();
        return; // Don't schedule reconnect - clearSessionState handles it
      }
    } else if (statusCode === 440) {
      // 440 error - session invalidated, clear immediately
      logger.warn('Session invalidated → forcing reset');
      await this.clearSessionState();
      return; // Don't schedule reconnect - clearSessionState handles it
    } else {
      logger.info('🔄 Temporary disconnect detected - scheduling automatic reconnect');
    }
    this.scheduleReconnect();
  }

  async clearSessionState() {
    const config = getWhatsAppConfig();
    const sessionPath = config.sessionPath;
    
    try {
      // Clear session files
      fs.rmSync(sessionPath, { recursive: true, force: true });
      logger.info(`🧹 Cleared corrupted session state from ${sessionPath} directory`);
      
      // Reset auth state (but keep retryCount to preserve threshold logic)
      this.authState = null;
      this.qrEmitted = false;
      this.qrCode = null;
      this.isPairing = false;
      // Note: retryCount is NOT reset here - it resets only on successful connection
      this.connectionState = 'disconnected';
      this.isConnected = false;
      this.isConnecting = false;
      
      // Recreate sessions directory
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
      }
      
      logger.info('🔄 Session state cleared - ready for fresh QR authentication');
      
      // Emit QR requirement via WebSocket
      if (global.io) {
        global.io.emit('whatsapp:status', { connected: false, qrRequired: true });
        global.io.emit('whatsapp:logout');
        logger.info('📡 QR requirement emitted via WebSocket after session clear');
      }
      
      // Restart Baileys immediately after clearing session
      setImmediate(() => {
        logger.info('🔄 Restarting Baileys after session clear...');
        this.startBaileys();
      });
    } catch (error) {
      logger.error('❌ Failed to clear session state', { error: error.message });
    }
  }

  async handlePermanentFailure() {
    // Clear sessions state for fresh authentication
    const config = getWhatsAppConfig();
    const sessionPath = config.sessionPath;
    try {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      logger.info(`Cleared corrupted session state from ${sessionPath} directory`);
    } catch (error) {
      logger.warn('Could not clear session state', { error: error.message });
    }

    // Reset state
    this.authState = null;
    this.qrEmitted = false;
    this.qrCode = null;
    this.isPairing = false;
    this.connectionState = 'disconnected';
    
    // Emit QR requirement via WebSocket for immediate modal display
    if (global.io) {
      global.io.emit('whatsapp:status', { connected: false, qrRequired: true });
      logger.info('📡 QR requirement emitted via WebSocket after permanent failure');
    }
    
    // Generate QR immediately without waiting for retry
    logger.info('🔄 Generating QR immediately after session expiration...');
    setImmediate(() => {
      this.startBaileys();
    });
    
    // Also schedule retry as backup
    this.scheduleRetry(true);
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

  // Schedule reconnect with safety delay and progressive backoff
  scheduleReconnect() {
    if (this.isConnecting || this.reconnectTimer) {
      logger.debug('🔄 Reconnect already scheduled or in progress');
      return;
    }

    // Exponential backoff for better stability under network issues
    const baseDelay = 12000; // Start with 12 seconds
    const maxDelay = 60000; // Max 60 seconds
    const delay = Math.min(baseDelay * Math.pow(2, this.retryCount), maxDelay);
    
    logger.info(`🔄 Scheduling reconnect in ${delay}ms... (attempt ${this.retryCount || 1})`);
    logger.info('⏱️ Using progressive backoff to prevent rapid reconnect loops');
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.retryCount = (this.retryCount || 0) + 1;
      logger.info(`🔄 Attempting automatic reconnect... (attempt ${this.retryCount})`);
      logger.info('🔧 Destroying existing connection before reconnect');
      await this.destroyConnection();
      await this.startBaileys();
    }, delay);
  }

  // Legacy retry method for compatibility
  async scheduleRetry(isSessionExpired = false) {
    if (this.isConnecting) {
      logger.warn('Connection already in progress, skipping retry');
      return;
    }

    if (this.retryCount >= this.maxRetries) {
      logger.error('Max retry attempts reached. WhatsApp initialization failed. Consider setting WHATSAPP_DISABLED=true to run without WhatsApp.');
      return;
    }

    this.retryCount++;
    
    // Use much shorter delay for session expiration (5 seconds instead of 120 seconds)
    const delay = isSessionExpired ? 5000 : Math.min(120000 * Math.pow(2, this.retryCount - 1), 600000);
    
    logger.info(`Scheduling retry (${this.retryCount}/${this.maxRetries}) in ${delay/1000}s...`);
    
    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      logger.info('Retrying WhatsApp connection...');
      await this.startBaileys();
    }, delay);
  }

  async destroyConnection() {
    if (this.sock) {
      try {
        logger.info('🔧 Destroying WhatsApp connection...');
        // Use proper Baileys termination instead of just closing websocket
        this.sock.end();
        this.sock = null;
        logger.info('✅ WhatsApp connection destroyed successfully');
      } catch (error) {
        logger.error('❌ Error destroying WhatsApp connection', { error: error.message });
        // Ensure socket is null even if end() fails
        this.sock = null;
      }
    }
    
    // Reset state
    this.isConnected = false;
    this.isConnecting = false;
    this.isPairing = false;
    this.connectionState = 'disconnected';
    
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Clear retry timer
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  async sendReply(jid, text, replyToMessageId = null) {
  if (!this.sock || !this.isConnected) {
    return { success: false, error: 'WhatsApp not connected' };
  }

  try {
    logger.info('Sending WhatsApp reply', { jid, replyToMessageId, text: text.substring(0, 50) });
    
    let options = {};

    if (replyToMessageId) {
      logger.info('Fetching quoted message from DB', { replyToMessageId });
      
      try {
        // Import chatRepository to fetch the full raw message
        const { chatRepository } = await import('../repositories/chatRepository.js');
        const quotedMessageFromDB = await chatRepository.getMessageById(replyToMessageId);
        
        if (quotedMessageFromDB?.raw_message) {
          logger.info('Found raw message, parsing for quote');
          const quotedMsg = JSON.parse(quotedMessageFromDB.raw_message);
          
          options.quoted = quotedMsg;
          logger.info('Quoted message set successfully', { quotedMsgKeys: Object.keys(quotedMsg) });
        } else {
          logger.warn('No raw message found for quoting, sending without quote');
        }
      } catch (dbError) {
        logger.error('Error fetching quoted message from DB', { error: dbError.message, replyToMessageId });
        // Continue without quote rather than failing completely
      }
    }

    logger.info('Calling sendMessage', { hasQuoted: !!options.quoted });
    const result = await this.sock.sendMessage(
      jid,
      { text },
      options
    );

    this.sentMessages.set(result.key.id, {
      jid,
      text,
      timestamp: new Date(),
      status: 'sent'
    });

    logger.info('Message sent via WhatsApp', {
      messageId: result.key.id,
      jid,
      text: text.substring(0, 50) + '...',
      quoted: replyToMessageId ? 'yes' : 'no'
    });

    return {
      success: true,
      waMessageId: result.key.id
    };

  } catch (error) {
    logger.error('Failed to send WhatsApp reply', {
      error: error.message,
      stack: error.stack,
      jid,
      replyToMessageId,
      errorName: error.name,
      errorCode: error.code
    });
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
    logger.info('🛑 Shutting down Baileys service...');
    
    // Clear retry timer
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close connection
    await this.destroyConnection();

    // Save auth state if available
    if (this.authState) {
      try {
        await this.authState.saveCreds();
        logger.info('💾 Auth state saved successfully');
      } catch (error) {
        logger.warn('⚠️ Could not save auth state', { error: error.message });
      }
    }

    logger.info('✅ Baileys service shut down successfully');
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
