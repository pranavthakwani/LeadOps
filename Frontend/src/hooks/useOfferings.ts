import { useState, useEffect } from 'react';
import { getOfferings } from '../services/api';
import type { Message } from '../types/message';

// Cache for storing paginated data - CLEARED to fix timestamp issues
const offeringsCache = new Map<number, { messages: Message[]; totalCount: number }>();

export const useOfferings = (page: number = 1, limit: number = 20) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchOfferings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check cache first - DISABLED to force refresh with corrected timestamps
      if (false && offeringsCache.has(page)) {
        console.log(`Using cached offerings for page ${page}`);
        const cached = offeringsCache.get(page)!;
        setMessages(cached.messages);
        setTotalCount(cached.totalCount);
        setLoading(false);
        return;
      }
      
      console.log(`🌐 Fetching offerings for page ${page}, limit ${limit}`);
      const response = await getOfferings(page, limit);
      
      if (response.success) {
        const { data, pagination } = response;
        setMessages(data || []);
        setTotalCount(pagination?.total || 0);
        
        // Cache the results
        offeringsCache.set(page, { 
          messages: data || [], 
          totalCount: pagination?.total || 0 
        });
        console.log(`💾 Cached offerings for page ${page}`);
      } else {
        throw new Error(response.error || 'Failed to fetch offerings');
      }
    } catch (err) {
      setError('Failed to load offerings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfferings();
  }, [page, limit]);

  return { messages, loading, error, totalCount, refetch: fetchOfferings };
};
