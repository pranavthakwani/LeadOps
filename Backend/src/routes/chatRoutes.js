import express from 'express';
import { supabaseChatRepository as chatRepository } from '../repositories/supabase-chatRepository.js';
import { chatService } from '../services/chatService.js';
import { baileysService } from '../services/baileys.js';
import { getSupabaseChat } from '../config/supabase-chat.js';

const router = express.Router();

// 🔥 CRITICAL: Resolve JID to merged contact conversation
router.get('/resolve-jid/:jid', async (req, res) => {
  try {
    const { jid } = req.params;

    if (!jid) {
      return res.status(400).json({ error: 'JID is required' });
    }

    // Use the new resolveJidToConversation method
    const conversationId = await chatRepository.resolveJidToConversation(jid);
    
    if (!conversationId) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ 
      success: true, 
      conversationId,
      jid
    });
  } catch (err) {
    console.error('RESOLVE JID ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Send message to conversation
router.post('/conversations/:id/send-message', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const { messageText, targetJid, replyToMessageId } = req.body;
    
    console.log('🔍 /conversations/:id/send-message called:', { 
      conversationId, 
      messageText, 
      targetJid,
      body: req.body 
    });
    
    if (!conversationId || isNaN(conversationId)) {
      console.error('❌ Invalid conversationId:', conversationId);
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }
    
    if (!messageText) {
      console.error('❌ No messageText provided');
      return res.status(400).json({ error: 'Message text is required' });
    }
    
    if (!targetJid) {
      console.error('❌ No targetJid provided - this is required!');
      return res.status(400).json({ error: 'Target JID is required' });
    }
    
    // Get conversation to verify it exists
    const conversation = await chatRepository.getConversationById(conversationId);
    if (!conversation) {
      console.error('❌ Conversation not found:', conversationId);
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Send message via WhatsApp service
    let result;
    if (replyToMessageId) {
      // This is a reply - use sendReply
      result = await baileysService.sendReply(targetJid, messageText, replyToMessageId);
    } else {
      // This is a normal message - use sendMessage
      result = await baileysService.sendMessage(targetJid, messageText);
    }
    
    console.log('✅ Message sent successfully:', { 
      conversationId, 
      targetJid, 
      messageId: result?.messageId || result?.waMessageId,
      hasReplyToId: !!replyToMessageId
    });

    // ✅ OPTIMISTIC: Insert message immediately for instant UI update
    const tempMessageId = result?.messageId || result?.waMessageId;
    if (tempMessageId) {
      try {
        console.log('🔍 Attempting optimistic insertion:', { 
          messageId: tempMessageId,
          hasQuote: !!replyToMessageId,
          quoteId: replyToMessageId
        });
        
        // Insert outgoing message directly using repository method
        const insertResult = await chatRepository.insertOptimisticMessage({
          jid: targetJid,
          wa_message_id: tempMessageId,
          from_me: true,
          message_text: messageText,
          message_timestamp: Date.now(),
          conversation_id: conversationId,
          push_name: null,
          quoted_message_id: replyToMessageId || null
        });
        
        console.log('⚡ Optimistic message insert result:', { 
          success: !!insertResult, 
          messageId: tempMessageId,
          hasQuote: !!replyToMessageId,
          quoteId: replyToMessageId
        });
        
        // Update conversation last_message_at immediately
        await chatRepository.updateConversationTimestamp(conversationId);
        
        // Emit socket immediately for instant UI update
        const io = req.app.get('io');
        console.log('🔍 Socket IO check:', { hasIo: !!io, conversationId });
        
        // Fetch quoted message details if this is a reply
        let quotedMessageData = null;
        if (replyToMessageId) {
          try {
            const quotedMsg = await chatRepository.getMessageById(replyToMessageId);
            if (quotedMsg) {
              quotedMessageData = {
                quoted_text: quotedMsg.message_text,
                quoted_from_me: quotedMsg.from_me
              };
              console.log('📝 Found quoted message:', quotedMessageData);
            }
          } catch (quoteError) {
            console.warn('⚠️ Could not fetch quoted message:', quoteError);
          }
        }
        
        if (io) {
          console.log('🔍 Emitting to room:', `conversation_${conversationId}`);
          io.to(`conversation_${conversationId}`).emit('new-message', {
            id: tempMessageId,
            waMessageId: tempMessageId, // ✅ Add waMessageId field
            message_text: messageText,
            from_me: true,
            fromMe: true, // ✅ Add fromMe field (frontend expects this)
            conversation_id: conversationId,
            message_timestamp: Date.now(),
            quoted_message_id: replyToMessageId || null,
            quoted_text: quotedMessageData?.quoted_text || null, // ✅ Include actual quoted text
            quoted_from_me: quotedMessageData?.quoted_from_me || null, // ✅ Include quoted from_me flag
            // Group message fields (for consistency, even if not group)
            push_name: null,
            sender_jid: targetJid.endsWith('@g.us') ? targetJid : null,
            is_group_message: targetJid.endsWith('@g.us')
          });
          
          console.log('⚡ Optimistic message emitted:', { 
            conversationId, 
            messageId: tempMessageId,
            text: messageText.substring(0, 30),
            hasQuote: !!quotedMessageData
          });
        } else {
          console.error('❌ Socket IO not available in send-message endpoint');
        }
        
        console.log('⚡ Optimistic message inserted:', tempMessageId);
        console.log('⚡ Conversation timestamp updated:', conversationId);
      } catch (optimisticError) {
        console.error('❌ Optimistic insert failed:', optimisticError);
        // Don't fail the request, just log it
      }
    }

    res.json({
      success: true,
      messageId: result?.messageId || result?.waMessageId
    });
  } catch (error) {
    console.error('❌ Send message failed:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Conversation-based message fetching (preferred)
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const offset = req.query.offset ? parseInt(req.query.offset) : null;
    
    console.log('🔍 /conversations/:id/messages called:', { conversationId, limit, offset, params: req.params });
    
    if (!conversationId || isNaN(conversationId)) {
      console.error('❌ Invalid conversationId:', conversationId);
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }
    
    // Get messages with pagination
    const messages = await chatRepository.getMessagesByConversationId(conversationId, limit, offset);
    
    // Get conversation info
    const conversation = await chatRepository.getConversationById(conversationId);
    
    // Get contact info separately
    let contact = null;
    if (conversation?.contact_id) {
      contact = await chatRepository.getContactById(conversation.contact_id);
    }
    
    console.log('✅ Messages retrieved:', { 
      conversationId, 
      messageCount: messages.length,
      limit,
      offset,
      hasConversation: !!conversation,
      hasContact: !!contact,
      conversation: conversation,
      contact: contact
    });

    res.json({
      success: true,
      data: {
        messages: messages,
        conversation: conversation,
        contact: contact,
        pagination: {
          limit,
          offset,
          hasMore: limit && messages.length === limit
        }
      }
    });
  } catch (err) {
    console.error('❌ ERROR in /conversations/:id/messages:', {
      error: err.message,
      stack: err.stack,
      params: req.params
    });
    res.status(500).json({ error: err.message });
  }
});

// Reset unread count when conversation is opened
router.post('/conversations/:id/mark-read', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    await chatRepository.resetUnreadCount(conversationId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cleanup Unknown contacts
router.post('/cleanup-unknown-contacts', async (req, res) => {
  try {
    const { supabaseChatRepository: chatRepository } = require('../repositories/supabase-chatRepository.js');
    const { getSupabaseChat } = require('../config/supabase-chat.js');
    
    const supabase = getSupabaseChat();
    
    const { error } = await supabase
      .from('contacts')
      .update({ display_name: supabase.raw('phone_number') })
      .eq('display_name', 'Unknown');

    if (error) {
      throw error;
    }

    res.json({ 
      success: true, 
      updatedCount: 0 // Supabase doesn't return affected count easily
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get conversations list with contact info - DEPRECATED - use /contacts-with-conversations instead
// router.get('/conversations', async (req, res) => {
//   try {
//     const conversations = await chatRepository.getConversationsWithContacts();
//     res.json({
//       success: true,
//       data: conversations
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// Start new conversation by phone
router.post('/conversations/start', async (req, res) => {
  try {
    const { phone, name } = req.body;

    const conversationId = await chatService.startConversationWithPhone(phone, name);

    res.json({ conversationId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Link contact to existing conversation
router.post('/conversations/:id/link-contact', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const { contactId } = req.body;

    await chatRepository.linkContact(conversationId, contactId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get conversation by message ID
router.get('/messages/:id/conversation', async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);

    const conversation = await chatRepository.getConversationByMessageId(messageId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true, data: conversation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save contact and link to conversation
router.post('/conversations/:id/save-contact', async (req, res) => {
  try {
    console.log('BODY:', req.body);

    const conversationId = parseInt(req.params.id);
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const normalizedPhone = chatRepository.normalizePhone(phone);
    console.log('Normalized phone:', normalizedPhone);

    const contactId = await chatRepository.getOrCreateContactByPhone(
      normalizedPhone,
      name
    );

    // Get the conversation to check if it's broadcast/g.us
    const conversation = await chatRepository.getConversationById(conversationId);
    
    // If this is a broadcast or group conversation, link it with WhatsApp JID
    if (conversation && (conversation.jid.includes('@broadcast') || conversation.jid.endsWith('@g.us'))) {
      try {
        const linkResult = await chatRepository.linkBroadcastWithWhatsApp(conversation.jid, normalizedPhone);
        console.log('Linked broadcast JID with WhatsApp JID:', linkResult);
      } catch (linkErr) {
        console.error('Error linking JIDs:', linkErr);
        // Still proceed with basic contact linking even if JID linking fails
      }
    }

    await chatRepository.linkContact(conversationId, contactId);

    res.json({ success: true, contactId });
  } catch (err) {
    console.error('SAVE CONTACT ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all contacts with conversations (no pagination - show all)
router.get('/contacts-with-conversations', async (req, res) => {
  try {
    console.log('🔍 /contacts-with-conversations called with query:', req.query);
    
    // Get ALL contacts - no pagination
    const [contacts, totalCount] = await Promise.all([
      chatRepository.getContactsWithConversationsPaginated(0, 10000), // Get all contacts
      chatRepository.getContactsWithConversationsCount()
    ]);

    console.log('📄 /contacts-with-conversations called:', { all: true, count: contacts.length });

    console.log('✅ Contacts retrieved:', { 
      count: contacts.length,
      totalCount,
      sampleContact: contacts[0] || 'No contacts found'
    });

    res.json({
      success: true,
      data: contacts
    });
  } catch (err) {
    console.error('❌ ERROR in /contacts-with-conversations:', {
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({ error: err.message });
  }
});

// Get all contacts with conversation info
router.get('/contacts', async (req, res) => {
  try {
    const contacts = await chatRepository.getContactsWithConversations();
    res.json({ success: true, data: contacts });
  } catch (err) {
    console.error('❌ Contacts API error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new contact and conversation
router.post('/contacts', async (req, res) => {
  try {
    const { display_name, phone_number } = req.body;

    // Normalize phone
    const normalizedPhone = chatRepository.normalizePhone(phone_number);
    
    // Create contact
    const contactId = await chatRepository.createContact(display_name, normalizedPhone);
    
    // Generate JID
    const jid = chatRepository.generateJid(normalizedPhone);
    
    // Create conversation
    const conversationId = await chatRepository.getOrCreateConversation(jid);
    
    // Link contact to conversation
    await chatRepository.linkContact(conversationId, contactId);

    res.json({ success: true, conversationId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get conversation by contact ID
router.get('/contacts/:id/conversation', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);

    // Try to get existing conversation
    let conversationId = await chatRepository.getConversationByContactId(contactId);
    
    // If no conversation exists, create one
    if (!conversationId) {
      const contact = await chatRepository.getContactById(contactId);
      if (contact) {
        conversationId = await chatRepository.createConversationForContact(contactId);
      }
    }

    res.json({ success: true, conversationId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update contact
router.put('/contacts/:id', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const { display_name, phone_number } = req.body;

    if (!display_name || !phone_number) {
      return res.status(400).json({ error: 'Display name and phone number are required' });
    }

    // Normalize phone number
    const normalizedPhone = chatRepository.normalizePhone(phone_number);

    await chatRepository.updateContact(contactId, display_name, normalizedPhone);

    res.json({ success: true, message: 'Contact updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get merged messages by contact ID (from all linked conversations)
router.get('/contacts/:id/messages', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const offset = req.query.offset ? parseInt(req.query.offset) : null;
    
    const messages = await chatRepository.getMergedMessagesByContactId(contactId, limit, offset);

    res.json({
      success: true,
      data: messages,
      pagination: {
        limit,
        offset,
        hasMore: limit && messages.length === limit
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all conversation IDs for a contact (for socket rooms)
router.get('/contacts/:id/conversations', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const conversations = await chatRepository.getConversationsByContactId(contactId);

    res.json({
      success: true,
      data: conversations
    });
  } catch (err) {
    console.error('❌ Error fetching conversations for contact:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch conversations for contact' 
    });
  }
});

// Merge two contacts
router.post('/contacts/:id/merge', async (req, res) => {
  try {
    const sourceContactId = parseInt(req.params.id);
    const { targetContactId } = req.body;

    if (!targetContactId) {
      return res.status(400).json({ error: 'Target contact ID is required' });
    }

    // Verify both contacts exist
    const sourceContact = await chatRepository.getContactById(sourceContactId);
    const targetContact = await chatRepository.getContactById(targetContactId);
    
    if (!sourceContact || !targetContact) {
      return res.status(404).json({ error: 'One or both contacts not found' });
    }

    // Get all conversations from source contact
    const sourceConversations = await chatRepository.getConversationIdsByContactId(sourceContactId);
    
    // 🔥 CRITICAL: Get target contact's primary conversation for frontend redirect
    let targetConversationId = null;
    
    if (targetContact?.primary_jid) {
      // Get the conversation for the target's primary JID
      const targetConversation = await chatRepository.getConversationByJid(targetContact.primary_jid);
      targetConversationId = targetConversation?.id;
    }
    
    // If no primary conversation, get any conversation from target contact
    if (!targetConversationId) {
      const targetConversations = await chatRepository.getConversationIdsByContactId(targetContactId);
      if (targetConversations.length > 0) {
        targetConversationId = targetConversations[0].id;
      }
    }
    
    // Transfer JID mappings from source to target contact
    await chatRepository.transferJidMappings(sourceContactId, targetContactId);
    
    // Update all conversations to point to target contact
    for (const conv of sourceConversations) {
      await chatRepository.linkContact(conv.id, targetContactId);
    }

    // 🔥 CRITICAL: Mark source contact as merged (hide from contact list)
    await chatRepository.markContactAsMerged(sourceContactId);
    
    // 🔥 CRITICAL: Update target contact with all merged conversation IDs
    const allTargetConversations = await chatRepository.getConversationIdsByContactId(targetContactId);
    const allConversationIds = allTargetConversations.map(conv => conv.id).concat(sourceConversations.map(conv => conv.id));
    
    await chatRepository.updateContact(targetContactId, targetContact.display_name, targetContact.phone_number);
    
    // Update target contact's all_conversation_ids field
    const supabase = getSupabaseChat();
    await supabase
      .from('contacts')
      .update({ 
        all_conversation_ids: allConversationIds.join(',')
      })
      .eq('id', targetContactId);

    res.json({ 
      success: true, 
      message: 'Contacts merged successfully',
      mergedConversations: sourceConversations.length,
      targetConversationId, // 🔥 Return target conversation for frontend redirect
      targetContactId
    });
  } catch (err) {
    console.error('MERGE CONTACTS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update conversation contact association
router.put('/conversations/:id/contact', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const { contactId, displayName } = req.body;

    if (!contactId || !displayName) {
      return res.status(400).json({ error: 'Contact ID and display name are required' });
    }

    // Update the conversation's contact association
    await chatRepository.linkContact(conversationId, contactId);
    
    // Update the contact's display name
    await chatRepository.updateContact(contactId, displayName);

    res.json({ 
      success: true, 
      message: 'Conversation contact updated successfully' 
    });
  } catch (err) {
    console.error('UPDATE CONVERSATION CONTACT ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Clean up duplicate conversations
router.post('/cleanup-duplicates', async (req, res) => {
  try {
    const linkedCount = await chatRepository.cleanupDuplicateConversations();
    
    res.json({ 
      success: true, 
      message: `Cleaned up ${linkedCount} duplicate conversations`,
      linkedCount
    });
  } catch (err) {
    console.error('CLEANUP ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save contact with JID mapping (for unknown contacts)
router.post('/contacts/save-with-jid', async (req, res) => {
  try {
    const { name, phone, jid } = req.body;

    if (!name || !phone || !jid) {
      return res.status(400).json({ error: 'Name, phone, and JID are required' });
    }

    // Create contact
    const contactId = await chatRepository.createContact(name, phone);
    
    // Create or get conversation for JID
    const conversationId = await chatRepository.getOrCreateConversation(jid);
    
    // Link contact to conversation
    await chatRepository.linkContact(conversationId, contactId);
    
    // Update primary JID
    await chatRepository.updatePrimaryJid(contactId, jid);

    res.json({ 
      success: true, 
      contactId,
      conversationId,
      message: 'Contact saved successfully' 
    });
  } catch (err) {
    console.error('SAVE CONTACT WITH JID ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Merge JID with existing contact
router.post('/contacts/merge-jid', async (req, res) => {
  try {
    const { jid, contactId } = req.body;

    if (!jid || !contactId) {
      return res.status(400).json({ error: 'JID and contact ID are required' });
    }

    // Create or get conversation for JID
    const conversationId = await chatRepository.getOrCreateConversation(jid);
    
    // Link existing contact to conversation and create JID mapping
    const mapResult = await chatRepository.mapJidToContact(jid, contactId);
    
    // Update primary JID
    await chatRepository.updatePrimaryJid(contactId, jid);

    res.json({ 
      success: true, 
      conversationId: mapResult.conversationId || conversationId,
      targetConversationId: mapResult.conversationId || conversationId, // 🔥 Return target conversation for frontend redirect
      message: 'JID merged with contact successfully' 
    });
  } catch (err) {
    console.error('MERGE JID ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Merge ALL conversations from one contact to another contact
router.post('/contacts/merge-all-conversations', async (req, res) => {
  try {
    const { fromContactId, toContactId } = req.body;

    if (!fromContactId || !toContactId) {
      return res.status(400).json({ error: 'From contact ID and to contact ID are required' });
    }

    if (fromContactId === toContactId) {
      return res.status(400).json({ error: 'Cannot merge a contact with itself' });
    }

    // Get all conversations for the source contact
    const conversations = await chatRepository.getConversationsByContact(fromContactId);
    
    if (!conversations || conversations.length === 0) {
      return res.status(404).json({ error: 'No conversations found for source contact' });
    }

    const mergeResults = [];
    
    // Merge each conversation to the target contact
    for (const conversation of conversations) {
      try {
        // Link conversation to target contact
        await chatRepository.mapJidToContact(conversation.jid, toContactId);
        
        // Update primary JID if needed (use first conversation's JID as primary)
        if (mergeResults.length === 0) {
          await chatRepository.updatePrimaryJid(toContactId, conversation.jid);
        }
        
        mergeResults.push({
          conversationId: conversation.conversation_id,
          jid: conversation.jid,
          success: true
        });
      } catch (error) {
        console.error(`Failed to merge conversation ${conversation.conversation_id}:`, error);
        mergeResults.push({
          conversationId: conversation.conversation_id,
          jid: conversation.jid,
          success: false,
          error: error.message
        });
      }
    }

    // 🔥 CRITICAL: Get target contact's primary conversation for frontend redirect
    let targetConversationId = null;
    const targetContact = await chatRepository.getContactById(toContactId);
    
    if (targetContact?.primary_jid) {
      // Get the conversation for the target's primary JID
      const targetConversation = await chatRepository.getConversationByJid(targetContact.primary_jid);
      targetConversationId = targetConversation?.id;
    }
    
    // If no primary conversation, get any conversation from target contact
    if (!targetConversationId) {
      const targetConversations = await chatRepository.getConversationsByContact(toContactId);
      if (targetConversations && targetConversations.length > 0) {
        targetConversationId = targetConversations[0].conversation_id;
      }
    }

    // Clean up the old contact (optional - you might want to keep it for history)
    // await chatRepository.deleteContact(fromContactId);

    res.json({ 
      success: true, 
      mergedConversations: mergeResults,
      totalConversations: conversations.length,
      successfulMerges: mergeResults.filter(r => r.success).length,
      targetConversationId, // 🔥 Return target conversation for frontend redirect
      message: `Successfully merged ${mergeResults.filter(r => r.success).length}/${conversations.length} conversations` 
    });
  } catch (err) {
    console.error('MERGE ALL CONVERSATIONS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new contact and merge with @lid JID
router.post('/contacts/merge-lid-with-new', async (req, res) => {
  try {
    const { name, phone, lidJid } = req.body;

    if (!name || !phone || !lidJid) {
      return res.status(400).json({ error: 'Name, phone, and LID JID are required' });
    }

    // Normalize phone number
    const normalizedPhone = chatRepository.normalizePhone(phone);
    
    // Create contact
    const contactId = await chatRepository.createContact(name, normalizedPhone);
    
    // Generate WhatsApp JID from phone number
    const whatsappJid = chatRepository.generateJid(normalizedPhone);
    
    // Create conversation for WhatsApp JID
    const whatsappConversationId = await chatRepository.getOrCreateConversation(whatsappJid);
    
    // Link WhatsApp conversation to contact
    await chatRepository.linkContact(whatsappConversationId, contactId);
    
    // Create or get conversation for @lid JID and map it to the contact
    const lidConversationId = await chatRepository.getOrCreateConversation(lidJid);
    const mapResult = await chatRepository.mapJidToContact(lidJid, contactId);
    
    // Update primary JID to @lid (since that's the original JID)
    await chatRepository.updatePrimaryJid(contactId, lidJid);

    res.json({ 
      success: true, 
      contactId,
      whatsappConversationId,
      lidConversationId: mapResult.conversationId || lidConversationId,
      targetConversationId: lidConversationId, // 🔥 Return target conversation for frontend redirect
      whatsappJid,
      message: 'Contact created and merged successfully' 
    });
  } catch (err) {
    console.error('MERGE LID WITH NEW ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Search contacts
router.get('/contacts/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.json({ contacts: [] });
    }

    const contacts = await chatRepository.searchContacts(q.trim());

    res.json({ 
      contacts: contacts 
    });
  } catch (err) {
    console.error('SEARCH CONTACTS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unmerge conversation from contact
router.post('/conversations/:id/unmerge', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);

    // Get the conversation to unmerge
    const conversation = await chatRepository.getConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!conversation.contact_id) {
      return res.status(400).json({ error: 'Conversation is not merged with any contact' });
    }

    // Extract phone number from JID
    const phoneNumber = conversation.jid.replace(/@s\.whatsapp\.net|@lid|@g\.us|@broadcast/g, '');
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Cannot extract phone number from JID' });
    }

    // Find existing contact by phone number (original contact before merge)
    const contactId = await chatRepository.findContactByPhone(phoneNumber);
    
    console.log('🔍 Unmerge debug:', {
      phoneNumber,
      contactId,
      contactIdType: typeof contactId,
      conversationId
    });
    
    if (contactId) {
      // Link conversation back to original contact
      await chatRepository.linkContact(conversationId, contactId);
      
      // Update primary JID for the original contact
      await chatRepository.updatePrimaryJid(contactId, conversation.jid);
      
      console.log('✅ Unmerged: Linked conversation back to existing contact:', {
        conversationId,
        contactId: contactId,
        phoneNumber
      });
      
      res.json({ 
        success: true, 
        message: 'Conversation unmerged successfully',
        contactId: contactId,
        conversationId
      });
    } else {
      // No existing contact found - this shouldn't happen for valid unmerge
      console.error('❌ No existing contact found for unmerge:', { phoneNumber, conversationId });
      res.status(404).json({ error: 'No existing contact found for unmerge' });
    }
  } catch (err) {
    console.error('UNMERGE CONVERSATION ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get main participant for @g.us conversations
router.get('/conversations/:id/main-participant', async (req, res) => {
  try {
    const conversationId = req.params.id;
    
    const supabase = getSupabaseChat();
    
    // Get the conversation details
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('jid, contact_id')
      .eq('id', conversationId)
      .single();
    
    if (convError || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // If it's not a @g.us conversation, return itself
    if (!conversation.jid.endsWith('@g.us')) {
      return res.json({
        jid: conversation.jid,
        contact_id: conversation.contact_id
      });
    }
    
    // For @g.us conversations, get the latest message to extract participant info
    const { data: latestMessage, error: msgError } = await supabase
      .from('chat_messages')
      .select('raw_message, jid')
      .eq('conversation_id', conversationId)
      .not('raw_message', 'is', null)
      .eq('from_me', false)
      .order('message_timestamp', { ascending: false })
      .limit(1)
      .single();
    
    if (latestMessage && !msgError) {
      let pushName = null;
      let participantJid = latestMessage.jid;
      
      try {
        // Parse the raw WhatsApp message to extract pushName
        const rawMessage = JSON.parse(latestMessage.raw_message);
        pushName = rawMessage.pushName || rawMessage.senderName || null;
        
        // If participant JID is available, try to get contact info
        let contactInfo = null;
        if (participantJid) {
          const { data: contactData } = await supabase
            .from('contacts')
            .select('id, display_name, phone_number, is_auto_generated')
            .or(`primary_jid.eq.${participantJid},id.in.(
              select jm.contact_id from jid_mappings jm where jm.jid = ${participantJid}
            )`)
            .single();
          
          if (contactData) {
            contactInfo = contactData;
          }
        }
        
        return res.json({
          id: conversation.id,
          jid: participantJid || conversation.jid,
          contact_id: contactInfo?.id || conversation.contact_id,
          display_name: contactInfo?.display_name || pushName || 'Unknown',
          phone_number: contactInfo?.phone_number,
          is_auto_generated: contactInfo?.is_auto_generated || 0,
          push_name: pushName
        });
        
      } catch (parseError) {
        console.error('Error parsing raw message:', parseError);
      }
    }
    
    // Fallback: Find the main participant (WhatsApp JID or @lid) linked to this contact
    const { data: mainParticipant } = await supabase
      .from('conversations')
      .select(`
        id, jid, contact_id,
        contacts!left(display_name, phone_number)
      `)
      .eq('contact_id', conversation.contact_id)
      .neq('jid', conversation.jid)
      .or('jid.like.%@s.whatsapp.net,jid.like.%@lid')
      .order('jid', { ascending: false })
      .limit(1)
      .single();
    
    if (mainParticipant) {
      return res.json({
        id: mainParticipant.id,
        jid: mainParticipant.jid,
        contact_id: mainParticipant.contact_id,
        display_name: mainParticipant.contacts?.display_name || 'Unknown',
        phone_number: mainParticipant.contacts?.phone_number
      });
    } else {
      // If no main participant found, return the @g.us itself
      return res.json({
        jid: conversation.jid,
        contact_id: conversation.contact_id
      });
    }
    
  } catch (err) {
    console.error('GET MAIN PARTICIPANT ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Map a JID to an existing contact
router.post('/jid-map', async (req, res) => {
  try {
    const { jid, contactId } = req.body;

    if (!jid || !contactId) {
      return res.status(400).json({ error: 'JID and contactId are required' });
    }

    // Verify contact exists
    const contact = await chatRepository.getContactById(contactId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Map the JID to the contact
    await chatRepository.mapJidToContact(jid, contactId);

    res.json({ 
      success: true, 
      message: `JID ${jid} mapped to contact ${contactId}`,
      contact: {
        id: contact.id,
        display_name: contact.display_name,
        phone_number: contact.phone_number
      }
    });
  } catch (err) {
    console.error('JID MAP ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get contact by JID (checking both primary_jid and jid_mappings)
router.get('/jid-contact/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    
    if (!jid) {
      return res.status(400).json({ error: 'JID is required' });
    }

    const contact = await chatRepository.getContactByJid(decodeURIComponent(jid));

    if (!contact) {
      return res.json({ 
        found: false,
        message: 'No contact found for this JID'
      });
    }

    res.json({
      found: true,
      contact: {
        id: contact.id,
        display_name: contact.display_name,
        phone_number: contact.phone_number,
        primary_jid: contact.primary_jid,
        profile_pic_url: contact.profile_pic_url,
        is_auto_generated: contact.is_auto_generated
      }
    });
  } catch (err) {
    console.error('GET JID CONTACT ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get dashboard stats from Supabase
router.get('/dashboard', async (req, res) => {
  try {
    const supabase = getSupabaseChat();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    
    // Get today's leads count
    const { data: leadsData, error: leadsError } = await supabase
      .from('dealer_leads')
      .select('id')
      .gte('created_at', todayIso);
    
    // Get today's offerings count
    const { data: offeringsData, error: offeringsError } = await supabase
      .from('distributor_offerings')
      .select('id')
      .gte('created_at', todayIso);
    
    // Get today's ignored messages count
    const { data: ignoredData, error: ignoredError } = await supabase
      .from('ignored_messages')
      .select('id')
      .gte('created_at', todayIso);
    
    // Get recent activity (last 10 messages from all tables)
    const { data: recentLeads, error: recentLeadsError } = await supabase
      .from('dealer_leads')
      .select('id, created_at, raw_message, sender, classification')
      .order('created_at', { ascending: false })
      .limit(5);
    
    const { data: recentOfferings, error: recentOfferingsError } = await supabase
      .from('distributor_offerings')
      .select('id, created_at, raw_message, sender, classification')
      .order('created_at', { ascending: false })
      .limit(5);
    
    // Combine and sort recent activity
    const recentActivity = [
      ...(recentLeads || []).map(item => ({ ...item, type: 'lead' })),
      ...(recentOfferings || []).map(item => ({ ...item, type: 'offering' }))
    ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);
    
    const stats = {
      leadsToday: leadsData?.length || 0,
      offeringsToday: offeringsData?.length || 0,
      ignoredToday: ignoredData?.length || 0,
      recentActivity: recentActivity.map(item => ({
        id: item.id.toString(),
        sender: item.sender || 'Unknown',
        preview: item.raw_message ? item.raw_message.substring(0, 100) + '...' : '',
        timestamp: item.created_at,
        classification: item.classification || 'unknown'
      }))
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Dashboard endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Download media by WhatsApp message ID
router.get('/media/:waMessageId', async (req, res) => {
  try {
    const { waMessageId } = req.params;
    
    if (!waMessageId) {
      return res.status(400).json({ success: false, error: 'WhatsApp message ID required' });
    }

    console.log('🔍 Media download request for waMessageId:', waMessageId);

    // Get message from database with raw_message
    const { supabaseChatRepository } = await import('../repositories/supabase-chatRepository.js');
    
    const message = await supabaseChatRepository.getMessageById(waMessageId);
    
    if (!message || !message.raw_message) {
      return res.status(404).json({ success: false, error: 'Message not found or no media' });
    }

    // Parse raw WhatsApp message
    const rawMessage = JSON.parse(message.raw_message);
    
    // Use Baileys to download the media
    const { downloadMediaMessageFromRaw } = await import('../services/baileys.js');
    const buffer = await downloadMediaMessageFromRaw(rawMessage);
    
    if (!buffer) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    // Extract file info from raw message
    let filename = 'media';
    let contentType = 'application/octet-stream';
    
    const msg = rawMessage.message;
    
    if (msg.imageMessage) {
      contentType = msg.imageMessage.mimetype || 'image/jpeg';
      filename = msg.imageMessage.fileName || `image_${waMessageId}.jpg`;
    } else if (msg.videoMessage) {
      contentType = msg.videoMessage.mimetype || 'video/mp4';
      filename = msg.videoMessage.fileName || `video_${waMessageId}.mp4`;
    } else if (msg.audioMessage) {
      contentType = msg.audioMessage.mimetype || 'audio/mpeg';
      filename = msg.audioMessage.fileName || `audio_${waMessageId}.mp3`;
    } else if (msg.documentMessage) {
      contentType = msg.documentMessage.mimetype || 'application/pdf';
      filename = msg.documentMessage.fileName || `document_${waMessageId}.pdf`;
    } else if (msg.stickerMessage) {
      contentType = msg.stickerMessage.mimetype || 'image/webp';
      filename = `sticker_${waMessageId}.webp`;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (error) {
    console.error('Media download failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get thumbnail for media message
router.get('/media/:waMessageId/thumbnail', async (req, res) => {
  try {
    const { waMessageId } = req.params;
    
    if (!waMessageId) {
      return res.status(400).json({ success: false, error: 'WhatsApp message ID required' });
    }

    // Get message from database with raw_message
    const { supabaseChatRepository } = await import('../repositories/supabase-chatRepository.js');
    
    const message = await supabaseChatRepository.getMessageById(waMessageId);
    
    if (!message || !message.raw_message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // Parse raw WhatsApp message
    const rawMessage = JSON.parse(message.raw_message);
    const msg = rawMessage.message;
    
    let thumbnailBuffer = null;
    
    // Extract thumbnail from different message types
    if (msg.imageMessage?.jpegThumbnail) {
      thumbnailBuffer = Buffer.from(msg.imageMessage.jpegThumbnail, 'base64');
    } else if (msg.videoMessage?.jpegThumbnail) {
      thumbnailBuffer = Buffer.from(msg.videoMessage.jpegThumbnail, 'base64');
    } else if (msg.documentMessage?.jpegThumbnail) {
      thumbnailBuffer = Buffer.from(msg.documentMessage.jpegThumbnail, 'base64');
    }

    if (!thumbnailBuffer) {
      return res.status(404).json({ success: false, error: 'Thumbnail not found' });
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.send(thumbnailBuffer);

  } catch (error) {
    console.error('Thumbnail fetch failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get available brands from Supabase
router.get('/brands', async (req, res) => {
  try {
    const supabase = getSupabaseChat();
    
    // Get unique brands from dealer_leads
    const { data: leadsBrands, error: leadsError } = await supabase
      .from('dealer_leads')
      .select('brand')
      .not('brand', 'is', null);
    
    // Get unique brands from distributor_offerings
    const { data: offeringsBrands, error: offeringsError } = await supabase
      .from('distributor_offerings')
      .select('brand')
      .not('brand', 'is', null);
    
    // Combine and deduplicate brands
    const allBrands = [
      ...(leadsBrands || []).map(item => item.brand),
      ...(offeringsBrands || []).map(item => item.brand)
    ].filter((brand, index, self) => brand && self.indexOf(brand) === index);
    
    res.json({
      success: true,
      data: allBrands.sort()
    });
  } catch (error) {
    console.error('Brands endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// Get available models for a brand from Supabase
router.get('/models/:brand', async (req, res) => {
  try {
    const supabase = getSupabaseChat();
    const { brand } = req.params;
    
    // Get unique models from dealer_leads for this brand
    const { data: leadsModels, error: leadsError } = await supabase
      .from('dealer_leads')
      .select('model')
      .eq('brand', brand)
      .not('model', 'is', null);
    
    // Get unique models from distributor_offerings for this brand
    const { data: offeringsModels, error: offeringsError } = await supabase
      .from('distributor_offerings')
      .select('model')
      .eq('brand', brand)
      .not('model', 'is', null);
    
    // Combine and deduplicate models
    const allModels = [
      ...(leadsModels || []).map(item => item.model),
      ...(offeringsModels || []).map(item => item.model)
    ].filter((model, index, self) => model && self.indexOf(model) === index);
    
    res.json({
      success: true,
      data: allModels.sort()
    });
  } catch (error) {
    console.error('Models endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Get leads from Supabase (replaces SQL Server endpoint)
router.get('/leads', async (req, res) => {
  try {
    const supabase = getSupabaseChat();
    const { page = 1, limit = 20 } = req.query;
    
    // Convert to numbers and calculate range
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum - 1;
    
    console.log(`📄 Fetching leads: page ${pageNum}, limit ${limitNum}, range ${start}-${end}`);
    
    const { data, error } = await supabase
      .from('dealer_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .range(start, end);
    
    if (error) {
      console.error('Error fetching leads:', error);
      return res.status(500).json({ error: 'Failed to fetch leads' });
    }
    
    // Get total count
    const { count } = await supabase
      .from('dealer_leads')
      .select('*', { count: 'exact', head: true });
    
    // Transform dealer_leads data to match frontend Message interface
    const transformedData = (data || []).map(lead => ({
      id: lead.id.toString(),
      wa_message_id: lead.wa_message_id,
      sender: lead.sender || 'Unknown',
      senderNumber: lead.chat_id || '',
      sender_jid: lead.sender, // Add participant JID for broadcast resolution
      preview: lead.raw_message ? lead.raw_message.substring(0, 100) + '...' : '',
      rawMessage: lead.raw_message || '',
      classification: 'lead',
      detectedBrands: lead.brand ? [lead.brand] : [],
      timestamp: lead.created_at || new Date().toISOString(),
      confidence: lead.confidence || 0,
      parsedData: lead.brand ? {
        brand: lead.brand,
        model: lead.model,
        ram: lead.ram,
        storage: lead.storage,
        quantity: lead.quantity,
        price: lead.price,
        gst: lead.gst,
        dispatch: lead.dispatch,
        color: lead.colors ? (typeof lead.colors === 'string' ? JSON.parse(lead.colors) : lead.colors) : undefined,
        condition: lead.condition
      } : undefined,
      whatsappDeepLink: lead.chat_id ? `https://wa.me/${lead.chat_id.replace('@c.us', '')}` : '',
      note: null,
      fromMe: false,
      chatId: lead.chat_id,
      chatType: lead.chat_type
    }));
    
    res.json({
      success: true,
      data: transformedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Leads endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get offerings from Supabase (replaces SQL Server endpoint)
router.get('/offerings', async (req, res) => {
  try {
    const supabase = getSupabaseChat();
    const { page = 1, limit = 20 } = req.query;
    
    // Convert to numbers and calculate range
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum - 1;
    
    console.log(`📄 Fetching offerings: page ${pageNum}, limit ${limitNum}, range ${start}-${end}`);
    
    const { data, error } = await supabase
      .from('distributor_offerings')
      .select('*')
      .order('created_at', { ascending: false })
      .range(start, end);
    
    if (error) {
      console.error('Error fetching offerings:', error);
      return res.status(500).json({ error: 'Failed to fetch offerings' });
    }
    
    // Get total count
    const { count } = await supabase
      .from('distributor_offerings')
      .select('*', { count: 'exact', head: true });
    
    // Transform distributor_offerings data to match frontend Message interface
    const transformedData = (data || []).map(offering => ({
      id: offering.id.toString(),
      wa_message_id: offering.wa_message_id,
      sender: offering.sender || 'Unknown',
      senderNumber: offering.chat_id || '',
      preview: offering.raw_message ? offering.raw_message.substring(0, 100) + '...' : '',
      rawMessage: offering.raw_message || '',
      classification: 'offering',
      detectedBrands: offering.brand ? [offering.brand] : [],
      timestamp: offering.created_at || new Date().toISOString(),
      confidence: offering.confidence || 0,
      parsedData: offering.brand ? {
        brand: offering.brand,
        model: offering.model,
        ram: offering.ram,
        storage: offering.storage,
        quantity: offering.quantity,
        price: offering.price,
        gst: offering.gst,
        dispatch: offering.dispatch,
        color: offering.colors ? (typeof offering.colors === 'string' ? JSON.parse(offering.colors) : offering.colors) : undefined,
        condition: offering.condition
      } : undefined,
      whatsappDeepLink: offering.chat_id ? `https://wa.me/${offering.chat_id.replace('@c.us', '')}` : '',
      note: null,
      fromMe: false,
      chatId: offering.chat_id,
      chatType: offering.chat_type
    }));
    
    res.json({
      success: true,
      data: transformedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Offerings endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch offerings' });
  }
});

// Get ignored messages from Supabase (replaces SQL Server endpoint)
router.get('/ignored', async (req, res) => {
  try {
    const supabase = getSupabaseChat();
    const { page = 1, limit = 20 } = req.query;
    
    // Convert to numbers and calculate range
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum - 1;
    
    console.log(`📄 Fetching ignored messages: page ${pageNum}, limit ${limitNum}, range ${start}-${end}`);
    
    const { data, error } = await supabase
      .from('ignored_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .range(start, end);
    
    if (error) {
      console.error('Error fetching ignored messages:', error);
      return res.status(500).json({ error: 'Failed to fetch ignored messages' });
    }
    
    // Get total count
    const { count } = await supabase
      .from('ignored_messages')
      .select('*', { count: 'exact', head: true });
    
    // Transform ignored_messages data to match frontend Message interface
    const transformedData = (data || []).map(ignored => ({
      id: ignored.id.toString(),
      wa_message_id: ignored.wa_message_id,
      sender: ignored.sender || 'Unknown',
      senderNumber: ignored.chat_id || '',
      preview: ignored.raw_message ? ignored.raw_message.substring(0, 100) + '...' : '',
      rawMessage: ignored.raw_message || '',
      classification: 'ignored',
      detectedBrands: [],
      timestamp: ignored.created_at || new Date().toISOString(),
      confidence: ignored.confidence || 0,
      parsedData: undefined,
      whatsappDeepLink: ignored.chat_id ? `https://wa.me/${ignored.chat_id.replace('@c.us', '')}` : '',
      note: null,
      fromMe: false,
      chatId: ignored.chat_id,
      chatType: ignored.chat_type
    }));
    
    res.json({
      success: true,
      data: transformedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Ignored messages endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch ignored messages' });
  }
});

// Get lead by ID from Supabase (replaces SQL Server endpoint)
router.get('/leads/:id', async (req, res) => {
  try {
    const supabase = getSupabaseChat();
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('dealer_leads')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching lead:', error);
      return res.status(500).json({ error: 'Failed to fetch lead' });
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Transform dealer_leads data to match frontend Message interface
    const transformedData = {
      id: data.id.toString(),
      wa_message_id: data.wa_message_id,
      sender: data.sender || 'Unknown',
      senderNumber: data.chat_id || '',
      sender_jid: data.sender, // Add participant JID for broadcast resolution
      preview: data.raw_message ? data.raw_message.substring(0, 100) + '...' : '',
      rawMessage: data.raw_message || '',
      classification: 'lead',
      detectedBrands: data.brand ? [data.brand] : [],
      timestamp: data.created_at || new Date().toISOString(),
      confidence: data.confidence || 0,
      parsedData: data.brand ? {
        brand: data.brand,
        model: data.model,
        ram: data.ram,
        storage: data.storage,
        quantity: data.quantity,
        price: data.price,
        gst: data.gst,
        dispatch: data.dispatch,
        color: data.colors ? (typeof data.colors === 'string' ? JSON.parse(data.colors) : data.colors) : undefined,
        condition: data.condition
      } : undefined,
      whatsappDeepLink: data.chat_id ? `https://wa.me/${data.chat_id.replace('@c.us', '')}` : '',
      note: null,
      fromMe: false,
      chatId: data.chat_id,
      chatType: data.chat_type
    };
    
    res.json({
      success: true,
      data: transformedData
    });
  } catch (error) {
    console.error('Lead by ID endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Get offering by ID from Supabase (replaces SQL Server endpoint)
router.get('/offerings/:id', async (req, res) => {
  try {
    const supabase = getSupabaseChat();
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('distributor_offerings')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching offering:', error);
      return res.status(500).json({ error: 'Failed to fetch offering' });
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Offering not found' });
    }
    
    // Transform distributor_offerings data to match frontend Message interface
    const transformedData = {
      id: data.id.toString(),
      wa_message_id: data.wa_message_id,
      sender: data.sender || 'Unknown',
      senderNumber: data.chat_id || '',
      preview: data.raw_message ? data.raw_message.substring(0, 100) + '...' : '',
      rawMessage: data.raw_message || '',
      classification: 'offering',
      detectedBrands: data.brand ? [data.brand] : [],
      timestamp: data.created_at || new Date().toISOString(),
      confidence: data.confidence || 0,
      parsedData: data.brand ? {
        brand: data.brand,
        model: data.model,
        ram: data.ram,
        storage: data.storage,
        quantity: data.quantity,
        price: data.price,
        gst: data.gst,
        dispatch: data.dispatch,
        color: data.colors ? (typeof data.colors === 'string' ? JSON.parse(data.colors) : data.colors) : undefined,
        condition: data.condition
      } : undefined,
      whatsappDeepLink: data.chat_id ? `https://wa.me/${data.chat_id.replace('@c.us', '')}` : '',
      note: null,
      fromMe: false,
      chatId: data.chat_id,
      chatType: data.chat_type
    };
    
    res.json({
      success: true,
      data: transformedData
    });
  } catch (error) {
    console.error('Offering by ID endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch offering' });
  }
});

// Get ignored message by ID from Supabase (replaces SQL Server endpoint)
router.get('/ignored/:id', async (req, res) => {
  try {
    const supabase = getSupabaseChat();
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('ignored_messages')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching ignored message:', error);
      return res.status(500).json({ error: 'Failed to fetch ignored message' });
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Ignored message not found' });
    }
    
    // Transform ignored_messages data to match frontend Message interface
    const transformedData = {
      id: data.id.toString(),
      wa_message_id: data.wa_message_id,
      sender: data.sender || 'Unknown',
      senderNumber: data.chat_id || '',
      preview: data.raw_message ? data.raw_message.substring(0, 100) + '...' : '',
      rawMessage: data.raw_message || '',
      classification: 'ignored',
      detectedBrands: [],
      timestamp: data.created_at || new Date().toISOString(),
      confidence: data.confidence || 0,
      parsedData: undefined,
      whatsappDeepLink: data.chat_id ? `https://wa.me/${data.chat_id.replace('@c.us', '')}` : '',
      note: null,
      fromMe: false,
      chatId: data.chat_id,
      chatType: data.chat_type
    };
    
    res.json({
      success: true,
      data: transformedData
    });
  } catch (error) {
    console.error('Ignored message by ID endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch ignored message' });
  }
});

export default router;
