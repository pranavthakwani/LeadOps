import { chatRepository } from '../repositories/chatRepository.js';
import { processPipeline } from '../pipeline/index.js';
import { isBusinessMessage } from './business-filter.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ChatService');

// Helper function to get quoted message from_me flag
async function getQuotedMessageFromMe(quotedMessageId) {
  try {
    const quotedMessage = await chatRepository.getMessageById(quotedMessageId);
    return quotedMessage ? quotedMessage.from_me : null;
  } catch (error) {
    logger.error('Error getting quoted message from_me flag', { error: error.message, quotedMessageId });
    return null;
  }
}

// Extract actual text content from WhatsApp message
function extractText(message) {
  if (!message?.message) return null;

  const msg = message.message;

  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    null
  );
}

export const chatService = {

  // Store only actual content messages (filter out system messages, receipts, etc.)
  async storeMessage(message) {
    const jid = message.key.remoteJid;
    const waMessageId = message.key.id;

    // Skip broadcast status messages
    if (jid === 'status@broadcast') {
      logger.debug('Skipping status broadcast message');
      return;
    }

    // Extract actual text content
    const text = extractText(message);
    
    // Skip messages with no actual content
    if (!text || text.trim() === '') {
      logger.debug('Skipping message with no text content', { 
        jid, 
        waMessageId,
        fromMe: message.key.fromMe 
      });
      return;
    }

    // Skip empty messages from self (delivery receipts, etc.)
    if (message.key.fromMe && !text) {
      logger.debug('Skipping empty self message');
      return;
    }

    const timestamp = message.messageTimestamp * 1000;

    // Extract quoted message info from contextInfo
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    const quotedId = contextInfo?.stanzaId || null;

    // Extract quote text directly from WhatsApp message (no DB dependency)
    let quotedText = null;
    
    if (contextInfo?.quotedMessage) {
      const qm = contextInfo.quotedMessage;
      
      quotedText = 
        qm.conversation ||
        qm.extendedTextMessage?.text ||
        qm.imageMessage?.caption ||
        qm.videoMessage?.caption ||
        null;
      
      logger.info('Quote extracted:', { quotedText, quotedId });
    }

    // Store message and get conversation_id for socket emission
    const conversationId = await chatRepository.insertMessage({
      jid,
      waMessageId,
      fromMe: message.key.fromMe ? 1 : 0,
      text,
      timestamp,
      quotedMessageId: quotedId,
      quotedText // Only store factual data
    });

    logger.info('Message stored in DB', { waMessageId, quotedId, quotedText });

    // Emit to Socket.IO for real-time updates using conversation_id
    if (global.io && conversationId) {
      const messageData = {
        jid,
        conversationId,
        waMessageId,
        fromMe: message.key.fromMe,
        message_text: text,
        message_timestamp: timestamp,
        quoted_message_id: quotedId,
        quoted_text: quotedText, // Only send factual data
        quoted_from_me: quotedId ? (await getQuotedMessageFromMe(quotedId)) : null
      };
      
      logger.info('Emitting new-message to Socket.IO', { 
        conversationId, 
        waMessageId, 
        room: `conversation_${conversationId}` 
      });
      
      global.io.to(`conversation_${conversationId}`).emit('new-message', messageData);
    } else {
      logger.warn('Socket.IO not available or no conversationId', { 
        hasIo: !!global.io, 
        conversationId 
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

  async handleOutgoingMessage(jid, text, waMessageId, quotedMessageId = null) {
    logger.info('Handling outgoing message', { 
      jid, 
      text: text.substring(0, 50), 
      waMessageId, 
      quotedMessageId 
    });
    
    const timestamp = Date.now();
    let quotedText = null;

    // If this is a reply, get the quoted message details
    if (quotedMessageId) {
      const quotedMessage = await chatRepository.getMessageById(quotedMessageId);
      if (quotedMessage) {
        quotedText = quotedMessage.message_text;
        logger.info('Found quoted message for reply', { 
          quotedMessageId, 
          quotedText, 
          quotedFromMe: quotedMessage.from_me 
        });
      }
    }

    await chatRepository.insertMessage({
      jid,
      waMessageId,
      fromMe: 1,
      text,
      timestamp,
      quotedMessageId,
      quotedText // Only store factual data
    });

    logger.info('Outgoing message stored in DB', { waMessageId, quotedMessageId, quotedText });

    // Get conversation ID for socket emission
    const conversation = await chatRepository.getConversationByJid(jid);
    const conversationId = conversation?.id;

    // Emit to Socket.IO for real-time updates using conversation_id
    if (global.io && conversationId) {
      const messageData = {
        jid,
        conversationId,
        waMessageId,
        fromMe: true,
        message_text: text,
        message_timestamp: timestamp,
        quoted_message_id: quotedMessageId,
        quoted_text: quotedText, // Only send factual data
        quoted_from_me: quotedMessageId ? (await getQuotedMessageFromMe(quotedMessageId)) : null
      };
      
      logger.info('Emitting outgoing new-message to Socket.IO', { 
        conversationId, 
        waMessageId, 
        room: `conversation_${conversationId}` 
      });
      
      global.io.to(`conversation_${conversationId}`).emit('new-message', messageData);
    } else {
      logger.warn('Socket.IO not available or no conversationId for outgoing message', { 
        hasIo: !!global.io, 
        conversationId 
      });
    }
  },

  async startConversationWithPhone(phone, name = null) {
    const jid = `${phone}@s.whatsapp.net`;

    const contactId = await chatRepository.getOrCreateContactByPhone(phone, name);

    const conversationId = await chatRepository.getOrCreateConversation(jid);

    await chatRepository.linkContact(conversationId, contactId);

    return conversationId;
  }

};
