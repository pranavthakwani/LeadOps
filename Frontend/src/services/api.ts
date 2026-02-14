import axios from 'axios';
import type { Message, Contact, DashboardStats, HealthStatus, Classification, Product } from '../types/message';

const api = axios.create({
  baseURL: '', // Use Vite proxy
  timeout: 10000,
});

const MOCK_MESSAGES: Message[] = [
  {
    id: '1',
    sender: 'Rakesh Mobile Store',
    senderNumber: '+919876543210',
    preview: 'iPhone 15 Pro Max 256GB Natural Titanium available. Qty: 5 units. Price: ₹1,34,900 + GST',
    rawMessage: 'Hello,\n\nWe have iPhone 15 Pro Max in stock:\n- Model: iPhone 15 Pro Max\n- Storage: 256GB\n- Color: Natural Titanium\n- Quantity: 5 units\n- Price: ₹1,34,900 + GST\n- Dispatch: Same day from Mumbai\n\nInterested?',
    classification: 'offering',
    detectedBrands: ['Apple', 'iPhone'],
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    confidence: 0.94,
    parsedData: {
      brand: 'Apple',
      model: 'iPhone 15 Pro Max',
      ram: undefined,
      storage: '256GB',
      quantity: 5,
      price: 134900,
      gst: 'Extra',
      dispatch: 'Same day from Mumbai',
    },
    whatsappDeepLink: 'https://wa.me/919876543210',
  },
  {
    id: '2',
    sender: 'Amit Traders',
    senderNumber: '+919123456789',
    preview: 'Looking for Samsung S24 Ultra 12GB/512GB. Need 10 units urgently.',
    rawMessage: 'Hi,\n\nLooking for Samsung S24 Ultra:\n- RAM: 12GB\n- Storage: 512GB\n- Quantity needed: 10 units\n- Budget: ₹1,15,000 per unit\n- Need in 2 days\n\nPlease confirm availability and best price.',
    classification: 'lead',
    detectedBrands: ['Samsung'],
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    confidence: 0.91,
    parsedData: {
      brand: 'Samsung',
      model: 'S24 Ultra',
      ram: '12GB',
      storage: '512GB',
      quantity: 10,
      price: 115000,
      gst: undefined,
      dispatch: '2 days',
    },
    whatsappDeepLink: 'https://wa.me/919123456789',
  },
  {
    id: '3',
    sender: 'Mobile Point Delhi',
    senderNumber: '+919988776655',
    preview: 'OnePlus 12 16GB/512GB Green. Stock available. Best wholesale rates.',
    rawMessage: 'OnePlus 12 available:\n\nSpecs:\n- 16GB RAM / 512GB Storage\n- Color: Flowy Emerald\n- Box packed with all accessories\n\nWholesale Price: ₹58,500 + GST\nMinimum Order: 3 units\nDispatch: Next day from Delhi',
    classification: 'offering',
    detectedBrands: ['OnePlus'],
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    confidence: 0.88,
    parsedData: {
      brand: 'OnePlus',
      model: 'OnePlus 12',
      ram: '16GB',
      storage: '512GB',
      quantity: 3,
      price: 58500,
      gst: 'Extra',
      dispatch: 'Next day from Delhi',
    },
    whatsappDeepLink: 'https://wa.me/919988776655',
  },
  {
    id: '4',
    sender: 'Unknown',
    senderNumber: '+919555555555',
    preview: 'Hi, how are you? Long time no see!',
    rawMessage: 'Hi there!\n\nHow are you? Long time no see! Let\'s catch up sometime.\n\nRegards',
    classification: 'ignored',
    detectedBrands: [],
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    confidence: 0.99,
    whatsappDeepLink: 'https://wa.me/919555555555',
  },
  {
    id: '5',
    sender: 'Priya Electronics',
    senderNumber: '+919444444444',
    preview: 'Need Vivo X100 Pro 16GB/512GB. Bulk order 20 units. What\'s your best price?',
    rawMessage: 'Hello,\n\nWe are looking to purchase:\n\nProduct: Vivo X100 Pro\nRAM: 16GB\nStorage: 512GB\nQuantity: 20 units\nLocation: Chennai\n\nPlease share your best wholesale rate with GST breakup.\n\nThanks',
    classification: 'lead',
    detectedBrands: ['Vivo'],
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    confidence: 0.95,
    parsedData: {
      brand: 'Vivo',
      model: 'X100 Pro',
      ram: '16GB',
      storage: '512GB',
      quantity: 20,
      price: undefined,
      gst: undefined,
      dispatch: undefined,
    },
    whatsappDeepLink: 'https://wa.me/919444444444',
  },
  {
    id: '6',
    sender: 'Tech Wholesale Hub',
    senderNumber: '+919333333333',
    preview: 'Xiaomi 14 Ultra available. 12GB/512GB. Limited stock. Price: ₹89,999 inclusive.',
    rawMessage: 'Premium Stock Alert!\n\nXiaomi 14 Ultra\n- 12GB RAM / 512GB Storage\n- Color: Black\n- Condition: Brand new sealed\n- Price: ₹89,999 (GST included)\n- Available: 7 units\n- Location: Bangalore\n- Dispatch: Immediate\n\nFirst come first serve!',
    classification: 'offering',
    detectedBrands: ['Xiaomi'],
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    confidence: 0.92,
    parsedData: {
      brand: 'Xiaomi',
      model: 'Xiaomi 14 Ultra',
      ram: '12GB',
      storage: '512GB',
      quantity: 7,
      price: 89999,
      gst: 'Included',
      dispatch: 'Immediate from Bangalore',
    },
    whatsappDeepLink: 'https://wa.me/919333333333',
  },
];

