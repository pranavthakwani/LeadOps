import express from 'express';
import { chatRepository } from '../repositories/chatRepository.js';
import { chatService } from '../services/chatService.js';

const router = express.Router();

// Conversation-based message fetching (preferred)
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const messages = await chatRepository.getMessagesByConversationId(conversationId);

    res.json({
      success: true,
      data: messages
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages by JID (for temporary conversations/non-saved contacts)
router.get('/messages/jid/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    const messages = await chatRepository.getMessagesByJid(jid);

    res.json({
      success: true,
      data: messages
    });
  } catch (err) {
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
    const { chatRepository } = require('../repositories/chatRepository.js');
    const { getSQLPool } = require('../config/sqlserver.js');
    const sql = require('mssql');
    
    const pool = getSQLPool();
    
    const result = await pool.request()
      .query(`
        UPDATE contacts
        SET display_name = phone_number
        WHERE display_name = 'Unknown'
      `);

    res.json({ 
      success: true, 
      updatedCount: result.rowsAffected[0] 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get conversations list with contact info
router.get('/conversations', async (req, res) => {
  try {
    const conversations = await chatRepository.getConversationsWithContacts();
    res.json({
      success: true,
      data: conversations
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// Get contacts with conversations (paginated)
router.get('/contacts-with-conversations', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const offset = (page - 1) * limit;
    
    const contacts = await chatRepository.getContactsWithConversationsPaginated(offset, limit);
    const totalCount = await chatRepository.getContactsWithConversationsCount();
    
    res.json({ 
      success: true, 
      data: contacts,
      pagination: {
        page,
        limit,
        total: totalCount,
        hasMore: offset + limit < totalCount
      }
    });
  } catch (err) {
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
    const messages = await chatRepository.getMergedMessagesByContactId(contactId);

    res.json({
      success: true,
      data: messages
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
    
    // Transfer JID mappings from source to target contact
    await chatRepository.transferJidMappings(sourceContactId, targetContactId);
    
    // Update all conversations to point to target contact
    for (const conv of sourceConversations) {
      await chatRepository.linkContact(conv.id, targetContactId);
    }

    res.json({ 
      success: true, 
      message: 'Contacts merged successfully',
      mergedConversations: sourceConversations.length
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
      message: 'JID merged with contact successfully' 
    });
  } catch (err) {
    console.error('MERGE JID ERROR:', err);
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
    const { newContactName } = req.body;

    if (!newContactName) {
      return res.status(400).json({ error: 'New contact name is required' });
    }

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

    // Create new contact
    const newContactId = await chatRepository.createContact(newContactName, phoneNumber);
    
    // Update the conversation to link to the new contact
    await chatRepository.linkContact(conversationId, newContactId);
    
    // Update primary JID for the new contact
    await chatRepository.updatePrimaryJid(newContactId, conversation.jid);

    res.json({ 
      success: true, 
      message: 'Conversation unmerged successfully',
      newContactId,
      conversationId
    });
  } catch (err) {
    console.error('UNMERGE CONVERSATION ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get main participant for @g.us conversations
router.get('/conversations/:id/main-participant', async (req, res) => {
  try {
    const conversationId = req.params.id;
    
    const pool = await getSQLPool();
    
    // Get the conversation details
    const conversation = await pool.request()
      .input('conversationId', sql.Int, conversationId)
      .query(`
        SELECT c.jid, c.contact_id 
        FROM conversations c 
        WHERE c.id = @conversationId
      `);
    
    if (conversation.recordset.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const conv = conversation.recordset[0];
    
    // If it's not a @g.us conversation, return itself
    if (!conv.jid.endsWith('@g.us')) {
      return res.json({
        jid: conv.jid,
        contact_id: conv.contact_id
      });
    }
    
    // For @g.us conversations, get the latest message to extract participant info
    const latestMessage = await pool.request()
      .input('conversationId', sql.Int, conversationId)
      .query(`
        SELECT TOP 1 cm.raw_message, cm.jid as participant_jid
        FROM chat_messages cm
        WHERE cm.conversation_id = @conversationId
        AND cm.raw_message IS NOT NULL
        AND cm.from_me = 0
        ORDER BY cm.message_timestamp DESC
      `);
    
    if (latestMessage.recordset.length > 0) {
      const message = latestMessage.recordset[0];
      let pushName = null;
      let participantJid = message.participant_jid;
      
      try {
        // Parse the raw WhatsApp message to extract pushName
        const rawMessage = JSON.parse(message.raw_message);
        pushName = rawMessage.pushName || rawMessage.senderName || null;
        
        // If participant JID is available, try to get contact info
        let contactInfo = null;
        if (participantJid) {
          const contactQuery = await pool.request()
            .input('jid', sql.NVarChar, participantJid)
            .query(`
              SELECT c.id, c.display_name, c.phone_number, c.is_auto_generated
              FROM contacts c
              WHERE c.primary_jid = @jid
              OR c.id IN (
                SELECT jm.contact_id FROM jid_mappings jm WHERE jm.jid = @jid
              )
            `);
          
          if (contactQuery.recordset.length > 0) {
            contactInfo = contactQuery.recordset[0];
          }
        }
        
        return res.json({
          id: conv.id,
          jid: participantJid || conv.jid,
          contact_id: contactInfo?.id || conv.contact_id,
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
    const mainParticipant = await pool.request()
      .input('contactId', sql.Int, conv.contact_id)
      .input('gusJid', sql.NVarChar, conv.jid)
      .query(`
        SELECT c.id, c.jid, c.contact_id, co.display_name, co.phone_number
        FROM conversations c
        LEFT JOIN contacts co ON c.contact_id = co.id
        WHERE c.contact_id = @contactId 
        AND c.jid != @gusJid
        AND (c.jid LIKE '%@s.whatsapp.net' OR c.jid LIKE '%@lid')
        ORDER BY 
          CASE 
            WHEN c.jid LIKE '%@lid' THEN 1
            WHEN c.jid LIKE '%@s.whatsapp.net' THEN 2
            ELSE 3
          END
        LIMIT 1
      `);
    
    if (mainParticipant.recordset.length > 0) {
      const participant = mainParticipant.recordset[0];
      return res.json({
        id: participant.id,
        jid: participant.jid,
        contact_id: participant.contact_id,
        display_name: participant.display_name || 'Unknown',
        phone_number: participant.phone_number
      });
    } else {
      // If no main participant found, return the @g.us itself
      return res.json({
        jid: conv.jid,
        contact_id: conv.contact_id
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

export default router;
