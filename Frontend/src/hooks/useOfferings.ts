import { useState, useEffect } from 'react';
import { getOfferings } from '../services/api';
import type { Message } from '../types/message';

export const useOfferings = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOfferings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getOfferings();
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load offerings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfferings();
  }, []);

  return { messages, loading, error, refetch: fetchOfferings };
};
