import axios from 'axios';
import type { Message, Contact, DashboardStats, HealthStatus, Product } from '../types/message';

const api = axios.create({
  baseURL: '', // Use Vite proxy
  timeout: 10000,
});

export const getMessages = async (): Promise<Message[]> => {
  try {
    const response = await api.get('/api/messages');
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
};

export const getMessageById = async (id: string): Promise<Message | null> => {
  try {
    const response = await api.get(`/api/messages/${id}`);
    return response.data.data || null;
  } catch (error) {
    console.error('Error fetching message:', error);
    return null;
  }
};

export const getMessageByIdNew = async (id: string): Promise<Message | null> => {
  try {
    const response = await api.get(`/api/messages/${id}`);
    return response.data.data || null;
  } catch (error) {
    console.error('Error fetching message:', error);
    return null;
  }
};

export const getContacts = async (): Promise<Contact[]> => {
  try {
    const response = await api.get('/api/contacts');
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return [];
  }
};

export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const response = await api.get('/api/dashboard');
    return response.data.data || {
      leadsToday: 0,
      offeringsToday: 0,
      ignoredToday: 0,
      recentActivity: [],
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      leadsToday: 0,
      offeringsToday: 0,
      ignoredToday: 0,
      recentActivity: [],
    };
  }
};

export const getHealth = async (): Promise<HealthStatus> => {
  try {
    const response = await api.get('/health');
    return {
      status: response.data.status === 'ok' ? 'healthy' : 'down',
      whatsappConnected: true, // Hardcoded for now
      backendVersion: '1.0.0',
      aiUsage: {
        requestsToday: 0,
        tokensUsed: 0,
      },
    };
  } catch (error) {
    return {
      status: 'down',
      whatsappConnected: false,
      backendVersion: '1.0.0',
      aiUsage: {
        requestsToday: 0,
        tokensUsed: 0,
      },
    };
  }
};

export const searchMessages = async (params: {
  query: string;
  type?: 'lead' | 'offering';
  timeFilter?: string;
}): Promise<Message[]> => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('q', params.query);
    if (params.type) {
      queryParams.append('type', params.type);
    }
    if (params.timeFilter && params.timeFilter !== 'all') {
      queryParams.append('timeFilter', params.timeFilter);
    }

    const response = await api.get(`/api/search/messages?${queryParams.toString()}`);
    return response.data.data || [];
  } catch (error) {
    console.error('Error searching messages:', error);
    return [];
  }
};

export const searchProducts = async (params: {
  query: string;
  type?: 'all' | 'lead' | 'offering';
  brand?: string;
  model?: string;
  minPrice?: number;
  maxPrice?: number;
}): Promise<{ products: Product[]; total: number }> => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('q', params.query);
    if (params.type && params.type !== 'all') {
      queryParams.append('type', params.type);
    }
    if (params.brand) {
      queryParams.append('brand', params.brand);
    }
    if (params.model) {
      queryParams.append('model', params.model);
    }
    if (params.minPrice) {
      queryParams.append('minPrice', params.minPrice.toString());
    }
    if (params.maxPrice) {
      queryParams.append('maxPrice', params.maxPrice.toString());
    }

    const response = await api.get(`/api/search?${queryParams.toString()}`);
    return response.data.data || { products: [], total: 0 };
  } catch (error) {
    console.error('Error searching products:', error);
    return { products: [], total: 0 };
  }
};

export const getAvailableModels = async (brand: string): Promise<string[]> => {
  try {
    const response = await api.get(`/api/available-models?brand=${encodeURIComponent(brand)}`);
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching available models:', error);
    return [];
  }
};

export const getTodayOfferingsByBrand = async (brand?: string, model?: string, quantity?: string, days?: string): Promise<Message[]> => {
  try {
    const queryParams = new URLSearchParams();
    if (brand) {
      queryParams.append('brand', brand);
    }
    if (model) {
      queryParams.append('model', model);
    }
    if (quantity) {
      queryParams.append('quantity', quantity);
    }
    if (days) {
      queryParams.append('days', days);
    }

    console.log('Fetching offerings with params:', {
      brand,
      model,
      quantity,
      days,
      queryParams: queryParams.toString()
    });

    const response = await api.get(`/api/today-offerings-by-brand?${queryParams.toString()}`);
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching today offerings by brand:', error);
    return [];
  }
};

export const getAvailableBrands = async (): Promise<string[]> => {
  try {
    const response = await api.get('/api/available-brands');
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching available brands:', error);
    return [];
  }
};

export const sendMessage = async (params: {
  jid: string;
  message: string;
  replyToMessageId?: string;
}): Promise<{ success: boolean; error?: string; data?: any }> => {
  try {
    const response = await api.post('/api/reply', params);
    return response.data;
  } catch (error: any) {
    console.error('Error sending message:', error);
    return { success: false, error: error?.message || 'Failed to send message' };
  }
};
