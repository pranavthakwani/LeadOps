import axios from 'axios';
import { API_BASE_URL } from '../config/network';

export interface ChatMessage {
  id: number;
  jid: string;
  conversation_id: number;
  wa_message_id: string;
  from_me: boolean;
  message_text: string;
  message_type: string;
  message_timestamp: number;
  status: number;
  created_at: string;
  quoted_message_id?: string;
  quoted_text?: string;
  quoted_sender?: string;
}

export interface Conversation {
  id: number;
  jid: string;
  type: string;
  last_message_at: number;
  unread_count: number;
  contact_id?: number;
  display_name?: string;
  phone_number?: string;
}

export const chatApi = {
  // Get messages by conversation ID (preferred method)
  async getMessagesByConversation(conversationId: number): Promise<ChatMessage[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/conversations/${conversationId}/messages`);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      return [];
    }
  },

  // Get conversations list with contact info
  async getConversations(): Promise<Conversation[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/conversations`);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  },

  // Mark conversation as read (reset unread count)
  async markConversationRead(conversationId: number): Promise<boolean> {
    try {
      await axios.post(`${API_BASE_URL}/conversations/${conversationId}/mark-read`);
      return true;
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      return false;
    }
  },

  // Start new conversation by phone
  async startConversation(phone: string, name?: string): Promise<number | null> {
    try {
      const response = await axios.post(`${API_BASE_URL}/conversations/start`, { phone, name });
      return response.data.conversationId || null;
    } catch (error) {
      console.error('Error starting conversation:', error);
      return null;
    }
  },

  // Link contact to conversation
  async linkContact(conversationId: number, contactId: number): Promise<boolean> {
    try {
      await axios.post(`${API_BASE_URL}/conversations/${conversationId}/link-contact`, { contactId });
      return true;
    } catch (error) {
      console.error('Error linking contact:', error);
      return false;
    }
  },

  // Get conversation by message ID
  async getConversationByMessageId(messageId: number) {
    try {
      const response = await axios.get(`${API_BASE_URL}/messages/${messageId}/conversation`);
      return response.data.data || null;
    } catch (error) {
      console.error('Error fetching conversation by message ID:', error);
      return null;
    }
  },

  // Save contact and link to conversation
  async saveContactToConversation(conversationId: number, name: string, phone: string) {
    try {
      const response = await axios.post(`${API_BASE_URL}/conversations/${conversationId}/save-contact`, {
        name,
        phone
      });
      return response.data.contactId || null;
    } catch (error) {
      console.error('Error saving contact:', error);
      return null;
    }
  },

  // Send message with optional quote
  async sendMessage(conversationId: number, text: string, quotedMessageId?: string): Promise<boolean> {
    try {
      // First get the conversation details to get the JID
      const conversations = await this.getConversations();
      const conversation = conversations.find(conv => conv.id === conversationId);
      
      if (!conversation) {
        console.error('Conversation not found:', conversationId);
        return false;
      }

      // Use the /api/reply endpoint with JID
      await axios.post(`${API_BASE_URL}/reply`, {
        jid: conversation.jid,
        message: text,
        replyToMessageId: quotedMessageId
      });
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  },

  // Get all contacts with conversation info
  async getContacts() {
    try {
      const response = await axios.get(`${API_BASE_URL}/contacts`);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return [];
    }
  },

  // Create new contact and conversation
  async createContact(displayName: string, phoneNumber: string) {
    try {
      const response = await axios.post(`${API_BASE_URL}/contacts`, {
        display_name: displayName,
        phone_number: phoneNumber
      });
      return response.data.conversationId || null;
    } catch (error) {
      console.error('Error creating contact:', error);
      return null;
    }
  },

  // Get conversation by contact ID
  async getConversationByContact(contactId: number) {
    try {
      const response = await axios.get(`${API_BASE_URL}/contacts/${contactId}/conversation`);
      return response.data.conversationId || null;
    } catch (error) {
      console.error('Error fetching conversation by contact:', error);
      return null;
    }
  },

  // Update contact
  async updateContact(contactId: number, displayName: string, phoneNumber: string) {
    try {
      const response = await axios.put(`${API_BASE_URL}/contacts/${contactId}`, {
        display_name: displayName,
        phone_number: phoneNumber
      });
      return response.data.success || false;
    } catch (error) {
      console.error('Error updating contact:', error);
      return false;
    }
  },

  // Check WhatsApp connection status
  async getWhatsAppStatus() {
    try {
      const response = await axios.get(`${API_BASE_URL}/whatsapp-status`);
      return response.data;
    } catch (error) {
      console.error('Error checking WhatsApp status:', error);
      return {
        connected: false,
        lastConnected: null,
        qrRequired: true
      };
    }
  },

  // Get merged messages by contact ID (from all linked conversations)
  async getMergedMessagesByContact(contactId: number): Promise<ChatMessage[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/contacts/${contactId}/messages`);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching merged messages:', error);
      return [];
    }
  },

  // Get all conversation IDs for a contact (for socket rooms)
  async getConversationsByContact(contactId: number) {
    try {
      const response = await axios.get(`${API_BASE_URL}/contacts/${contactId}/conversations`);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching conversations by contact:', error);
      return [];
    }
  },

  // Update conversation contact association
  async updateConversationContact(conversationId: number, contactId: number, displayName: string): Promise<boolean> {
    try {
      await axios.put(`${API_BASE_URL}/conversations/${conversationId}/contact`, {
        contactId,
        displayName
      });
      return true;
    } catch (error) {
      console.error('Error updating conversation contact:', error);
      return false;
    }
  },

  // Merge two contacts together
  async mergeContacts(sourceContactId: number, targetContactId: number) {
    try {
      const response = await axios.post(`${API_BASE_URL}/contacts/${sourceContactId}/merge`, {
        targetContactId
      });
      return response.data.success || false;
    } catch (error) {
      console.error('Error merging contacts:', error);
      return false;
    }
  }
};
