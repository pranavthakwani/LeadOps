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

    await chatRepository.linkContact(conversationId, contactId);

    res.json({ success: true, contactId });
  } catch (err) {
    console.error('SAVE CONTACT ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all contacts with conversation info
router.get('/contacts', async (req, res) => {
  try {
    const contacts = await chatRepository.getContactsWithConversations();
    res.json({ success: true, data: contacts });
  } catch (err) {
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

export default router;
