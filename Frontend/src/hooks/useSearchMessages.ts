import { useState, useEffect } from 'react';
import { searchMessages } from '../services/api';
import type { Message } from '../types/message';

export const useSearchMessages = (query: string, type: 'leads' | 'offerings' = 'leads', timeFilter: string = 'all') => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!query.trim()) {
        setMessages([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const searchType = type === 'leads' ? 'lead' : 'offering';
        const data = await searchMessages({
          query,
          type: searchType,
          timeFilter
        });
        
        setMessages(data);
      } catch (err) {
        setError('Failed to search messages');
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResults();
  }, [query, type, timeFilter]);

  return { messages, loading, error };
};
