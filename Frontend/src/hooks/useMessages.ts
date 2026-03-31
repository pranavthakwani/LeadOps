import { useState, useEffect } from 'react';
import { getMessages } from '../services/api';
import type { Message } from '../types/message';

// Cache for storing paginated data
const messageCache = new Map<number, Message[]>();

export const useMessages = (page: number = 1, limit: number = 20) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check cache first
        if (messageCache.has(page)) {
          console.log(`📄 Using cached messages for page ${page}`);
          setMessages(messageCache.get(page)!);
          setLoading(false);
          return;
        }
        
        console.log(`🌐 Fetching messages for page ${page}, limit ${limit}`);
        const response = await getMessages(page, limit);
        
        if (response.success) {
          const { data, pagination } = response;
          setMessages(data || []);
          setTotalCount(pagination?.total || 0);
          
          // Cache the results
          messageCache.set(page, data || []);
          console.log(`💾 Cached messages for page ${page}`);
        } else {
          throw new Error(response.error || 'Failed to fetch messages');
        }
      } catch (err) {
        setError('Failed to load messages');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [page, limit]);

  return { messages, loading, error, totalCount };
};
