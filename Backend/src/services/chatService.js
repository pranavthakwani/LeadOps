import { chatRepository } from '../repositories/chatRepository.js';
import { processPipeline } from '../pipeline/index.js';
import { extractText } from '../utils/messageUtils.js';
import { createLogger } from '../utils/logger.js';
import { parseJid, extractPhoneFromJid } from '../utils/jidUtils.js';
import { isBusinessMessage } from './business-filter.js';
import { fetchProfilePicture, shouldFetchProfilePicture } from './profileService.js';

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

    // Extract real participant from broadcast/group messages
    let realJid = jid;
    let sourceJid = jid;
    
    if (jid.endsWith('@g.us') || jid.endsWith('@broadcast')) {
      if (message.key.participant) {
        realJid = message.key.participant;
        logger.info('StoreMessage: Extracted real participant', {
          sourceJid: jid,
          realJid: message.key.participant
        });
      } else {
        logger.warn('StoreMessage: No participant in broadcast/group, skipping', { jid });
        return; // Skip if no participant
      }
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

    // Store message with real JID for contact mapping and source JID for conversation context
    const conversationId = await chatRepository.insertMessage({
      jid: realJid, // Use real participant JID for contact mapping
      sourceJid: sourceJid, // Store original JID for context
      waMessageId,
      fromMe: message.key.fromMe ? 1 : 0,
      text,
      timestamp,
      quotedMessageId: quotedId,
      quotedText, // Only store factual data
      rawMessage: JSON.stringify(message) // Store full raw WhatsApp message for quoting
    });

    logger.info('Message stored in DB', { waMessageId, quotedId, quotedText, hasRawMessage: true });

    // Emit to Socket.IO for real-time updates using conversation_id
    if (global.io && conversationId) {
      const messageData = {
        jid: realJid, // Real participant JID
        sourceJid: sourceJid, // Original broadcast/group JID
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

      // Parse JID to check message type and extract real participant
      const jidInfo = parseJid(messageData.key.remoteJid);
      let realJid = messageData.key.remoteJid;
      let sourceJid = messageData.key.remoteJid;
      
      // Extract real participant from broadcast/group messages
      if (messageData.key.remoteJid.endsWith('@g.us') || messageData.key.remoteJid.endsWith('@broadcast')) {
        if (messageData.key.participant) {
          realJid = messageData.key.participant;
          logger.info('Extracted real participant from broadcast/group', {
            sourceJid: messageData.key.remoteJid,
            realJid: messageData.key.participant,
            messageType: jidInfo.type
          });
        } else {
          logger.warn('No participant found in broadcast/group message', {
            jid: messageData.key.remoteJid
          });
          // Skip if no participant - don't create fake contacts
          return;
        }
      }
      
      // Apply business filter to ALL messages (including broadcasts)
      if (!isBusinessMessage(text)) {
        logger.info('Filtered non-business message', {
          preview: text.substring(0, 50),
          realJid: realJid,
          sourceJid: sourceJid,
          type: jidInfo.type
        });
        return;
      }

      // Build payload for AI pipeline with real JID
      const payload = {
        body: {
          sender: realJid, // Use real participant JID
          sender_name: messageData.pushName || 'Unknown',
          chat_id: sourceJid, // Keep original JID for chat context
          chat_type: jidInfo.type === 'group' || jidInfo.type === 'broadcast' ? 'individual' : 'individual',
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
      quotedText, // Only store factual data
      rawMessage: JSON.stringify({
        key: {
          id: waMessageId,
          remoteJid: jid,
          fromMe: true
        },
        message: {
          conversation: text
        },
        messageTimestamp: Math.floor(timestamp / 1000)
      }) // Store raw message for quoting
    });

    logger.info('Outgoing message stored in DB', { waMessageId, quotedMessageId, quotedText, hasRawMessage: true });

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
  },

  // Handle outgoing messages - ONLY store in conversations, no business filter or AI pipeline
  async handleOutgoingMessage(message) {
    try {
      const messageData = message;
      const msg = messageData.message;
      
      if (!msg) {
        logger.info('❌ No message in outgoing messageData');
        return;
      }

      // Only process text messages
      const messageType = Object.keys(msg)[0];
      if (messageType !== 'conversation' && messageType !== 'extendedTextMessage') {
        logger.info('📎 Ignored non-text outgoing message', { type: messageType });
        return;
      }

      // Extract text content
      const text = msg.conversation || msg.extendedTextMessage?.text || '';
      if (!text?.trim()) {
        logger.info('📝 Ignored empty outgoing message');
        return;
      }

      // Outgoing messages should NOT go through business filter or AI pipeline
      // They are only stored in conversations for chat history
      logger.info('Outgoing message stored only (no AI processing)', {
        jid: messageData.key.remoteJid,
        preview: text.substring(0, 50),
        messageId: messageData.key.id
      });

    } catch (error) {
      logger.error('❌ Error handling outgoing message', { 
        error: error.message,
        messageId: message.key.id 
      });
    }
  },

  // Store message with automatic contact creation and pushName handling
  async storeMessageWithContact(message, sock = null) {
    const jid = message.key.remoteJid;
    const waMessageId = message.key.id;
    const pushName = message.pushName || 'Unknown';

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

    // Parse JID safely and extract phone number
    const jidInfo = parseJid(jid);
    let phoneNumber = null;
    let actualJid = jid; // Default to original JID

    logger.debug('Processing message for contact creation', {
      jid,
      type: jidInfo.type,
      pushName,
      fromMe: message.key.fromMe
    });

    // Handle different JID types properly
    if (jidInfo.type === 'user') {
      // @s.whatsapp.net - real user
      phoneNumber = extractPhoneFromJid(jid);
      actualJid = jid;
    } else if (jidInfo.type === 'broadcast') {
      // @broadcast - extract participant for real user
      logger.info('Processing broadcast message', {
        broadcastJid: jid,
        hasParticipant: !!message.key?.participant,
        participant: message.key?.participant
      });
      
      if (message.key?.participant) {
        const participantJid = message.key.participant;
        const participantInfo = parseJid(participantJid);
        
        if (participantInfo.type === 'user') {
          phoneNumber = extractPhoneFromJid(participantJid);
          actualJid = participantJid;
          logger.info('Resolved broadcast participant to real user', {
            broadcastJid: jid,
            participantJid,
            phoneNumber
          });
        } else {
          logger.debug('Broadcast participant is not a user, skipping', {
            broadcastJid: jid,
            participantJid
          });
          return; // Skip if participant is not a user
        }
      } else {
        logger.debug('Broadcast message has no participant, skipping', { jid });
        return; // Skip broadcast messages without participant
      }
    } else if (jidInfo.type === 'group') {
      // @g.us - resolve participant to real user but mark as group message
      if (message.key?.participant) {
        const participantJid = message.key.participant;
        const participantInfo = parseJid(participantJid);
        
        if (participantInfo.type === 'user') {
          phoneNumber = extractPhoneFromJid(participantJid);
          actualJid = participantJid;
          logger.info('Resolved group participant to real user', {
            groupJid: jid,
            participantJid,
            phoneNumber,
            isGroupMessage: true
          });
        } else {
          logger.debug('Group participant is not a user, skipping', {
            groupJid: jid,
            participantJid
          });
          return; // Skip if participant is not a user
        }
      } else {
        logger.debug('Group message has no participant, skipping', { jid });
        return; // Skip group messages without participant
      }
    } else if (jid.endsWith('@lid')) {
      // @lid - store as-is without phone extraction
      phoneNumber = null; // No phone extraction for @lid
      actualJid = jid;
    } else {
      // Unknown JID type - skip
      logger.debug('Skipping unknown JID type', { jid, type: jidInfo.type });
      return;
    }

    // Create or update contact only for valid user JIDs
    let contactId = null;
    let contact = null;
    let isGroupMessage = false;
    let originalGroupJid = null;
    
    // Safety check: only create contacts for @s.whatsapp.net and @lid
    if (!actualJid.endsWith('@s.whatsapp.net') && !actualJid.endsWith('@lid')) {
      logger.debug('Skipping contact creation - not a user JID', { actualJid });
      return;
    }
    
    // Check if this is a group message
    if (jidInfo.type === 'group') {
      isGroupMessage = true;
      originalGroupJid = jid;
      logger.info('Processing group message', { groupJid: jid, participantJid: actualJid });
    }
    
    if (actualJid.endsWith('@s.whatsapp.net') && phoneNumber) {
      logger.info('Creating/updating contact for @s.whatsapp.net', { phoneNumber, pushName, isGroupMessage });
      contactId = await chatRepository.getOrCreateContactByPhone(phoneNumber, pushName);
      logger.info('Contact creation result', { contactId, phoneNumber, pushName });
      
      // Always update primary_jid to ensure it's stored from actual JID
      await chatRepository.updatePrimaryJid(contactId, actualJid);
      logger.info('Updated primary_jid for contact', { contactId, actualJid });
      
    } else if (actualJid.endsWith('@lid')) {
      logger.info('Creating/updating contact for @lid', { actualJid, pushName, isGroupMessage });
      // For @lid, create contact with JID as identifier (no phone number)
      contactId = await chatRepository.getOrCreateContactByJid(actualJid, pushName);
      logger.info('Contact creation result for @lid', { contactId, actualJid, pushName });
      
      // Update primary_jid to @lid JID
      await chatRepository.updatePrimaryJid(contactId, actualJid);
      logger.info('Updated primary_jid for @lid contact', { contactId, actualJid });
    }
    
    // Get full contact details for profile picture fetching
    if (contactId) {
      try {
        const contacts = await chatRepository.getContactsByPhoneNumbers([phoneNumber].filter(Boolean));
        contact = contacts.find(c => c.id === contactId);
      } catch (error) {
        logger.error('Failed to get contact details', { error: error.message, contactId });
      }
    }

    // Store message and get conversation_id for socket emission
    // For broadcast messages, use the participant JID for conversation
    const conversationJid = jidInfo.type === 'broadcast' ? actualJid : jid;
    logger.info('Creating conversation for message', {
      originalJid: jid,
      conversationJid,
      isBroadcast: jidInfo.type === 'broadcast',
      actualJid
    });
    
    const conversationId = await chatRepository.insertMessage({
      jid: conversationJid,
      waMessageId,
      fromMe: message.key.fromMe ? 1 : 0,
      text,
      timestamp,
      quotedMessageId: quotedId,
      quotedText,
      rawMessage: JSON.stringify(message),
      // Add group information
      isGroupMessage: isGroupMessage ? 1 : 0,
      originalGroupJid: originalGroupJid || (jidInfo.type === 'broadcast' ? jid : null)
    });

    // Link contact to conversation if we have one
    if (contactId && conversationId) {
      await chatRepository.linkContact(conversationId, contactId);
    }

    // Fetch profile picture using primary_jid if available and valid
    if (contact && contact.primary_jid && shouldFetchProfilePicture(contact)) {
      // Only fetch for @s.whatsapp.net, exclude @lid, @g.us, @broadcast
      if (contact.primary_jid.endsWith('@s.whatsapp.net')) {
        try {
          const profilePicUrl = await fetchProfilePicture(sock, contact.primary_jid, contact);
          if (profilePicUrl) {
            await chatRepository.updateProfilePic(contact.id, profilePicUrl);
            logger.info('Profile picture fetched and stored', { 
              contactId: contact.id, 
              primary_jid: contact.primary_jid 
            });
          }
        } catch (error) {
          logger.error('Profile picture fetch failed', { 
            contactId: contact.id, 
            error: error.message 
          });
          // Continue processing - don't block message flow
        }
      } else {
        logger.debug('Skipping profile picture fetch for non-@s.whatsapp.net JID', { 
          contactId: contact.id, 
          primary_jid: contact.primary_jid 
        });
      }
    }

    logger.info('Message stored with contact', { waMessageId, conversationId, contactId, pushName });

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
        quoted_text: quotedText,
        quoted_from_me: quotedId ? (await getQuotedMessageFromMe(quotedId)) : null,
        // Add group information
        is_group_message: isGroupMessage,
        original_group_jid: originalGroupJid
      };
      
      logger.info('Emitting new-message to Socket.IO', { 
        conversationId, 
        waMessageId, 
        isGroupMessage,
        originalGroupJid,
        room: `conversation_${conversationId}` 
      });
      
      global.io.to(`conversation_${conversationId}`).emit('new-message', messageData);
      
      // Emit contact update for real-time contact list refresh
      if (contactId) {
        const contactUpdateData = {
          contactId,
          last_message_preview: text,
          last_message_at: new Date().toISOString(),
          unread_count: 1, // This should be calculated from actual unread count
          conversation_id: conversationId
        };
        
        logger.info('Emitting contact_update to Socket.IO', { 
          contactId, 
          conversationId,
          messagePreview: text
        });
        
        global.io.emit('contact_update', contactUpdateData);
      }
    } else {
      logger.warn('Socket.IO not available or no conversationId', { 
        hasIo: !!global.io, 
        conversationId 
      });
    }

    return conversationId;
  }

};