const MOCK_CONTACTS: Contact[] = [
  {
    id: '1',
    name: 'Rakesh Mobile Store',
    number: '+919876543210',
    totalMessages: 23,
    leadsCount: 8,
    offeringsCount: 15,
    lastActive: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: '2',
    name: 'Amit Traders',
    number: '+919123456789',
    totalMessages: 45,
    leadsCount: 32,
    offeringsCount: 13,
    lastActive: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: '3',
    name: 'Mobile Point Delhi',
    number: '+919988776655',
    totalMessages: 18,
    leadsCount: 6,
    offeringsCount: 12,
    lastActive: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: '4',
    name: 'Priya Electronics',
    number: '+919444444444',
    totalMessages: 34,
    leadsCount: 28,
    offeringsCount: 6,
    lastActive: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: '5',
    name: 'Tech Wholesale Hub',
    number: '+919333333333',
    totalMessages: 56,
    leadsCount: 12,
    offeringsCount: 44,
    lastActive: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
];

export const getMessages = async (type?: Classification): Promise<Message[]> => {
  try {
    const response = await api.get('/api/messages', { params: { type: type || 'all' } });
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    return []; // Return empty array instead of throwing
  }
};

export const getMessageById = async (id: string): Promise<Message | null> => {
  try {
    const response = await api.get(`/api/messages/${id}`);
    return response.data.data || null;
  } catch (error) {
    console.error('Error fetching message:', error);
    return null; // Return null instead of throwing
  }
};

// New function to get message by ID (handles both string and numeric IDs)
export const getMessageByIdNew = async (id: string): Promise<Message | null> => {
  try {
    const response = await api.get(`/api/messages/${id}`);
    return response.data.data || null;
  } catch (error) {
    console.error('Error fetching message:', error);
    return null; // Return null instead of throwing
  }
};

export const getContacts = async (): Promise<Contact[]> => {
  try {
    const response = await api.get('/api/contacts');
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return []; // Return empty array instead of throwing
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
    return { // Return default stats instead of throwing
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
    return {
      products: response.data.data || [],
      total: response.data.total || 0,
    };
  } catch (error) {
    console.error('Failed to search products:', error);
    return {
      products: [],
      total: 0,
    };
  }
};

export const sendMessage = async (data: {
  jid: string;
  message: string;
  replyToMessageId?: string;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await api.post('/api/reply', data);
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message'
    };
  }
};

export default api;
