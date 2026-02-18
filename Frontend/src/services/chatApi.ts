import axios from 'axios';

const API_BASE_URL = `${window.location.origin}/api`;

export interface ChatMessage {
  id: number;
  jid: string;
  wa_message_id: string;
  from_me: boolean;
  message_text: string;
  message_type: string;
  message_timestamp: number;
  status: number;
  created_at: string;
}

export const chatApi = {
  async getMessages(jid: string): Promise<ChatMessage[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/conversations/${encodeURIComponent(jid)}/messages`);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }
  }
};
