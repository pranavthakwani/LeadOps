import { useState, useEffect } from 'react';
import { getMessages } from '../services/api';
import type { Message, Classification } from '../types/message';

export const useMessages = (type?: Classification) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMessages(type);
        setMessages(data);
      } catch (err) {
        setError('Failed to load messages');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [type]);

  return { messages, loading, error };
};
