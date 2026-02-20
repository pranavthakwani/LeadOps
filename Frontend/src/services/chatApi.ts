import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5100"}/api`;

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
  }
};
