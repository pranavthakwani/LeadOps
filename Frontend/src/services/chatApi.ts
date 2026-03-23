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
  source_jid?: string;
  // New fields for resolved contact info
  resolved_contact_id?: number;  // Contact ID from jid_mappings lookup
  contact_display_name?: string;
  contact_phone?: string;
  contact_is_auto_generated?: boolean;
  contact_profile_pic?: string;
  jid_type?: 'whatsapp' | 'mapped_lid' | 'unmapped_lid' | 'group' | 'broadcast' | 'unknown';
  resolved_display_name?: string;
  // Legacy fields for backward compatibility
  display_name?: string;
  phone_number?: string;
  profile_pic_url?: string;
}

export interface Contact {
  id: number;
  display_name: string;
  phone_number: string;
  primary_jid: string;
  is_auto_generated?: boolean;
  profile_pic_url?: string;
  conversation_id: number | null;
  last_message_at: string | null;
  unread_count: number;
  all_conversation_ids?: number[];
  last_message_text?: string;
  last_message_from_me?: boolean;
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

  // Get messages by JID (for temporary conversations)
  async getMessagesByJid(jid: string): Promise<ChatMessage[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/messages/jid/${encodeURIComponent(jid)}`);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching messages by JID:', error);
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

  // Send message by JID (for temporary conversations/non-saved contacts)
  async sendMessageByJid(jid: string, text: string, quotedMessageId?: string): Promise<boolean> {
    try {
      // Use the /api/reply endpoint with JID directly
      await axios.post(`${API_BASE_URL}/reply`, {
        jid: jid,
        message: text,
        replyToMessageId: quotedMessageId
      });
      return true;
    } catch (error) {
      console.error('Error sending message by JID:', error);
      return false;
    }
  },

  // Get all contacts with conversation info
  async getContacts(): Promise<Contact[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/contacts`);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return [];
    }
  },

  // Get contacts with conversations (paginated)
  async getContactsPaginated(page: number = 1, limit: number = 30): Promise<{
    contacts: Contact[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    try {
      const response = await axios.get(`${API_BASE_URL}/contacts-with-conversations`, {
        params: { page, limit }
      });
      return {
        contacts: response.data.data || [],
        pagination: response.data.pagination || {
          page,
          limit,
          total: 0,
          hasMore: false
        }
      };
    } catch (error) {
      console.error('Error fetching paginated contacts:', error);
      return {
        contacts: [],
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false
        }
      };
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
  },

  // Save contact with JID mapping (for unknown contacts)
  async saveContactWithJid(name: string, phone: string, jid: string) {
    try {
      const response = await axios.post(`${API_BASE_URL}/contacts/save-with-jid`, {
        name,
        phone,
        jid
      });
      return response.data;
    } catch (error) {
      console.error('Error saving contact with JID:', error);
      return null;
    }
  },

  // Merge JID with existing contact
  async mergeJidWithContact(jid: string, contactId: number) {
    try {
      const response = await axios.post(`${API_BASE_URL}/contacts/merge-jid`, {
        jid,
        contactId
      });
      return response.data.success || false;
    } catch (error) {
      console.error('Error merging JID with contact:', error);
      return false;
    }
  },

  // Create new contact and merge with @lid JID
  async mergeLidWithNewContact(name: string, phone: string, lidJid: string) {
    try {
      const response = await axios.post(`${API_BASE_URL}/contacts/merge-lid-with-new`, {
        name,
        phone,
        lidJid
      });
      return response.data;
    } catch (error) {
      console.error('Error merging LID with new contact:', error);
      return null;
    }
  },

  // Search contacts
  async searchContacts(query: string) {
    try {
      const response = await axios.get(`${API_BASE_URL}/contacts/search?q=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      console.error('Error searching contacts:', error);
      return { contacts: [] };
    }
  },

  // Unmerge conversation from contact
  async unmergeConversation(conversationId: number, newContactName: string) {
    try {
      const response = await axios.post(`${API_BASE_URL}/conversations/${conversationId}/unmerge`, {
        newContactName
      });
      return response.data;
    } catch (error) {
      console.error('Error unmerging conversation:', error);
      throw error;
    }
  },

  // Get main participant for @g.us conversations
  async getMainParticipant(conversationId: number) {
    try {
      const response = await axios.get(`${API_BASE_URL}/conversations/${conversationId}/main-participant`);
      return response.data;
    } catch (error) {
      console.error('Error fetching main participant:', error);
      return null;
    }
  },

  // Map a JID to an existing contact
  async mapJidToContact(jid: string, contactId: number) {
    try {
      const response = await axios.post(`${API_BASE_URL}/jid-map`, {
        jid,
        contactId
      });
      return response.data;
    } catch (error) {
      console.error('Error mapping JID to contact:', error);
      return null;
    }
  },

  // Get contact by JID
  async getContactByJid(jid: string) {
    try {
      const response = await axios.get(`${API_BASE_URL}/jid-contact/${encodeURIComponent(jid)}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching contact by JID:', error);
      return { found: false };
    }
  }
};
