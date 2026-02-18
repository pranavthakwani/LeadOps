import React from 'react';
import { IgnoredMessageCard } from '../common/IgnoredMessageCard';
import { EmptyState } from '../common/EmptyState';
import { Loader } from '../common/Loader';
import type { Message } from '../../types/message';

interface IgnoredMessageListProps {
  messages: Message[];
  loading?: boolean;
  error?: string | null;
}

export const IgnoredMessageList: React.FC<IgnoredMessageListProps> = ({ 
  messages, 
  loading = false, 
  error = null
}) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Loader key={i} type="message" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (messages.length === 0) {
    return <EmptyState title="No ignored messages" description="All messages have been processed" />;
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <IgnoredMessageCard key={message.id} message={message} />
      ))}
    </div>
  );
};
