export type Classification = 'lead' | 'offering' | 'ignored';

export interface ParsedData {
  brand?: string;
  model?: string;
  ram?: string;
  storage?: string;
  quantity?: number;
  price?: number;
  gst?: string;
  dispatch?: string;
  color?: string | Record<string, number>;
}

export interface Product {
  id: string;
  brand: string;
  model: string;
  ram?: string;
  storage?: string;
  quantity?: number;
  price?: number;
  gst?: string;
  dispatch?: string;
  color?: string;
  seller: string;
  sellerNumber: string;
  timestamp: string;
  confidence: number;
  whatsappDeepLink: string;
  source: string;
}

export interface Message {
  id: string;
  sender: string;
  senderNumber: string;
  preview: string;
  rawMessage: string;
  classification: Classification;
  detectedBrands: string[];
  timestamp: string;
  confidence: number;
  parsedData?: ParsedData;
  whatsappDeepLink: string;
  note?: string;
}

export interface Contact {
  id: string;
  name: string;
  number: string;
  totalMessages: number;
  leadsCount: number;
  offeringsCount: number;
  lastActive: string;
}

export interface DashboardStats {
  leadsToday: number;
  offeringsToday: number;
  ignoredToday: number;
  recentActivity: Message[];
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  whatsappConnected: boolean;
  backendVersion: string;
  aiUsage: {
    requestsToday: number;
    tokensUsed: number;
  };
}
