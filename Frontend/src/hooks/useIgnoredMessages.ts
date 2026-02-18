import { useState, useEffect } from 'react';
import { getIgnoredMessages } from '../services/ignoredApi';
import type { Message } from '../types/message';

export const useIgnoredMessages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIgnoredMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getIgnoredMessages();
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ignored messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIgnoredMessages();
  }, []);

  return {
    messages,
    loading,
    error,
    refetch: fetchIgnoredMessages,
  };
};
