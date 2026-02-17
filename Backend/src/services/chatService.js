import { chatRepository } from '../repositories/chatRepository.js';
import { processPipeline } from '../pipeline/index.js';
import { isBusinessMessage } from './business-filter.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ChatService');

export const chatService = {

  // Store ALL messages (phone, web, incoming, outgoing) - full WhatsApp mirror
  async storeMessage(message) {
    const jid = message.key.remoteJid;
    const waMessageId = message.key.id;

    // Handle different message types
    const text = 
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      message.message?.imageMessage?.caption ||
      message.message?.videoMessage?.caption ||
      message.message?.documentMessage?.caption ||
      '';

    const timestamp = message.messageTimestamp * 1000;

    await chatRepository.insertMessage({
      jid,
      waMessageId,
      fromMe: message.key.fromMe ? 1 : 0,
      text,
      timestamp
    });

    // Emit to Socket.IO for real-time updates
    if (global.io) {
      global.io.to(jid).emit('new-message', {
        jid,
        waMessageId,
        fromMe: message.key.fromMe,
        message_text: text,
        message_timestamp: timestamp
      });
    }
  },

  // Handle incoming messages with AI processing only (storage handled by storeMessage)
  async handleIncomingMessage(message) {
    try {
      const messageData = message;
      const msg = messageData.message;
      
      if (!msg) {
        logger.info('❌ No message in messageData');
        return;
      }

      // Only process text messages
      const messageType = Object.keys(msg)[0];
      if (messageType !== 'conversation' && messageType !== 'extendedTextMessage') {
        logger.info('📎 Ignored non-text message', { type: messageType });
        return;
      }

      // Extract text content
      const text = msg.conversation || msg.extendedTextMessage?.text || '';
      if (!text?.trim()) {
        logger.info('📝 Ignored empty message');
        return;
      }

      // Business message filter before pipeline
      if (!isBusinessMessage(text)) {
        logger.info('Filtered non-business message', {
          preview: text.substring(0, 50)
        });
        return;
      }

      // Build payload for AI pipeline
      const payload = {
        body: {
          sender: messageData.key.remoteJid,
          sender_name: messageData.pushName || 'Unknown',
          chat_id: messageData.key.remoteJid,
          chat_type: 'individual',
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

      // Process through AI pipeline
      const result = await processPipeline(payload);
      
      logger.info('AI pipeline processed message', {
        result: result ? 'success' : 'failed',
        messageCount: result?.length || 0
      });

    } catch (error) {
      logger.error('Error in AI pipeline processing', { 
        error: error.message,
        messageId: message.key.id 
      });
    }
  },

  async handleOutgoingMessage(jid, text, waMessageId) {
    const timestamp = Date.now();

    await chatRepository.insertMessage({
      jid,
      waMessageId,
      fromMe: 1,
      text,
      timestamp
    });

    // Don't emit socket event for outgoing messages
    // Frontend already shows optimistic UI
  }

};
