import { createLogger } from '../utils/logger.js';
import { supabaseChatRepository as chatRepository } from '../repositories/supabase-chatRepository.js';
import { enqueueProfilePicFetch } from './profilePicService.js';
import { processPipeline } from '../pipeline/index.js';
import { extractText, extractMediaMetadata } from '../utils/messageUtils.js';
import { parseJid, extractPhoneFromJid } from '../utils/jidUtils.js';
import { isBusinessMessage } from './business-filter.js';

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

  // ✅ SMART PUSHNAME LOGIC: Determine if contact name should be updated
  shouldUpdateContactName(contact, pushName) {
    if (!contact || !contact.display_name) return true;
    if (contact.is_auto_generated) return true;
    
    const displayName = contact.display_name;
    
    // Update if name is garbage
    if (
      displayName === 'Unknown' ||
      displayName.match(/^\d+$/) || // only number
      displayName.includes('@') ||   // JID
      displayName === displayName    // basic check
    ) {
      return true;
    }
    
    return false;
  },

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
    
    // Extract media metadata
    const mediaData = extractMediaMetadata(message);
    
    // Skip messages with no actual content (text or media)
    if ((!text || text.trim() === '') && !mediaData) {
      logger.debug('Skipping message with no text or media content', { 
        jid, 
        waMessageId,
        fromMe: message.key.fromMe 
      });
      return;
    }

    // Don't skip media messages even if they have no text
    if (!text && mediaData) {
      logger.info('Processing media message without text', { 
        jid, 
        waMessageId,
        mediaType: mediaData.type,
        fromMe: message.key.fromMe 
      });
    }

    // Skip empty messages from self (delivery receipts, etc.) unless it has media
    if (message.key.fromMe && !text && !mediaData) {
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

    // ✅ DUPLICATE CHECK: Skip if message already exists (WhatsApp echo)
    if (message.key.fromMe) {
      const existingMessage = await chatRepository.getMessageById(waMessageId);
      if (existingMessage) {
        logger.info('⚡ Skipping duplicate outgoing message:', { waMessageId });
        return; // Skip duplicate
      }
    }

    // Store message with group support
    console.log('🔍 Storing message with JIDs:', {
      sourceJid, // Group JID
      realJid,  // Participant JID
      participantJid: message.key.participant,
      isGroupMessage: sourceJid.endsWith('@g.us')
    });
    
    const conversationId = await chatRepository.insertMessage({
      jid: sourceJid, // 🔥 CRITICAL: Use source JID (group JID) for conversation, not participant JID
      participantJid: message.key.participant || null, // Pass participant JID for group messages
      pushName: message.pushName || null, // Pass pushName for display
      waMessageId,
      fromMe: message.key.fromMe ? 1 : 0,
      text,
      timestamp,
      quotedMessageId: quotedId,
      quotedText, // Only store factual data
      rawMessage: JSON.stringify(message), // Store full raw WhatsApp message for quoting
      // 🎥🖼️🎵 Media metadata
      mediaType: mediaData?.type || null,
      mediaUrl: mediaData?.url || null,
      mediaFilename: mediaData?.filename || null,
      mediaFilesize: mediaData?.filesize || null,
      mediaMimetype: mediaData?.mimetype || null,
      mediaDuration: mediaData?.duration || null,
      mediaWidth: mediaData?.width || null,
      mediaHeight: mediaData?.height || null,
      mediaPageCount: mediaData?.pageCount || null,
      mediaThumbnailUrl: mediaData?.thumbnail || null,
      mediaCaption: mediaData?.caption || null
    });

    console.log('✅ Message stored with conversation ID:', conversationId);

    logger.info('Message stored in DB', { waMessageId, quotedId, quotedText, hasRawMessage: true });

    // Fetch group metadata and profile picture for new groups
    if (sourceJid && sourceJid.endsWith('@g.us')) {
      try {
        const sock = global.baileysSock;
        if (sock) {
          // Fetch group metadata (with caching)
          await chatRepository.fetchGroupMetadata(sourceJid, sock);
          
          // Fetch group profile picture (with caching)
          await chatRepository.fetchGroupProfilePicture(sourceJid, sock);
        }
      } catch (error) {
        logger.error('Failed to fetch group metadata/profile picture', { 
          error: error.message, 
          groupJid: sourceJid 
        });
      }
    }

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
        quoted_from_me: quotedId ? (await getQuotedMessageFromMe(quotedId)) : null,
        // Group message specific fields
        is_group_message: sourceJid.endsWith('@g.us') ? 1 : 0,
        push_name: message.pushName || null,
        sender_jid: message.key.participant || null,
        // 🎥🖼️🎵 Media fields
        media_type: mediaData?.type || null,
        media_url: mediaData?.url || null,
        media_filename: mediaData?.filename || null,
        media_filesize: mediaData?.filesize || null,
        media_mimetype: mediaData?.mimetype || null,
        media_duration: mediaData?.duration || null,
        media_width: mediaData?.width || null,
        media_height: mediaData?.height || null,
        media_page_count: mediaData?.pageCount || null,
        media_thumbnail_url: mediaData?.thumbnail || null,
        media_caption: mediaData?.caption || null
      };
      
      logger.info('Emitting new-message to Socket.IO', { 
        conversationId, 
        waMessageId, 
        room: `conversation_${conversationId}`,
        isGroupMessage: sourceJid.endsWith('@g.us')
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
          sender_name: messageData.pushName || null,
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

    // 🔥 CRITICAL: Get resolved conversation ID for socket emission (handles merged contacts)
    const conversationId = await chatRepository.resolveJidToConversation(jid);

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

  // Handle outgoing messages - STORE them properly for complete chat history
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

      // ✅ FIX: Store outgoing messages in database too!
      logger.info('Storing outgoing message from phone/device', { 
        messageId: messageData.key.id,
        fromMe: messageData.key.fromMe
      });
      
      // Use the same storage pipeline as incoming messages
      await this.storeMessageWithContact(message, this.sock);

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
    
    // ✅ FIX: Don't override pushName for outgoing messages
    let pushName = null;
    if (!message.key.fromMe) {
      // Only set pushName for incoming messages, never use "Unknown"
      pushName = message.pushName || null;
    }

    // Skip broadcast status messages
    if (jid === 'status@broadcast') {
      logger.debug('Skipping status broadcast message');
      return;
    }

    // Extract actual text content
    const text = extractText(message);
    
    // Extract media metadata
    const mediaData = extractMediaMetadata(message);
    
    // Skip messages with no actual content (text or media)
    if ((!text || text.trim() === '') && !mediaData) {
      logger.debug('Skipping message with no text or media content', { 
        jid, 
        waMessageId,
        fromMe: message.key.fromMe 
      });
      return;
    }

    // Don't skip media messages even if they have no text
    if (!text && mediaData) {
      logger.info('Processing media message without text', { 
        jid, 
        waMessageId,
        mediaType: mediaData.type,
        fromMe: message.key.fromMe 
      });
    }

    // Skip empty messages from self (delivery receipts, etc.) unless it has media
    if (message.key.fromMe && !text && !mediaData) {
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
        
        if (participantInfo.type === 'user' || participantInfo.type === 'lid') {
          phoneNumber = participantInfo.type === 'user' ? extractPhoneFromJid(participantJid) : null;
          actualJid = participantJid;
          logger.info('Resolved broadcast participant to real user', {
            broadcastJid: jid,
            participantJid,
            phoneNumber,
            participantType: participantInfo.type
          });
        } else {
          logger.debug('Broadcast participant is not a valid user type, skipping', {
            broadcastJid: jid,
            participantJid,
            participantType: participantInfo.type
          });
          return; // Skip if participant is not a user or lid
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
        
        if (participantInfo.type === 'user' || participantInfo.type === 'lid') {
          phoneNumber = participantInfo.type === 'user' ? extractPhoneFromJid(participantJid) : null;
          actualJid = participantJid;
          logger.info('Resolved group participant to real user', {
            groupJid: jid,
            participantJid,
            phoneNumber,
            participantType: participantInfo.type,
            isGroupMessage: true
          });
        } else {
          logger.debug('Group participant is not a valid user type, skipping', {
            groupJid: jid,
            participantJid,
            participantType: participantInfo.type
          });
          return; // Skip if participant is not a user or lid
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

    // 🔥 CRITICAL: Unified identity resolution for both group and direct messages
    // Ensure same user (same JID) gets same contact_id regardless of context
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
    
    // 🔥 CRITICAL: Clean pushName to prevent JSON string storage
    let cleanPushName = pushName;
    if (typeof pushName === 'string' && pushName.startsWith('{')) {
      // If pushName is already a JSON string, parse it to extract the display_name
      try {
        const parsed = JSON.parse(pushName);
        cleanPushName = parsed.display_name || pushName;
        logger.info('🔧 Cleaned JSON pushName', { original: pushName, cleaned: cleanPushName });
      } catch (e) {
        logger.warn('Failed to parse JSON pushName', { pushName, error: e.message });
        cleanPushName = pushName; // fallback to original
      }
    }
    
    // 🔥 UNIFIED CONTACT RESOLUTION: Always use JID-based lookup first
    // This ensures group participants and direct messages resolve to same contact
    logger.info('🔍 UNIFIED IDENTITY RESOLUTION', { actualJid, phoneNumber, pushName: cleanPushName, isGroupMessage });
    
    // First try to find existing contact by JID (most reliable)
    let existingContact = await chatRepository.getContactByJid(actualJid);
    
    if (!existingContact && phoneNumber) {
      // Fallback: try phone number lookup for backward compatibility
      existingContact = await chatRepository.getContactByPhone(phoneNumber);
      logger.info('🔄 Fallback to phone lookup', { phoneNumber, found: !!existingContact });
    }
    
    if (existingContact) {
      contactId = existingContact.id;
      contact = existingContact;
      
      // Smart name update logic
      const shouldUpdateName = cleanPushName && cleanPushName !== 'Unknown' && 
        (existingContact.is_auto_generated === true || 
         !existingContact.display_name || 
         existingContact.display_name === 'Unknown' ||
         existingContact.display_name !== cleanPushName); // 🔥 CRITICAL: Only update if name actually changed
      
      logger.info('🔍 DEBUG: Contact name update check', { 
        contactId, 
        existingName: existingContact.display_name, 
        pushName: cleanPushName, 
        shouldUpdateName,
        pushNameType: typeof cleanPushName,
        namesMatch: existingContact.display_name === cleanPushName
      });
         
      if (shouldUpdateName) {
        await chatRepository.updateContact(contactId, cleanPushName, null);
        logger.info('📝 Updated contact name', { contactId, oldName: existingContact.display_name, newName: cleanPushName });
      } else {
        logger.info('🚫 Skipping contact name update - names are same', { 
          contactId, 
          existingName: existingContact.display_name, 
          pushName: cleanPushName 
        });
      }
      
      logger.info('✅ Found existing contact', { contactId, jid: actualJid, name: existingContact.display_name });
      
    } else {
      // Create new contact using unified method
      logger.info('🆕 Creating new unified contact', { actualJid, phoneNumber, pushName: cleanPushName });
      
      if (phoneNumber) {
        // For @s.whatsapp.net with phone number
        contactId = await chatRepository.getOrCreateContactByPhone(phoneNumber, cleanPushName);
      } else {
        // For @lid (no phone number)
        contactId = await chatRepository.getOrCreateContactByJid(actualJid, cleanPushName);
      }
      
      contact = await chatRepository.getContactById(contactId);
      logger.info('✅ Created new contact', { contactId, jid: actualJid, name: cleanPushName });
    }
    
    // 🔥 CRITICAL: Ensure primary_jid is set correctly for unified identity
    const currentContact = await chatRepository.getContactById(contactId);
    if (!currentContact || currentContact.primary_jid !== actualJid) {
      await chatRepository.updatePrimaryJid(contactId, actualJid);
      logger.info('🔧 Updated primary_jid for unified identity', { contactId, primary_jid: actualJid });
    }
    
    // ✅ SAFE PROFILE PIC FETCHING: Use queue system for incoming messages only
    // 🔴 CRITICAL: Refresh contact data to get latest profile_pic fields
    const freshContact = await chatRepository.getContactById(contactId);
    
    if (!message.key.fromMe && freshContact) {
      enqueueProfilePicFetch(freshContact);
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
      originalGroupJid: originalGroupJid || (jidInfo.type === 'broadcast' ? jid : null),
      // ✅ FIX: Add participant and pushName for group AND broadcast messages
      participantJid: (isGroupMessage || jidInfo.type === 'broadcast') ? actualJid : null,
      pushName: (isGroupMessage || jidInfo.type === 'broadcast') ? pushName : null,
      // 🎥🖼️🎵 Media metadata
      mediaType: mediaData?.type || null,
      mediaUrl: mediaData?.url || null,
      mediaFilename: mediaData?.filename || null,
      mediaFilesize: mediaData?.filesize || null,
      mediaMimetype: mediaData?.mimetype || null,
      mediaDuration: mediaData?.duration || null,
      mediaWidth: mediaData?.width || null,
      mediaHeight: mediaData?.height || null,
      mediaPageCount: mediaData?.pageCount || null,
      mediaThumbnailUrl: mediaData?.thumbnail || null,
      mediaCaption: mediaData?.caption || null
    });

    // Link contact to conversation if we have one (BUT NOT FOR GROUPS!)
    if (contactId && conversationId && !isGroupMessage) {
      await chatRepository.linkContact(conversationId, contactId);
      logger.info('Linked conversation to contact', { conversationId, contactId });
    } else if (isGroupMessage) {
      logger.info('Skipping contact link for group message', { conversationId, jid });
      
      // ✅ FIX: If this is a group but already has contact_id, remove it
      if (contactId) {
        logger.warn('⚠️ Group conversation has contact_id - removing to fix group behavior', { conversationId, currentContactId: contactId });
        // Direct update to fix existing group conversations
        await chatRepository.updateConversationContactId(conversationId, null);
      }
    }

    logger.info('Message stored with contact', {
      waMessageId,
      conversationId,
      contactId,
      pushName: message.pushName,
      participantJid: message.key.participant,
      originalJid: jid,
      actualJid
    });

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
        original_group_jid: originalGroupJid,
        // ✅ FIX: Add participant and pushName for group AND broadcast messages
        push_name: (isGroupMessage || jidInfo.type === 'broadcast') ? pushName : null,
        sender_jid: (isGroupMessage || jidInfo.type === 'broadcast') ? actualJid : null,
        // 🎥🖼️🎵 Media fields
        media_type: mediaData?.type || null,
        media_url: mediaData?.url || null,
        media_filename: mediaData?.filename || null,
        media_filesize: mediaData?.filesize || null,
        media_mimetype: mediaData?.mimetype || null,
        media_duration: mediaData?.duration || null,
        media_width: mediaData?.width || null,
        media_height: mediaData?.height || null,
        media_page_count: mediaData?.pageCount || null,
        media_thumbnail_url: mediaData?.thumbnail || null,
        media_caption: mediaData?.caption || null
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
      
      // 🔥 CRITICAL: Emit conversation update for group messages to refresh contact list
      if (isGroupMessage && conversationId) {
        const conversationUpdateData = {
          conversation_id: conversationId,
          jid: jid,
          last_message_preview: text,
          last_message_at: new Date().toISOString(),
          unread_count: 1,
          type: 'group',
          group_name: originalGroupJid ? (await chatRepository.getConversationById(conversationId))?.group_name : null
        };
        
        logger.info('Emitting conversation_update for group message', { 
          conversationId, 
          jid,
          messagePreview: text,
          type: 'group'
        });
        
        global.io.emit('conversation_update', conversationUpdateData);
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
