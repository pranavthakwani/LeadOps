import { useState, useEffect } from 'react';
import { getIgnored } from '../services/api';
import type { Message } from '../types/message';

// Cache for storing paginated data
const ignoredCache = new Map<number, { messages: Message[]; totalCount: number }>();

export const useIgnoredMessages = (page: number = 1, limit: number = 20) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const fetchIgnoredMessages = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check cache first
        if (ignoredCache.has(page)) {
          console.log(`📄 Using cached ignored messages for page ${page}`);
          const cached = ignoredCache.get(page)!;
          setMessages(cached.messages);
          setTotalCount(cached.totalCount);
          setLoading(false);
          return;
        }
        
        console.log(`🌐 Fetching ignored messages for page ${page}, limit ${limit}`);
        const response = await getIgnored(page, limit);
        
        if (response.success) {
          const { data, pagination } = response;
          setMessages(data || []);
          setTotalCount(pagination?.total || 0);
          
          // Cache the results
          ignoredCache.set(page, { 
            messages: data || [], 
            totalCount: pagination?.total || 0 
          });
          console.log(`💾 Cached ignored messages for page ${page}`);
        } else {
          throw new Error(response.error || 'Failed to fetch ignored messages');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch ignored messages');
      } finally {
        setLoading(false);
      }
    };

    fetchIgnoredMessages();
  }, [page, limit]);

  return { messages, loading, error, totalCount };
};
